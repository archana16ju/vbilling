import { RowDataPacket } from 'mysql2';
import { isLocalMySqlMode } from '@/lib/mysql';
import { resolveCompanyPoolAndContext } from '@/lib/mysql-company';
import {
  CompanyHeaderNavConfig,
  DEFAULT_HEADER_NAV_CONFIG,
  normalizeHeaderNavConfig,
} from '@/lib/header-nav-config';

/**
 * Ensures the `header_nav_config` column exists in the company's `company_settings` table.
 */
async function ensureHeaderNavConfigColumn(pool: any): Promise<void> {
  try {
    const [rows]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_settings' AND COLUMN_NAME = 'header_nav_config'`
    );
    if (!rows || rows.length === 0) {
      await pool.query(`
        ALTER TABLE company_settings
        ADD COLUMN header_nav_config JSON NULL AFTER dashboard_config
      `);
    }
  } catch (err) {
    // If column already exists or table is being modified concurrently, safely ignore
  }
}

/**
 * Resolves the company-specific header navigation configuration from the company's MySQL database.
 */
export async function getCompanyHeaderNavConfig(
  companyId: string
): Promise<{ config: CompanyHeaderNavConfig; isCustom: boolean }> {
  if (!isLocalMySqlMode() || !companyId) {
    return { config: DEFAULT_HEADER_NAV_CONFIG, isCustom: false };
  }

  try {
    const { pool } = await resolveCompanyPoolAndContext(companyId);
    await ensureHeaderNavConfigColumn(pool);

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT header_nav_config FROM company_settings WHERE company_id = ? LIMIT 1',
      [companyId]
    );

    if (rows && rows.length > 0 && rows[0].header_nav_config) {
      const val = rows[0].header_nav_config;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && typeof parsed === 'object') {
        return {
          config: normalizeHeaderNavConfig(parsed),
          isCustom: true,
        };
      }
    }
  } catch (err) {
    console.error(`[MySQL Header Nav] Error fetching header nav config for company ${companyId}:`, err);
  }

  return { config: DEFAULT_HEADER_NAV_CONFIG, isCustom: false };
}

/**
 * Persists the updated header navigation configuration into the company's `company_settings` record.
 */
export async function saveCompanyHeaderNavConfig(
  companyId: string,
  config: CompanyHeaderNavConfig
): Promise<CompanyHeaderNavConfig> {
  const normalized = normalizeHeaderNavConfig(config);
  normalized.updatedAt = new Date().toISOString();

  if (!isLocalMySqlMode() || !companyId) {
    return normalized;
  }

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  await ensureHeaderNavConfigColumn(pool);

  const jsonStr = JSON.stringify(normalized);

  // Check if company_settings row exists
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM company_settings WHERE company_id = ? LIMIT 1',
    [companyId]
  );

  if (rows && rows.length > 0) {
    await pool.query(
      'UPDATE company_settings SET header_nav_config = ? WHERE company_id = ?',
      [jsonStr, companyId]
    );
  } else {
    // Insert initial company_settings row
    const id = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await pool.query(
      'INSERT INTO company_settings (id, company_id, header_nav_config) VALUES (?, ?, ?)',
      [id, companyId, jsonStr]
    );
  }

  return normalized;
}

/**
 * Resets the company header navigation configuration to factory defaults.
 */
export async function resetCompanyHeaderNavConfig(companyId: string): Promise<CompanyHeaderNavConfig> {
  if (isLocalMySqlMode() && companyId) {
    try {
      const { pool } = await resolveCompanyPoolAndContext(companyId);
      await ensureHeaderNavConfigColumn(pool);
      await pool.query(
        'UPDATE company_settings SET header_nav_config = NULL WHERE company_id = ?',
        [companyId]
      );
    } catch (err) {
      console.error(`[MySQL Header Nav] Error resetting config for company ${companyId}:`, err);
    }
  }
  return DEFAULT_HEADER_NAV_CONFIG;
}
