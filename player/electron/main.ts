import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Hide cursor
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.insertCSS('* { cursor: none !important; }');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-device-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: require('os').hostname(),
  };
});

ipcMain.handle('exit-app', () => {
  app.quit();
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  }
});

ipcMain.handle('take-screenshot', async () => {
  if (!mainWindow) return null;
  const image = await mainWindow.webContents.capturePage();
  return image.toDataURL();
});
