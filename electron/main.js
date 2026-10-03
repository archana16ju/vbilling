const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

function ensureOfflineStorageFolders() {
  const legacyConfigPath = path.join(os.homedir(), '.billing-software', 'storage-config.json');
  const legacyLocation = path.join(os.homedir(), '.billing-software', 'BillingOfflineStorage');
  const appDataLocation = path.join(app.getPath('userData'), 'BillingOfflineStorage');
  
  let location = appDataLocation;

  try {
    if (fs.existsSync(legacyConfigPath)) {
      const config = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));
      if (config && config.location) {
        location = config.location;
      }
    } else if (fs.existsSync(legacyLocation)) {
      // Preserve existing data if it was already created at the legacy path
      location = legacyLocation;
    }
  } catch (err) {
    console.error('Failed to read storage config in main:', err);
  }

  // Store the resolved location so Next.js can use the exact same path
  process.env.OFFLINE_STORAGE_PATH = location;

  const dirs = [
    path.join(location, 'cache', 'products', 'images'),
    path.join(location, 'cache', 'categories', 'images'),
    path.join(location, 'offline', 'pending-bills'),
    path.join(location, 'sync', 'queue'),
    path.join(location, 'metadata'),
    path.join(location, 'database'),
    path.join(location, 'updates')
  ];

  dirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err);
    }
  });

  // Ensure update_state.json exists
  const statePath = path.join(location, 'update_state.json');
  if (!fs.existsSync(statePath)) {
    try {
      fs.writeFileSync(statePath, JSON.stringify({
        status: 'IDLE',
        currentCommit: 'unknown',
        history: []
      }, null, 2));
    } catch (e) {
      console.error('Failed to init update_state.json:', e);
    }
  }
}

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

    // Parse the .env file explicitly so the packaged app can read the database password
    let customEnv = { ...process.env };
    try {
      const envPath = path.join(appPath, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }
            if (customEnv[key] === undefined) {
              customEnv[key] = value;
            }
          }
        });
        console.log('Successfully loaded .env file in production build');
      }
    } catch (err) {
      console.error('Failed to parse .env file:', err);
    }

    const nodePath = app.isPackaged ? path.join(process.resourcesPath, 'node.exe') : process.execPath;
  nextServerProcess = spawn(nodePath, [nextBin, 'start', '-p', String(PORT)], {
      cwd: appPath,
      env: { 
        ...customEnv, 
        ELECTRON_RUN_AS_NODE: '1', 
        NODE_ENV: 'production', 
        PORT: String(PORT),
        OFFLINE_STORAGE_PATH: process.env.OFFLINE_STORAGE_PATH
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

async function checkInternet() {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 2000);
    require('dns').resolve('skbriyani.vseyal.com', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(!err);
      }
    });
  });
}

async function createWindow() {
  const isDev = !app.isPackaged;
  const baseUrl = `http://localhost:${PORT}`;
  const liveUrl = 'https://skbriyani.vseyal.com';
  
  // Set default to live if online, else local
  const isOnline = await checkInternet();
  const startUrl = process.env.ELECTRON_START_URL || (isOnline ? `${liveUrl}/dashboard` : `${baseUrl}/dashboard`);

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

  // Pre-set admin authentication session cookie so app opens directly logged in as Admin for both local and live
  try {
    await session.defaultSession.cookies.set({ url: baseUrl, name: 'auth_role', value: 'admin', path: '/' });
    await session.defaultSession.cookies.set({ url: liveUrl, name: 'auth_role', value: 'admin', path: '/' });
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
      preload: path.join(__dirname, 'preload.js'),
      allowRunningInsecureContent: true
    },
    autoHideMenuBar: true,
  });

  mainWindow.on('page-title-updated', (e) => {
    e.preventDefault();
  });

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load URL:', validatedURL, errorCode, errorDescription);
    // If live URL fails, fallback to local immediately
    if (validatedURL.includes('vseyal.com')) {
      const fallbackUrl = validatedURL.replace(liveUrl, baseUrl);
      mainWindow.loadURL(fallbackUrl);
    } else {
      mainWindow.loadURL(`data:text/html,<h2>Starting Billy...</h2><p>Please wait...</p>`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-switch between live and local based on internet availability
  setInterval(async () => {
    if (!mainWindow) return;
    
    const currentlyOnline = await checkInternet();
    const currentUrl = mainWindow.webContents.getURL();
    
    let isCurrentlyLive = false;
    let isCurrentlyLocal = false;
    let isErrorPage = false;
    let pathAndSearch = '/dashboard';

    try {
      const currentUrlObj = new URL(currentUrl);
      isCurrentlyLive = currentUrlObj.hostname === 'skbriyani.vseyal.com';
      isCurrentlyLocal = currentUrlObj.hostname === 'localhost' || currentUrlObj.hostname === '127.0.0.1';
      if (isCurrentlyLive || isCurrentlyLocal) {
        pathAndSearch = currentUrlObj.pathname + currentUrlObj.search;
      }
      isErrorPage = currentUrlObj.protocol === 'data:';
    } catch (e) {
      isErrorPage = true;
    }
    
    if (currentlyOnline && (isCurrentlyLocal || isErrorPage)) {
      // Internet is back or recovering from error, switch to live API
      mainWindow.loadURL(`${liveUrl}${pathAndSearch}`);
    } else if (!currentlyOnline && (isCurrentlyLive || isErrorPage)) {
      // Internet lost or recovering from error, switch to local offline API
      mainWindow.loadURL(`${baseUrl}${pathAndSearch}`);
    }
  }, 5000);
}

// --- Auto Updater Setup ---
const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// Configure auto updater
autoUpdater.autoDownload = false; // We want the user to trigger download
autoUpdater.autoInstallOnAppQuit = false;

// IPC Listeners from React
ipcMain.on('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
      if (mainWindow) mainWindow.webContents.send('update-error', err.message);
    });
  } else {
    // Fake response for dev mode
    setTimeout(() => {
      if (mainWindow) mainWindow.webContents.send('update-not-available');
    }, 1000);
  }
});

ipcMain.on('download-update', () => {
  if (app.isPackaged) {
    autoUpdater.downloadUpdate().catch(err => {
      if (mainWindow) mainWindow.webContents.send('update-error', err.message);
    });
  }
});

ipcMain.on('install-update', () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall(false, true);
  }
});

// AutoUpdater Event Forwarding
autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  if (mainWindow) mainWindow.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

app.on('ready', () => {
  ensureOfflineStorageFolders();
  createWindow();
});

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


