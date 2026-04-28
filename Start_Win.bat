@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ================================
echo     启动应用与环境检测 (Windows)
echo ================================

set "NODE_ENV_DIR=%~dp0node_env"

IF NOT EXIST "%NODE_ENV_DIR%\node.exe" (
    echo 未检测到本地独立的 Node.js 环境，准备初始化 node_env...
    
    REM 默认下载 64 位版本，若系统为 ARM64 也可以判断，但 x64 兼容性最广
    set "NODE_ARCH=x64"
    if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"
    
    set "NODE_ZIP=node-v22.14.0-win-!NODE_ARCH!.zip"
    set "NODE_URL=https://nodejs.org/dist/v22.14.0/!NODE_ZIP!"
    
    echo 正在下载便携版 Node.js (!NODE_ZIP!)，此操作不会修改您的系统环境...
    curl -# -O "!NODE_URL!"
    
    IF NOT EXIST "!NODE_ZIP!" (
        echo 下载失败，请检查网络连接！
        pause
        exit /b 1
    )
    
    echo 下载完成，正在解压...
    powershell -Command "Expand-Archive -Path '!NODE_ZIP!' -DestinationPath '%~dp0node_temp' -Force"
    
    echo 正在配置目录...
    mkdir "%NODE_ENV_DIR%" 2>nul
    xcopy /E /Y "%~dp0node_temp\node-v22.14.0-win-!NODE_ARCH!\*" "%NODE_ENV_DIR%\" >nul
    
    echo 清理临时文件...
    rmdir /S /Q "%~dp0node_temp"
    del "!NODE_ZIP!"
    
    echo 便携版 Node.js 初始化完成！
)

REM 设置环境变量，将便携版 Node.js 放在 PATH 最前面，确保优先使用且不污染系统
set "PATH=%NODE_ENV_DIR%;%PATH%"

echo.
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo 环境检测通过，当前 Node.js 版本: !NODE_VERSION!

echo.
echo === 检查运行依赖 ===
IF NOT EXIST "%~dp0node_modules\.bin\vite.cmd" (
    echo 未检测到完整的组件依赖模块 ^(于本地 node_env 隔离环境中执行^)...
    echo 注意: 首次安装或恢复安装需要下载约100MB+的核心组件^(如 Electron^)，通常需要 2~5 分钟视网络情况而定。
    echo 请耐心等待，切勿过早关闭此窗口... 接下来将为您显示详细的安装进度日志：
    call npm install --no-audit --no-fund --verbose
)

echo.
echo === 启动应用 ===
echo 正在启动服务并在浏览器中打开网页，请稍候...
call npm run dev -- --open

pause
