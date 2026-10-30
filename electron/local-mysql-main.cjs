const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

// Enforce single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let nextServerProcess = null;
const DEFAULT_PORT = 3030;

function getUserConfigPath() {
  const configDir = app.getPath('userData');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'connection-config.json');
}

function loadConfig() {
  const cfgPath = getUserConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.port || cfg.port === 3000) {
        cfg.port = DEFAULT_PORT;
      }
      return cfg;
    }
  } catch (e) {
    console.error('Failed to read connection-config.json:', e);
  }
  return {
    mode: 'host', // 'host' or 'client'
    hostUrl: `http://localhost:${DEFAULT_PORT}`,
    port: DEFAULT_PORT
  };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(getUserConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save connection-config.json:', e);
  }
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

function checkServerReady(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            resolve(true);
          } else {
            tryAgain();
          }
        });
        req.on('error', () => tryAgain());
        req.setTimeout(2000, () => {
          req.abort();
          tryAgain();
        });
      } catch (err) {
        tryAgain();
      }
    };

    const tryAgain = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server readiness timed out after ${timeout / 1000}s on ${url}`));
      } else {
        setTimeout(check, 800);
      }
    };

    check();
  });
}

function loadLocalEnv(appPath) {
  const envObj = {};
  const candidatePaths = [
    path.join(appPath, '.env.local'),
    path.join(process.resourcesPath, '.env.local'),
    path.join(process.resourcesPath, 'app', '.env.local'),
    path.join(app.getPath('userData'), 'db-config.json')
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        console.log('[Host Mode] Loading local configuration from:', envPath);
        if (envPath.endsWith('.json')) {
          const json = JSON.parse(fs.readFileSync(envPath, 'utf8'));
          Object.assign(envObj, json);
        } else {
          const content = fs.readFileSync(envPath, 'utf8');
          content.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
              let val = (match[2] || '').trim();
              if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
              if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
              envObj[match[1]] = val;
            }
          });
        }
      }
    } catch (err) {
      console.warn(`[Host Mode] Notice reading ${envPath}:`, err.message);
    }
  }

  const resEnv = path.join(process.resourcesPath, '.env.local');
  const appEnv = path.join(appPath, '.env.local');
  if (fs.existsSync(resEnv) && !fs.existsSync(appEnv)) {
    try {
      fs.copyFileSync(resEnv, appEnv);
      console.log('[Host Mode] Copied .env.local to appPath');
    } catch (e) {
      console.warn('[Host Mode] Could not copy .env.local to appPath:', e.message);
    }
  }

  // Ensure default MySQL host/port/db if not specified
  if (!envObj.MYSQL_HOST) envObj.MYSQL_HOST = '127.0.0.1';
  if (!envObj.MYSQL_PORT) envObj.MYSQL_PORT = '3306';
  if (!envObj.MYSQL_DATABASE) envObj.MYSQL_DATABASE = 'local_billing_db';

  return envObj;
}

function startNextServer(port) {
  const isDev = !app.isPackaged;
  if (isDev) {
    console.log('[Host Mode] Dev environment: expecting external next dev server on port', port);
    return Promise.resolve();
  }

  // If a local server is already running on this port, connect directly
  return checkServerReady(`http://127.0.0.1:${port}`, 1500)
    .then(() => {
      console.log(`[Host Mode] Existing server already detected on port ${port}, reusing it.`);
    })
    .catch(() => {
      return new Promise((resolve, reject) => {
        const appPath = app.getAppPath();
        const nextBin = path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next');
        const nodePath = path.join(process.resourcesPath, 'node.exe');

        console.log('[Host Mode] Starting Next.js server on 0.0.0.0:' + port);

        const localEnv = loadLocalEnv(appPath);

        // Explicitly pass local MySQL environment variables
        const customEnv = {
          ...process.env,
          ...localEnv,
          ELECTRON_RUN_AS_NODE: '1',
          NODE_ENV: 'production',
          PORT: String(port),
          LOCAL_DB_MODE: 'mysql',
          NEXT_PUBLIC_LOCAL_DB_MODE: 'mysql'
        };

        const logPath = path.join(app.getPath('userData'), 'local-mysql-server.log');
        let logStream = null;
        try {
          logStream = fs.createWriteStream(logPath, { flags: 'a' });
          logStream.write(`\n=== Server starting at ${new Date().toISOString()} on port ${port} ===\n`);
        } catch (e) {
          console.error('Could not create log stream:', e);
        }

        const executable = fs.existsSync(nodePath) ? nodePath : process.execPath;
        nextServerProcess = spawn(executable, [
          nextBin,
          'start',
          '-H', '0.0.0.0',
          '-p', String(port)
        ], {
          cwd: appPath,
          env: customEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        nextServerProcess.stdout.on('data', (d) => {
          const s = d.toString();
          console.log('[Next.js]', s.trim());
          if (logStream) try { logStream.write(s); } catch (e) {}
        });

        nextServerProcess.stderr.on('data', (d) => {
          const s = d.toString();
          console.error('[Next.js Error]', s.trim());
          if (logStream) try { logStream.write('[ERROR] ' + s); } catch (e) {}
        });

        nextServerProcess.on('error', (err) => {
          console.error('Failed to spawn Next.js process:', err);
          if (logStream) try { logStream.write('[FATAL] ' + err.message + '\n'); } catch (e) {}
          reject(err);
        });

        nextServerProcess.on('exit', (code, signal) => {
          console.log(`[Next.js] Process exited with code ${code}, signal ${signal}`);
          if (logStream) try { logStream.write(`[EXIT] Code: ${code}, Signal: ${signal}\n`); } catch (e) {}
        });

        checkServerReady(`http://127.0.0.1:${port}`, 60000)
          .then(() => {
            console.log('[Host Mode] Next.js server successfully verified on port', port);
            resolve();
          })
          .catch(reject);
      });
    });
}

function renderConfigSelectionPage(win, currentConfig, errorMsg = '') {
  const localIPs = getLocalIPv4Addresses();
  const ipListHtml = localIPs.map(ip => `<code>http://${ip}:${currentConfig.port || 3000}</code>`).join(' or ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Local MySQL Billing - Network Setup</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; width: 100%; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 22px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    .error { background: #ef444420; border: 1px solid #ef4444; color: #fca5a5; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
    .option-group { margin: 18px 0; display: flex; flex-direction: column; gap: 12px; }
    .radio-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid #475569; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .radio-card:hover { border-color: #38bdf8; background: #33415540; }
    .radio-card input { margin-top: 4px; }
    .field { margin-top: 14px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
    input[type="text"] { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 14px; }
    input[type="text"]:focus { outline: none; border-color: #38bdf8; }
    .btn { background: #0284c7; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 20px; font-size: 15px; }
    .btn:hover { background: #0369a1; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Local MySQL Billing</h2>
    <p>Select how this computer connects to the billing system:</p>
    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
    <form id="setupForm">
      <div class="option-group">
        <label class="radio-card">
          <input type="radio" name="mode" value="host" ${currentConfig.mode === 'host' ? 'checked' : ''} onchange="toggleClientFields(false)">
          <div>
            <strong>Main Computer (Host Server)</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px;">Runs the central database & server. Other LAN computers connect to this machine.</p>
            ${localIPs.length > 0 ? `<p style="margin: 6px 0 0 0; font-size: 12px;">This computer's LAN IP: ${ipListHtml}</p>` : ''}
          </div>
        </label>
        <label class="radio-card">
          <input type="radio" name="mode" value="client" ${currentConfig.mode === 'client' ? 'checked' : ''} onchange="toggleClientFields(true)">
          <div>
            <strong>Client Terminal (Cashier Computer)</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px;">Connects to the Main Computer over Wi-Fi/LAN. Does not need MySQL.</p>
          </div>
        </label>
      </div>
      <div id="clientField" class="field" style="display: ${currentConfig.mode === 'client' ? 'block' : 'none'};">
        <label for="hostUrl">Main Computer Server Address:</label>
        <input type="text" id="hostUrl" name="hostUrl" value="${currentConfig.hostUrl || 'http://192.168.1.100:3030'}" placeholder="http://192.168.1.X:3030">
        <p style="margin: 4px 0 0 0; font-size: 12px;">Enter the IP address shown on the Main Computer's screen.</p>
      </div>
      <button type="submit" class="btn">Connect & Start Billing</button>
    </form>
  </div>
  <script>
    function toggleClientFields(isClient) {
      document.getElementById('clientField').style.display = isClient ? 'block' : 'none';
    }
    document.getElementById('setupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const hostUrl = document.getElementById('hostUrl').value.trim();
      if (window.localMysqlBridge && window.localMysqlBridge.saveConnectionConfig) {
        window.localMysqlBridge.saveConnectionConfig({ mode, hostUrl });
      } else if (typeof require !== 'undefined') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('save-connection-config', { mode, hostUrl });
      }
    });
  </script>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function startApplication() {
  const config = loadConfig();
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    title: 'Local MySQL Billing',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'local-mysql-preload.cjs'),
      allowRunningInsecureContent: true
    },
    autoHideMenuBar: true
  });

  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  ipcMain.on('save-connection-config', async (event, newConfig) => {
    config.mode = newConfig.mode;
    if (newConfig.hostUrl) {
      config.hostUrl = newConfig.hostUrl;
    }
    saveConfig(config);
    await launchTargetPage(config);
  });

  await launchTargetPage(config);
}

async function launchTargetPage(config) {
  if (config.mode === 'host') {
    const port = config.port || DEFAULT_PORT;
    const localUrl = `http://127.0.0.1:${port}/dashboard`;

    const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .spinner { width: 44px; height: 44px; border: 4px solid #27272a; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.9s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    p { margin: 0; color: #a1a1aa; font-size: 14px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Starting Local MySQL Billing...</h2>
  <p>Initializing local billing engine and database connection...</p>
</body>
</html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

    try {
      await startNextServer(port);
      // Once server is up, load application
      mainWindow.loadURL(localUrl);
    } catch (err) {
      console.error('Host server failed to start:', err);
      renderConfigSelectionPage(mainWindow, config, `Failed to start local host server: ${err.message}. Please check if MySQL 8.0.46 is running.`);
    }
  } else {
    // Client mode
    const targetUrl = config.hostUrl ? `${config.hostUrl.replace(/\/$/, '')}/dashboard` : '';
    if (!targetUrl) {
      renderConfigSelectionPage(mainWindow, config, 'Please specify the Main Computer server address.');
      return;
    }

    const clientSplashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .spinner { width: 44px; height: 44px; border: 4px solid #27272a; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.9s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    p { margin: 0; color: #a1a1aa; font-size: 14px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Connecting to Main Computer...</h2>
  <p>Connecting to ${config.hostUrl} over LAN...</p>
</body>
</html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(clientSplashHtml)}`);

    try {
      await checkServerReady(config.hostUrl, 12000);
      mainWindow.loadURL(targetUrl);
    } catch (err) {
      renderConfigSelectionPage(mainWindow, config, `Unable to connect to Main Computer at ${config.hostUrl}. Ensure both computers are on the same Wi-Fi/LAN and Windows Firewall allows port 3030.`);
    }
  }
}

app.on('ready', () => {
  startApplication();
});

app.on('window-all-closed', () => {
  if (nextServerProcess) {
    try { nextServerProcess.kill(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (nextServerProcess) {
    try { nextServerProcess.kill(); } catch (e) {}
  }
});
