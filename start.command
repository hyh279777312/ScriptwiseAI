#!/bin/bash

# 1. 获取当前脚本所在的绝对路径
DIR="$( cd "$( dirname "$0" )" && pwd )"
cd "$DIR"

# 2. 定义变量
REQUIRED_NODE="v24.15.0"
NODE_PKG="$DIR/node-v24.15.0.pkg"

# 3. 环境检测函数
check_node() {
    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v)
        if [ "$CURRENT_NODE" == "$REQUIRED_NODE" ]; then
            return 0 # 版本匹配
        else
            return 2 # 版本不匹配
        fi
    else
        return 1 # 未安装
    fi
}

# 4. 执行检测逻辑
check_node
STATUS=$?

if [ $STATUS -ne 0 ]; then
    echo "====================================="
    if [ $STATUS -eq 1 ]; then
        MSG="检测到您的系统尚未安装 Node.js ($REQUIRED_NODE)。"
    else
        MSG="检测到系统 Node 版本为 $CURRENT_NODE，项目需要 $REQUIRED_NODE。"
    fi
    echo "$MSG"
    
    # 弹出 macOS 原生对话框确认安装
    osascript -e "display dialog \"$MSG\n\n点击‘确定’将自动安装环境包，过程中请按提示输入电脑开机密码。\" buttons {\"取消\", \"确定\"} default button \"确定\" with title \"环境配置提示\""
    
    if [ $? -eq 0 ]; then
        if [ -f "$NODE_PKG" ]; then
            echo "正在启动安装程序，请在弹出的系统窗口中输入密码..."
            # 使用 AppleScript 触发带权限的安装，体验比直接 sudo 更好
            osascript -e "do shell script \"installer -pkg '$NODE_PKG' -target /\" with administrator privileges"
            
            if [ $? -eq 0 ]; then
                echo "✅ 环境安装成功！"
            else
                echo "❌ 安装被取消或失败，程序无法继续。"
                exit 1
            fi
        else
            osascript -e "display alert \"错误\" message \"在目录中未找到安装包：node-v24.15.0.pkg\n请确保安装包与脚本在同一目录下。\""
            exit 1
        fi
    else
        echo "用户取消安装，退出程序。"
        exit 1
    fi
fi

# 5. 将本地 node_env 加入环境变量（如果你的 node_env 是预装好的二进制）
export PATH="$DIR/node_env/bin:$PATH"

# 6. 启动提示
echo "====================================="
echo "✅ 环境检查通过: $REQUIRED_NODE"
echo "正在启动 ScriptwiseAI 本地服务器..."
echo "当前运行目录: $DIR"
echo "====================================="

# 7. 启动项目
npm run dev -- --open