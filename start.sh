#!/bin/bash

# 个人任务管理系统启动脚本

set -e

echo "🚀 启动个人任务管理系统..."

MODE=${1:-prod}
if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    echo "❌ 错误: 运行模式仅支持 dev 或 prod"
    exit 1
fi
echo "⚙️ 当前模式: $MODE"

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: Python3 未安装"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

# 检查MySQL是否运行
if ! pgrep -x "mysqld" > /dev/null; then
    echo "❌ 错误: MySQL 服务未运行，请先启动MySQL"
    exit 1
fi

echo "✅ 环境检查通过"

# 启动后端
echo "📡 启动后端服务..."
cd backend
VENV_DIR=".venv"
if [ -d "venv" ] && [ ! -d "$VENV_DIR" ]; then
    VENV_DIR="venv"
fi

if command -v uv >/dev/null 2>&1; then
    echo "🛠 使用 uv 管理后端依赖..."
    if [ ! -d "$VENV_DIR" ]; then
        uv venv "$VENV_DIR"
    fi
    source "$VENV_DIR/bin/activate"
    uv sync --frozen --no-dev
else
    echo "⚠️ 未检测到 uv，回退 pip 安装（建议先安装 uv）"
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
    fi
    source "$VENV_DIR/bin/activate"
    pip install -r requirements.txt
fi

# 后台启动Flask应用
nohup python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
cd ..

# 启动前端
echo "🌐 启动前端服务..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

FRONTEND_CMD=(npm run dev -- --host 0.0.0.0 --port 3000)
FRONTEND_LABEL="前端开发服务"

if [ "$MODE" = "prod" ]; then
    echo "🛠️ 构建前端生产资源..."
    chmod +x node_modules/.bin/vite 2>/dev/null || true
    npm run build
    FRONTEND_CMD=(npm run preview -- --host 0.0.0.0 --port 3000)
    FRONTEND_LABEL="前端预览服务"
fi

nohup "${FRONTEND_CMD[@]}" > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ $FRONTEND_LABEL 已启动 (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "🎉 系统启动完成！"
echo "📊 前端地址: http://localhost:3000"
if [ "$MODE" = "prod" ]; then
    echo "   （已构建生产资源，使用 Vite Preview 提供服务）"
else
    echo "   （开发模式，启用热更新）"
fi
echo "🔧 后端API: http://localhost:5000/api"
echo ""
echo "📝 日志文件:"
echo "   - 后端日志: backend.log"
echo "   - 前端日志: frontend.log"
echo ""
echo "🛑 停止服务: kill $BACKEND_PID $FRONTEND_PID"

# 保存PID到文件
echo "$BACKEND_PID $FRONTEND_PID" > .pids

echo "💡 提示: 使用 ./stop.sh 停止所有服务"
