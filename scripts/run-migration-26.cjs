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
    database: 'local_billing_db',
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

    console.log('Checking company_settings.shortcuts_config...');
    if (!(await columnExists('company_settings', 'shortcuts_config'))) {
      await conn.query(`
        ALTER TABLE company_settings
        ADD COLUMN shortcuts_config JSON NULL AFTER theme_config;
      `);
      console.log('Added shortcuts_config column to company_settings.');
    } else {
      console.log('Column shortcuts_config already exists.');
    }

    console.log('Checking company_settings.terminal_design...');
    if (!(await columnExists('company_settings', 'terminal_design'))) {
      await conn.query(`
        ALTER TABLE company_settings
        ADD COLUMN terminal_design JSON NULL AFTER shortcuts_config;
      `);
      console.log('Added terminal_design column to company_settings.');
    } else {
      console.log('Column terminal_design already exists.');
    }

    // Record in _migrations table
    await conn.query(`
      INSERT IGNORE INTO _migrations (version, name)
      VALUES (26, '026_add_company_shortcuts_and_terminal_design_config');
    `);

    console.log('Migration 26 completed successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
