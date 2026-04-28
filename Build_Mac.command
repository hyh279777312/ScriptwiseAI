#!/bin/bash
# 切换到脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================"
echo "    开始打包 Mac 客户端 (App & DMG)  "
echo "================================"

# 本地独立环境目录
NODE_ENV_DIR="$DIR/node_env"

# 如果独立的 Node.js 目录不存在，则创建并下载便携版（不影响系统）
if [ ! -d "$NODE_ENV_DIR/bin" ]; then
    echo "未检测到本地独立的 Node.js 环境，准备初始化 node_env..."
    mkdir -p "$NODE_ENV_DIR"
    
    # 检测架构以决定下载哪个包
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        NODE_TAR="node-v22.14.0-darwin-arm64.tar.gz"
    else
        NODE_TAR="node-v22.14.0-darwin-x64.tar.gz"
    fi
    NODE_URL="https://nodejs.org/dist/v22.14.0/$NODE_TAR"
    
    echo "正在下载便携版 Node.js ($NODE_TAR)，此操作不会修改您的系统环境..."
    curl -# -O "$NODE_URL"
    
    echo "下载完成，正在解压到 $NODE_ENV_DIR..."
    tar -xzf "$NODE_TAR" -C "$NODE_ENV_DIR" --strip-components=1
    rm "$NODE_TAR"
    echo "便携版 Node.js 初始化完成！"
fi

# 将本地便携版的 Node.js 添加到 PATH 的最前列，确保优先使用且不污染系统
export PATH="$NODE_ENV_DIR/bin:$PATH"

echo "环境检测通过，当前 Node.js 版本: $(node -v)"

echo ""
echo "=== 检查运行依赖 ==="
# 检查 node_modules 依赖是否完整已安装
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/electron-builder" ]; then
    echo "未检测到完整的组件依赖模块 (于本地 node_env 隔离环境中执行)..."
    echo "正在安装打包所需的依赖，请耐心等待..."
    npm install --no-audit --no-fund --verbose
fi

echo ""
echo "=== 开始打包 ==="
echo "正在使用 electron-builder 打包项目为 APP 和 dmg..."
npm run electron:pack

echo "================================"
echo "          打包完成！            "
echo "  应用安装包已放在 release 文件夹下 "
echo "================================"
