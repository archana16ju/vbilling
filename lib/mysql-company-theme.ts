import { getMysqlPool, isLocalMySqlMode } from './mysql';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { CompanyTheme, DEFAULT_BLACK_CHERRY_THEME } from './theme-config';

/**
 * Gets the global system default theme configured by Super Admin (defaults to Black Cherry).
 */
export async function getSystemDefaultTheme(): Promise<CompanyTheme> {
  if (!isLocalMySqlMode()) {
    return DEFAULT_BLACK_CHERRY_THEME;
  }

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'default_theme' LIMIT 1"
    );

    if (rows && rows.length > 0) {
      const val = rows[0].setting_value;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && parsed.gradientStart && parsed.gradientEnd) {
        return parsed as CompanyTheme;
      }
    }
  } catch (err) {
    console.warn('Could not read system_settings default_theme, using Black Cherry fallback:', err);
  }

  return DEFAULT_BLACK_CHERRY_THEME;
}

/**
 * Updates the global system default theme (Super Admin only).
 */
export async function setSystemDefaultTheme(theme: CompanyTheme): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;

  const pool = getMysqlPool();
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('default_theme', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(theme)]
  );

  return true;
}

/**
 * Resolves the active theme for a specific company.
 * If the company has configured their own custom theme, returns it with isCustom = true.
 * If the company has not configured a custom theme, returns the system default theme with isCustom = false.
 */
export async function getCompanyTheme(companyId: string): Promise<{ theme: CompanyTheme; isCustom: boolean }> {
  if (!isLocalMySqlMode() || !companyId) {
    return { theme: DEFAULT_BLACK_CHERRY_THEME, isCustom: false };
  }

  const defaultTheme = await getSystemDefaultTheme();

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT theme_config FROM company_settings WHERE company_id = ? LIMIT 1',
      [companyId]
    );

    if (rows && rows.length > 0 && rows[0].theme_config) {
      const val = rows[0].theme_config;
      const parsed = typeof val === 'string' ? JSON.parse(val) : val;
      if (parsed && parsed.gradientStart && parsed.gradientEnd) {
        return {
          theme: parsed as CompanyTheme,
          isCustom: true,
        };
      }
    }
  } catch (err) {
    console.error(`Error loading theme for company ${companyId}:`, err);
  }

  return {
    theme: defaultTheme,
    isCustom: false,
  };
}

/**
 * Saves a company-specific theme configuration.
 */
export async function saveCompanyTheme(companyId: string, theme: CompanyTheme): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const pool = getMysqlPool();
  const themeJson = JSON.stringify(theme);
  const settingsId = `cs_${companyId}`;

  await pool.query(
    `INSERT INTO company_settings (id, company_id, theme_config)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE theme_config = VALUES(theme_config), updated_at = CURRENT_TIMESTAMP`,
    [settingsId, companyId, themeJson]
  );

  return true;
}

/**
 * Resets a company's theme to inherit the system default theme (sets theme_config = NULL).
 */
export async function resetCompanyTheme(companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode() || !companyId) return false;

  const pool = getMysqlPool();
  await pool.query(
    'UPDATE company_settings SET theme_config = NULL, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?',
    [companyId]
  );

  return true;
}
