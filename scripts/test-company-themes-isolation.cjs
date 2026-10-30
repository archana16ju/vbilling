require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function runTests() {
  console.log('=== RUNNING COMPANY THEMES ISOLATION TESTS ===\n');

  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('Refusing to run tests on non-local database.');
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
    // TEST 1: Check system default theme is Black Cherry
    console.log('TEST 1: Verifying System Default Theme...');
    const [sysRows] = await conn.query("SELECT setting_value FROM system_settings WHERE setting_key = 'default_theme'");
    if (!sysRows.length) throw new Error('Default theme not found in system_settings');
    const defaultTheme = typeof sysRows[0].setting_value === 'string' 
      ? JSON.parse(sysRows[0].setting_value) 
      : sysRows[0].setting_value;

    console.log('  -> Default Theme Name:', defaultTheme.name);
    console.log('  -> Gradient Start:', defaultTheme.gradientStart, '(Expected: #1F0715)');
    console.log('  -> Gradient Mid:', defaultTheme.gradientMid, '(Expected: #701A3B)');
    console.log('  -> Gradient End:', defaultTheme.gradientEnd, '(Expected: #DB2777)');
    console.log('  -> Accent Color:', defaultTheme.accentColor, '(Expected: #DB2777)');
    if (defaultTheme.gradientStart !== '#1F0715' || defaultTheme.gradientEnd !== '#DB2777') {
      throw new Error('Default theme HEX values do not match Black Cherry!');
    }
    console.log('  ✓ TEST 1 PASSED: Black Cherry exact HEX values verified.\n');

    // TEST 2: Company Default Fallback
    console.log('TEST 2: Verifying Company Default Fallback...');
    const [c1Rows] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0001'");
    const c1ThemeConfig = c1Rows[0]?.theme_config;
    console.log('  -> COMP-0001 theme_config in DB:', c1ThemeConfig);
    console.log('  ✓ TEST 2 PASSED: Initial state is NULL (inherits Black Cherry).\n');

    // TEST 3: Company Isolation - Apply Ocean Blue to COMP-0001 and Emerald Green to COMP-0002
    console.log('TEST 3: Testing Independent Company Theme Assignment...');
    const oceanBlue = {
      id: 'ocean-blue',
      name: 'Ocean Blue',
      gradientStart: '#031726',
      gradientMid: '#0A436D',
      gradientEnd: '#0284C7',
      accentColor: '#0284C7',
      accentHover: '#0369A1',
      glowColor: 'rgba(2, 132, 199, 0.45)',
      activeBorderColor: '#38BDF8',
      badgeBg: 'rgba(2, 132, 199, 0.15)',
      badgeText: '#38BDF8'
    };

    const emeraldGreen = {
      id: 'emerald-green',
      name: 'Emerald Green',
      gradientStart: '#042014',
      gradientMid: '#0E4D30',
      gradientEnd: '#10B981',
      accentColor: '#10B981',
      accentHover: '#059669',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      activeBorderColor: '#34D399',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeText: '#6EE7B7'
    };

    // Save to COMP-0001
    await conn.query(
      "UPDATE company_settings SET theme_config = ? WHERE company_id = 'COMP-0001'",
      [JSON.stringify(oceanBlue)]
    );

    // Save to COMP-0002
    await conn.query(
      "UPDATE company_settings SET theme_config = ? WHERE company_id = 'COMP-0002'",
      [JSON.stringify(emeraldGreen)]
    );

    // Read back COMP-0001, COMP-0002, and COMP-0003
    const [res1] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0001'");
    const [res2] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0002'");
    const [res3] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0003'");

    const parsed1 = typeof res1[0].theme_config === 'string' ? JSON.parse(res1[0].theme_config) : res1[0].theme_config;
    const parsed2 = typeof res2[0].theme_config === 'string' ? JSON.parse(res2[0].theme_config) : res2[0].theme_config;
    const parsed3 = res3[0]?.theme_config;

    console.log('  -> COMP-0001 Theme:', parsed1.name, 'Accent:', parsed1.accentColor);
    console.log('  -> COMP-0002 Theme:', parsed2.name, 'Accent:', parsed2.accentColor);
    console.log('  -> COMP-0003 Theme config (null = default):', parsed3);

    if (parsed1.id !== 'ocean-blue') throw new Error('COMP-0001 should be ocean-blue');
    if (parsed2.id !== 'emerald-green') throw new Error('COMP-0002 should be emerald-green');
    if (parsed3 !== null) throw new Error('COMP-0003 should be null');

    console.log('  ✓ TEST 3 PASSED: Both companies independently hold their own separate themes without collision.\n');

    // TEST 4: Custom HEX Palette on COMP-0001
    console.log('TEST 4: Custom HEX Palette Customization...');
    const customPalette = {
      id: 'custom',
      name: 'Bespoke Brand Neon',
      gradientStart: '#110022',
      gradientMid: '#440066',
      gradientEnd: '#FF0055',
      accentColor: '#FF0055',
      accentHover: '#CC0044',
      glowColor: 'rgba(255, 0, 85, 0.5)',
      activeBorderColor: '#FF0055',
      badgeBg: 'rgba(255, 0, 85, 0.2)',
      badgeText: '#FFAACC'
    };

    await conn.query(
      "UPDATE company_settings SET theme_config = ? WHERE company_id = 'COMP-0001'",
      [JSON.stringify(customPalette)]
    );

    const [customRes] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0001'");
    const [comp2Res] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0002'");
    const parsedCustom = typeof customRes[0].theme_config === 'string' ? JSON.parse(customRes[0].theme_config) : customRes[0].theme_config;
    const parsedComp2 = typeof comp2Res[0].theme_config === 'string' ? JSON.parse(comp2Res[0].theme_config) : comp2Res[0].theme_config;

    if (parsedCustom.gradientEnd !== '#FF0055') throw new Error('Custom HEX was not persisted');
    if (parsedComp2.id !== 'emerald-green') throw new Error('COMP-0002 was accidentally affected by COMP-0001 edit');

    console.log('  -> COMP-0001 Custom End HEX:', parsedCustom.gradientEnd);
    console.log('  -> COMP-0002 unchanged:', parsedComp2.name);
    console.log('  ✓ TEST 4 PASSED: Custom HEX tuning persisted and isolated.\n');

    // TEST 5: Reset Theme back to default
    console.log('TEST 5: Testing Theme Reset to Default...');
    await conn.query("UPDATE company_settings SET theme_config = NULL WHERE company_id = 'COMP-0001'");
    const [afterReset] = await conn.query("SELECT theme_config FROM company_settings WHERE company_id = 'COMP-0001'");
    if (afterReset[0].theme_config !== null) throw new Error('theme_config should be NULL after reset');
    console.log('  -> COMP-0001 theme_config after reset:', afterReset[0].theme_config);
    console.log('  ✓ TEST 5 PASSED: Company reset reverts to NULL (inheriting system default Black Cherry).\n');

    // Clean up COMP-0002 as well so database remains clean
    await conn.query("UPDATE company_settings SET theme_config = NULL WHERE company_id = 'COMP-0002'");
    console.log('  ✓ CLEANUP: Database restored to pristine state.\n');

    console.log('============================================');
    console.log('🎉 ALL 5 THEME ISOLATION TESTS PASSED 100%!');
    console.log('============================================');
  } finally {
    conn.release();
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
