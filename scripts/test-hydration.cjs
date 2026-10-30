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

  win.webContents.on('console-message', (e, level, msg, line, src) => {
    console.log(`[CLIENT CONSOLE] ${msg} (${src}:${line})`);
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
  await new Promise(r => setTimeout(r, 4000));

  const checkHydration = await win.webContents.executeJavaScript(`
    ({
      reactRoot: !!document.querySelector('#__next') || !!document.querySelector('body > div'),
      scripts: Array.from(document.querySelectorAll('script')).map(s => s.src),
      headerHtml: document.querySelector('header')?.outerHTML,
      sidebarHtml: document.querySelector('aside')?.outerHTML
    })
  `);
  console.log('checkHydration scripts count:', checkHydration.scripts.length);
  console.log('Scripts:', checkHydration.scripts);
  console.log('Header HTML:', checkHydration.headerHtml);

  app.quit();
});
