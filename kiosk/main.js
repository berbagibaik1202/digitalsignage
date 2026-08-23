const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================================
// Digital Signage Player (Electron)
// ============================================================

const WEB_URL = 'https://display.rizki-tech.com/player';
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
    },
  });

  // Try local build first, then fallback to web
  const localPath = path.join(__dirname, '..', 'player', 'dist', 'index.html');

  if (fs.existsSync(localPath)) {
    console.log('[Player] Loading from local build...');
    mainWindow.loadFile(localPath);
  } else {
    console.log('[Player] Loading from web:', WEB_URL);
    mainWindow.loadURL(WEB_URL);
  }

  // Handle load errors - retry
  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.log(`[Player] Load failed: ${code} - ${desc}, retrying...`);
    setTimeout(() => {
      if (fs.existsSync(localPath)) {
        mainWindow.loadFile(localPath);
      } else {
        mainWindow.loadURL(WEB_URL);
      }
    }, 3000);
  });

  // Hide cursor when loaded
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('body, html { cursor: none !important; overflow: hidden; }');
  });

  // Prevent opening new windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();

  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Prevent app from quitting
app.on('before-quit', (e) => { e.preventDefault(); });

process.on('uncaughtException', (err) => {
  console.error('[Player] Error:', err);
});

console.log('[Player] Digital Signage Player (Electron)');
