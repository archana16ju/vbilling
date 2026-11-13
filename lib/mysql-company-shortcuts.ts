import { getMysqlPool, isLocalMySqlMode } from './mysql';
import { resolveCompanyPoolAndContext } from './mysql-company';
import { RowDataPacket } from 'mysql2';
import {
  StoredShortcutConfig,
  getDefaultStoredShortcutsConfig,
  ALL_SHORTCUT_DEFINITIONS,
} from './shortcuts-config';

/**
 * Gets the global system default shortcuts configured by Super Admin.
 */
export async function getSystemDefaultShortcuts(): Promise<StoredShortcutConfig> {
  const fallback = getDefaultStoredShortcutsConfig();
  if (!isLocalMySqlMode()) {
    return fallback;
  }

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'default_shortcuts' LIMIT 1"
    );

    if (rows && rows.length > 0) {
      const val = rows[0].setting_value;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && typeof parsed === 'object' && parsed.actions) {
        return mergeWithDefaultDefinitions(parsed as StoredShortcutConfig);
      }
    }
  } catch (err) {
    console.warn('Could not read system_settings default_shortcuts, using built-in defaults:', err);
  }

  return fallback;
}

/**
 * Sets the global system default shortcuts (Super Admin only).
 */
export async function setSystemDefaultShortcuts(config: StoredShortcutConfig): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;

  const pool = getMysqlPool();
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('default_shortcuts', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(config)]
  );

  return true;
}

/**
 * Resolves the active shortcuts for a specific company.
 * If custom shortcuts are set for that company, returns isCustom = true.
 * If not, returns the system default shortcuts with isCustom = false.
 */
export async function getCompanyShortcuts(
  companyId: string
): Promise<{ config: StoredShortcutConfig; isCustom: boolean }> {
  const defaultShortcuts = await getSystemDefaultShortcuts();
  if (!isLocalMySqlMode() || !companyId) {
    return { config: defaultShortcuts, isCustom: false };
  }

  try {
    const { pool } = await resolveCompanyPoolAndContext(companyId);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT shortcuts_config FROM company_settings WHERE company_id = ? OR id = ? OR 1=1 ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END LIMIT 1',
      [companyId, `cs_${companyId}`, companyId]
    );

    if (rows && rows.length > 0 && rows[0].shortcuts_config) {
      const val = rows[0].shortcuts_config;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && typeof parsed === 'object' && parsed.actions) {
        return {
          config: mergeWithDefaultDefinitions(parsed as StoredShortcutConfig),
          isCustom: true,
        };
      }
    }
  } catch (err) {
    console.error(`Error loading shortcuts for company ${companyId}:`, err);
  }

  return {
    config: defaultShortcuts,
    isCustom: false,
  };
}

/**
 * Saves a company-specific shortcut configuration.
 */
export async function saveCompanyShortcuts(
  companyId: string,
  config: StoredShortcutConfig
): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  const configJson = JSON.stringify(config);
  const settingsId = `cs_${companyId}`;

  const [updateResult]: any = await pool.query(
    'UPDATE company_settings SET shortcuts_config = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? OR id = ?',
    [configJson, companyId, settingsId]
  );

  if (!updateResult || updateResult.affectedRows === 0) {
    await pool.query(
      `INSERT INTO company_settings (id, company_id, shortcuts_config)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE shortcuts_config = VALUES(shortcuts_config), updated_at = CURRENT_TIMESTAMP`,
      [settingsId, companyId, configJson]
    );
  }

  return true;
}

/**
 * Resets a company's shortcuts to inherit system defaults (sets shortcuts_config = NULL).
 */
export async function resetCompanyShortcuts(companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const { pool } = await resolveCompanyPoolAndContext(companyId);
  await pool.query(
    'UPDATE company_settings SET shortcuts_config = NULL, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? OR id = ? OR 1=1',
    [companyId, `cs_${companyId}`]
  );

  return true;
}

/**
 * Ensures any newly introduced actions are safely included if reading older persisted company config.
 */
function mergeWithDefaultDefinitions(stored: StoredShortcutConfig): StoredShortcutConfig {
  const defaults = getDefaultStoredShortcutsConfig();
  const mergedActions: Record<string, { enabled: boolean; keys: string[] }> = {
    ...defaults.actions,
    ...(stored.actions || {}),
  };

  // Ensure each action has at least valid properties
  for (const def of ALL_SHORTCUT_DEFINITIONS) {
    if (!mergedActions[def.id]) {
      mergedActions[def.id] = { enabled: true, keys: [...def.defaultKeys] };
    } else {
      if (!Array.isArray(mergedActions[def.id].keys) || mergedActions[def.id].keys.length === 0) {
        mergedActions[def.id].keys = [...def.defaultKeys];
      }
      if (typeof mergedActions[def.id].enabled !== 'boolean') {
        mergedActions[def.id].enabled = true;
      }
    }
  }

  return {
    showKeysOnButtons: stored.showKeysOnButtons ?? true,
    actions: mergedActions,
  };
}
