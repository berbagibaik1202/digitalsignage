const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// ============================================================
// Digital Signage Player (Electron)
// Loads the React player app from dist/ folder
// ============================================================

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
      webSecurity: false, // Allow loading local files
    },
  });

  // Load the built React player app
  const indexPath = path.join(__dirname, '..', 'player', 'dist', 'index.html');

  // Check if player dist exists
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // Fallback: load from web (for development)
    console.log('[Player] Local build not found, loading from web...');
    mainWindow.loadURL('https://display.rizki-tech.com/player');
  }

  // Handle errors
  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL('https://display.rizki-tech.com/player');
      }
    }, 5000);
  });

  // Hide cursor
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('* { cursor: none !important; }');
  });

  // Prevent new windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('window-all-closed', (e) => { e.preventDefault(); createWindow(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', (e) => { e.preventDefault(); });
process.on('uncaughtException', () => {});

console.log('[Player] Digital Signage Player (Electron)');
