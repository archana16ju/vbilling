import { RowDataPacket } from 'mysql2';
import { isLocalMySqlMode } from '@/lib/mysql';
import { resolveCompanyPoolAndContext } from '@/lib/mysql-company';
import {
  CompanyDashboardConfig,
  DEFAULT_COMPANY_DASHBOARD_CONFIG,
  DEFAULT_DASHBOARD_WIDGETS,
} from '@/lib/dashboard-config';

/**
 * Ensures the `dashboard_config` column exists in the company's `company_settings` table.
 */
async function ensureDashboardConfigColumn(pool: any): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'dashboard_config'`
    );
    if (!rows || rows.length === 0) {
      await pool.query(`
        ALTER TABLE company_settings
        ADD COLUMN dashboard_config JSON NULL AFTER terminal_design
      `);
    }
  } catch (err) {
    // If table doesn't exist or column already exists, ignore gracefully
  }
}

/**
 * Merges persisted widgets with any newly introduced default widgets so new features aren't lost.
 */
function normalizeDashboardConfig(raw: any): CompanyDashboardConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_COMPANY_DASHBOARD_CONFIG;
  }

  const layoutMode = raw.layoutMode === 'compact' ? 'compact' : 'comfortable';
  const savedWidgets: any[] = Array.isArray(raw.widgets) ? raw.widgets : [];

  const widgetMap = new Map<string, any>();
  for (const w of savedWidgets) {
    if (w && typeof w.id === 'string') {
      widgetMap.set(w.id, w);
    }
  }

  // Merge default widgets preserving saved visibility & order
  const merged = DEFAULT_DASHBOARD_WIDGETS.map((def, idx) => {
    const saved = widgetMap.get(def.id);
    if (saved) {
      return {
        ...def,
        visible: typeof saved.visible === 'boolean' ? saved.visible : def.visible,
        order: typeof saved.order === 'number' ? saved.order : idx,
      };
    }
    return { ...def, order: idx };
  });

  // Sort by order ascending
  merged.sort((a, b) => a.order - b.order);

  return {
    layoutMode,
    widgets: merged,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Resolves the company-specific dashboard configuration from the company's MySQL database.
 */
export async function getCompanyDashboardConfig(
  companyId: string
): Promise<{ config: CompanyDashboardConfig; isCustom: boolean }> {
  if (!isLocalMySqlMode() || !companyId) {
    return { config: DEFAULT_COMPANY_DASHBOARD_CONFIG, isCustom: false };
  }

  try {
    const { pool } = await resolveCompanyPoolAndContext(companyId);
    await ensureDashboardConfigColumn(pool);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT dashboard_config FROM company_settings WHERE company_id = ? LIMIT 1',
      [companyId]
    );

    if (rows && rows.length > 0 && rows[0].dashboard_config) {
      const val = rows[0].dashboard_config;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && typeof parsed === 'object') {
        return {
          config: normalizeDashboardConfig(parsed),
          isCustom: true,
        };
      }
    }
  } catch (err) {
    console.error(`Error loading dashboard_config for company ${companyId}:`, err);
  }

  return {
    config: DEFAULT_COMPANY_DASHBOARD_CONFIG,
    isCustom: false,
  };
}

/**
 * Saves a company-specific dashboard configuration into that company's MySQL database.
 */
export async function saveCompanyDashboardConfig(
  companyId: string,
  config: CompanyDashboardConfig
): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  await ensureDashboardConfigColumn(pool);

  const payload: CompanyDashboardConfig = {
    layoutMode: config.layoutMode === 'compact' ? 'compact' : 'comfortable',
    widgets: (config.widgets || DEFAULT_DASHBOARD_WIDGETS).map((w, idx) => ({
      id: w.id,
      label: w.label,
      category: w.category,
      description: w.description || '',
      visible: typeof w.visible === 'boolean' ? w.visible : true,
      order: typeof w.order === 'number' ? w.order : idx,
    })),
    updatedAt: new Date().toISOString(),
  };

  const configJson = JSON.stringify(payload);
  const settingsId = `cs_${companyId}`;

  await pool.query(
    `INSERT INTO company_settings (id, company_id, dashboard_config)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE dashboard_config = VALUES(dashboard_config), updated_at = CURRENT_TIMESTAMP`,
    [settingsId, companyId, configJson]
  );

  return true;
}

/**
 * Resets a company's dashboard configuration to system default (sets dashboard_config = NULL).
 */
export async function resetCompanyDashboardConfig(companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  await pool.query(
    'UPDATE company_settings SET dashboard_config = NULL, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?',
    [companyId]
  );

  return true;
}
