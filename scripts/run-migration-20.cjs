require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('Refusing to run migration on non-local database.');
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  const conn = await pool.getConnection();
  try {
    async function columnExists(table, column) {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows.length > 0;
    }

    console.log('Checking company_settings.theme_config...');
    if (!(await columnExists('company_settings', 'theme_config'))) {
      await conn.query(`
        ALTER TABLE company_settings
        ADD COLUMN theme_config JSON NULL AFTER printer_width;
      `);
      console.log('Added theme_config column to company_settings.');
    } else {
      console.log('Column theme_config already exists.');
    }

    console.log('Creating system_settings table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Initializing system default_theme (Black Cherry)...');
    await conn.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value)
      VALUES (
        'default_theme',
        JSON_OBJECT(
          'id', 'black-cherry',
          'name', 'Black Cherry',
          'gradientStart', '#1F0715',
          'gradientMid', '#701A3B',
          'gradientEnd', '#DB2777',
          'accentColor', '#DB2777',
          'accentHover', '#BE185D',
          'glowColor', 'rgba(219, 39, 119, 0.45)',
          'activeBorderColor', '#DB2777',
          'badgeBg', 'rgba(219, 39, 119, 0.15)',
          'badgeText', '#F472B6'
        )
      );
    `);

    // Record in _migrations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      INSERT IGNORE INTO _migrations (version, name)
      VALUES (20, '020_add_company_theme_settings');
    `);

    console.log('Migration 20 completed successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
