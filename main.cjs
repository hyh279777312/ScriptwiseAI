const { app, BrowserWindow, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

let mainWindow;
let serverInstance;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  Menu.setApplicationMenu(null);

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Start local express server to avoid file:// protocol issues with Firebase Auth
    if (!serverInstance) {
      const serverApp = express();
      const distPath = path.join(__dirname, 'dist');
      serverApp.use(express.static(distPath));
      serverApp.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      serverInstance = serverApp.listen(3000, '0.0.0.0', () => {
        mainWindow.loadURL(`http://localhost:3000`);
      }).on('error', (e) => {
        // Fallback to random port if 3000 is in use
        serverInstance = serverApp.listen(0, '0.0.0.0', () => {
          const port = serverInstance.address().port;
          mainWindow.loadURL(`http://localhost:${port}`);
        });
      });
    } else {
      const port = serverInstance.address().port;
      mainWindow.loadURL(`http://localhost:${port}`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle popups correctly for Firebase Auth
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true
        }
      }
    };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
