const puppeteer = require('puppeteer-core');

(async () => {
  console.log("Starting E2E Test for Unified Bill Numbering using Edge...");
  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Clear DB
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  await fetch('http://localhost:3000/api/test-db', { method: 'POST', body: JSON.stringify({ action: 'clear_sales' }), headers: { 'Content-Type': 'application/json' } }).catch(()=>{});

  // Create a helper to checkout
  async function checkout() {
    await page.goto('http://localhost:3000/terminal', { waitUntil: 'networkidle0' });
    // Click first product
    await page.waitForSelector('.group.relative.flex.cursor-pointer', { timeout: 5000 });
    await page.click('.group.relative.flex.cursor-pointer');
    
    // Click cash payment
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const cashBtn = btns.find(b => b.textContent.includes('Cash') && b.querySelector('.lucide-banknote'));
        if(cashBtn) cashBtn.click();
    });
    
    // Click checkout
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const checkoutBtn = btns.find(b => b.textContent.includes('CHECKOUT'));
        if(checkoutBtn) checkoutBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 500));
    
    // If cash modal, click complete
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b => b.textContent.includes('Complete Sale'));
        if(submitBtn) {
            submitBtn.click();
        }
    });
    await new Promise(r => setTimeout(r, 1000)); 
  }

  async function getSales() {
    await page.goto('http://localhost:3000/sales', { waitUntil: 'networkidle0' });
    return await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tbody tr')).map(tr => {
         const tds = tr.querySelectorAll('td');
         if(tds.length < 5) return null;
         return { id: tds[0].innerText, status: tds[4].innerText };
      }).filter(Boolean);
    });
  }

  // Clear Zustand store by clearing localStorage
  await page.goto('http://localhost:3000/terminal', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());

  console.log("1. Creating online bills 1 and 2...");
  await checkout();
  await checkout();
  
  let sales = await getSales();
  console.log("Online Bills:", sales.slice(0, 2).map(s => s.id));

  console.log("2. Disconnecting internet and creating offline bills 3 and 4...");
  await page.setOfflineMode(true);
  
  await checkout();
  await checkout();

  sales = await getSales();
  console.log("Sales & Bills (Combined view):", sales.slice(0, 4).map(s => s.id));

  await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle0' });
  // Need to click View Local Bills
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const viewBtn = btns.find(b => b.textContent.includes('View Local Bills'));
    if(viewBtn) viewBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  let offlineBills = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.innerText).filter(t => t.includes('PENDING'));
  });
  console.log("Pending bills in local storage:", offlineBills.length);

  console.log("3. Reconnecting internet and syncing...");
  await page.setOfflineMode(false);
  await page.goto('http://localhost:3000/terminal', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 5000)); // wait for sync interval

  sales = await getSales();
  console.log("Sales & Bills after sync:", sales.slice(0, 4).map(s => s.id + ' -> ' + s.status));
  
  console.log("4. Creating bill 5 online...");
  await checkout();
  
  sales = await getSales();
  console.log("Final top 5 Bills:", sales.slice(0, 5).map(s => s.id));

  await browser.close();
  console.log("E2E Test Complete.");
})();
