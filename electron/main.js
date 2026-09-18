const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextServerProcess;
const PORT = process.env.PORT || 3000;

function checkServerReady(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          tryAgain();
        }
      }).on('error', (err) => {
        tryAgain();
      });
    };

    const tryAgain = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Server start timeout'));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

function startNextServer() {
  const isDev = !app.isPackaged;
  if (isDev) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath();
    const nextBin = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');

    nextServerProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
      cwd: appPath,
      env: { 
        ...process.env, 
        ELECTRON_RUN_AS_NODE: '1', 
        NODE_ENV: 'production', 
        PORT: String(PORT) 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    nextServerProcess.on('error', (err) => {
      console.error('Failed to start Next.js process:', err);
      reject(err);
    });

    checkServerReady(`http://localhost:${PORT}`)
      .then(resolve)
      .catch(reject);
  });
}

async function createWindow() {
  const isDev = !app.isPackaged;
  const baseUrl = `http://localhost:${PORT}`;
  const startUrl = process.env.ELECTRON_START_URL || `${baseUrl}/dashboard`;

  if (!isDev) {
    try {
      await startNextServer();
    } catch (err) {
      console.error('Error starting server:', err);
    }
  } else {
    try {
      await checkServerReady(baseUrl, 15000);
    } catch (e) {
      console.log('Waiting for dev server...');
    }
  }

  // Pre-set admin authentication session cookie so app opens directly logged in as Admin
  try {
    await session.defaultSession.cookies.set({
      url: baseUrl,
      name: 'auth_role',
      value: 'admin',
      path: '/'
    });
  } catch (cookieErr) {
    console.error('Failed to set auto-login cookie:', cookieErr);
  }

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'Billy - Billing Software',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  // Ensure window title is always Billy - Billing Software
  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load URL:', errorCode, errorDescription);
    mainWindow.loadURL(`data:text/html,<h2>Starting Billy...</h2><p>Please wait...</p>`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (nextServerProcess) {
    nextServerProcess.kill();
  }
});
