const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'electron', 'local-mysql-preload.cjs')
    }
  });

  await win.loadURL('http://127.0.0.1:3000/login');
  await new Promise(r => setTimeout(r, 1000));

  await win.webContents.executeJavaScript(`
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'company-2', password: 'company-2' })
    })
  `);

  await win.loadURL('http://127.0.0.1:3000/dashboard');
  await new Promise(r => setTimeout(r, 3000));

  const domCheck = await win.webContents.executeJavaScript(`
    ({
      headerRoleText: document.querySelector('header .text-right')?.innerText,
      sidebarRoleText: document.querySelector('aside .border-t')?.innerText,
      dateText: document.querySelector('header span.text-xs')?.innerText,
      allText: document.body.innerText
    })
  `);
  console.log('DOM check (width 1366):', domCheck);

  // Now test /sales
  await win.loadURL('http://127.0.0.1:3000/sales');
  await new Promise(r => setTimeout(r, 3000));
  const salesDom = await win.webContents.executeJavaScript(`
    ({
      h1: document.querySelector('h1')?.innerText,
      tableRows: document.querySelectorAll('tbody tr').length,
      bodyTextSnippet: document.body.innerText.slice(0, 300)
    })
  `);
  console.log('Sales DOM check:', salesDom);

  // Now test /settings
  await win.loadURL('http://127.0.0.1:3000/settings');
  await new Promise(r => setTimeout(r, 3000));
  const settingsDom = await win.webContents.executeJavaScript(`
    ({
      h1: document.querySelector('h1')?.innerText,
      tabs: Array.from(document.querySelectorAll('nav button')).map(b => b.innerText),
      bodyTextSnippet: document.body.innerText.slice(0, 300)
    })
  `);
  console.log('Settings DOM check:', settingsDom);

  app.quit();
});
