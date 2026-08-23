const { app, BrowserWindow, screen, session } = require('electron');
const path = require('path');

// ============================================================
// Digital Signage Kiosk Browser
// Configure URL below or set via environment variable
// ============================================================
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://display.rizki-tech.com';

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

  // Load the platform URL
  mainWindow.loadURL(PLATFORM_URL);

  // Handle loading errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Kiosk] Load failed: ${errorCode} - ${errorDescription}`);
    // Retry after 5 seconds
    setTimeout(() => {
      mainWindow.loadURL(PLATFORM_URL);
    }, 5000);
  });

  // Hide cursor
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('* { cursor: none !important; }');
  });

  // Prevent new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Handle crashes
  mainWindow.webContents.on('render-process-gone', () => {
    console.error('[Kiosk] Renderer crashed, restarting...');
    setTimeout(() => {
      mainWindow.loadURL(PLATFORM_URL);
    }, 2000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Prevent app from closing when all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault();
    createWindow();
  });

  // Auto-restart on activate (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Prevent app from quitting
app.on('before-quit', (e) => {
  e.preventDefault();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Kiosk] Uncaught exception:', error);
});

console.log(`[Kiosk] Starting Digital Signage Kiosk Browser`);
console.log(`[Kiosk] URL: ${PLATFORM_URL}`);
