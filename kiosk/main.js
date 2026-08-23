const { app, BrowserWindow, screen } = require('electron');

// ============================================================
// Digital Signage Player (Kiosk Mode)
// ============================================================
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://display.rizki-tech.com/player';

let mainWindow = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    frame: false,
    kiosk: true,
    autoHideMenuBar: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(PLATFORM_URL);

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => mainWindow.loadURL(PLATFORM_URL), 5000);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('* { cursor: none !important; }');
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('render-process-gone', () => {
    setTimeout(() => mainWindow.loadURL(PLATFORM_URL), 2000);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('window-all-closed', (e) => { e.preventDefault(); createWindow(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', (e) => { e.preventDefault(); });
process.on('uncaughtException', () => {});

console.log(`[Kiosk] Digital Signage Player — ${PLATFORM_URL}`);
