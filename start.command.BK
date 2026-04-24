#!/bin/bash

# 1. 获取当前脚本所在的绝对路径（这行代码是“随意移动”的魔法）
DIR="$( cd "$( dirname "$0" )" && pwd )"

# 2. 进入项目目录
cd "$DIR"

# 3. 将本地的独立 node_env 临时加入环境变量（绝对不污染系统）
export PATH="$DIR/node_env/bin:$PATH"

# 4. 打印提示信息
echo "====================================="
echo "正在启动 ScriptwiseAI 本地服务器..."
echo "当前运行目录: $DIR"
echo "====================================="

# 5. 启动 Vite 开发服务器
npm run dev -- --open