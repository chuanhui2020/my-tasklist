#!/bin/bash

# 个人任务管理系统停止脚本

echo "🛑 停止个人任务管理系统..."

# 读取PID文件
if [ -f ".pids" ]; then
    PIDS=$(cat .pids)
    echo "正在停止服务 (PIDs: $PIDS)"
    
    for PID in $PIDS; do
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ 已停止进程 $PID"
        else
            echo "⚠️  进程 $PID 已经停止"
        fi
    done
    
    rm .pids
else
    echo "⚠️  未找到PID文件，尝试查找相关进程..."
    
    # 查找并停止Flask进程
    FLASK_PID=$(pgrep -f "python.*app.py")
    if [ ! -z "$FLASK_PID" ]; then
        kill $FLASK_PID
        echo "✅ 已停止Flask服务 (PID: $FLASK_PID)"
    fi
    
    # 查找并停止Node.js进程
    NODE_PID=$(pgrep -f "node.*vite")
    if [ ! -z "$NODE_PID" ]; then
        kill $NODE_PID
        echo "✅ 已停止前端服务 (PID: $NODE_PID)"
    fi
fi

# 清理日志文件（可选）
if [ "$1" = "--clean-logs" ]; then
    rm -f backend.log frontend.log
    echo "🧹 已清理日志文件"
fi

echo "✅ 系统已停止"