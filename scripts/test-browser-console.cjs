const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE_ERROR] ${err.toString()}`);
  });

  // Navigate to login
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle2' });
  console.log('Opened login page, title:', await page.title());

  // Type credentials for company-2
  await page.type('input[type="text"], input[name="username"]', 'company-2');
  await page.type('input[type="password"]', 'company-2');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log('Nav timeout:', e.message));

  console.log('Current URL after login:', page.url());

  // Wait 3 seconds to let client components mount
  await new Promise(r => setTimeout(r, 3000));

  const content = await page.content();
  console.log('Dashboard content includes "Company Admin":', content.includes('Company Admin'));
  console.log('Dashboard content includes "Loading...":', content.includes('Loading...'));

  console.log('\n--- BROWSER CONSOLE LOGS ---');
  consoleLogs.forEach(log => console.log(log));

  // Navigate to /sales
  console.log('\nNavigating to /sales...');
  await page.goto('http://127.0.0.1:3000/sales', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const salesContent = await page.content();
  console.log('/sales includes "Sales & Bills":', salesContent.includes('Sales &amp; Bills') || salesContent.includes('Sales & Bills'));

  // Navigate to /settings
  console.log('\nNavigating to /settings...');
  await page.goto('http://127.0.0.1:3000/settings', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const settingsContent = await page.content();
  console.log('/settings includes "Settings":', settingsContent.includes('Settings'));

  await browser.close();
}

main().catch(err => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
