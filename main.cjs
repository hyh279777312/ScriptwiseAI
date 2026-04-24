const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ScriptwiseAI",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // 如果是开发环境，加载 Vite 地址；如果是生产环境，加载打包后的文件
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    // 生产环境加载 dist 目录下的静态文件
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    
    // 【调试神器】：我帮你加了这一行，打包后会自动打开 F12 开发者工具
    // 如果依然白屏，请把控制台（Console）里红色的报错文字发给我。
    // （等你确认软件能完美运行后，可以删掉或注释掉这一行再重新打包一次）
    //win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});