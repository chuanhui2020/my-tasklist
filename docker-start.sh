#!/bin/bash

# Docker Compose 快速启动脚本

set -e

echo "🚀 启动任务管理系统 (Docker Compose)"
echo "======================================"

# 检查 Docker 和 Docker Compose 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请访问 https://docs.docker.com/get-docker/ 安装 Docker"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装或版本过低"
    echo "请确保安装了 Docker Compose V2"
    exit 1
fi

echo "✅ Docker 环境检查通过"

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ 错误: 未找到 .env 文件"
    echo ""
    echo "请按以下步骤创建配置文件："
    echo ""
    echo "1. 复制模板文件："
    echo "   cp .env.example .env"
    echo ""
    echo "2. 编辑 .env 文件，修改以下配置（重要！）："
    echo "   - MYSQL_ROOT_PASSWORD  (设置强密码)"
    echo "   - MYSQL_PASSWORD       (设置强密码)"
    echo "   - SECRET_KEY           (生成随机密钥)"
    echo ""
    echo "3. 生成随机密钥的方法："
    echo "   openssl rand -hex 32"
    echo "   或"
    echo "   python -c \"import secrets; print(secrets.token_hex(32))\""
    echo ""
    echo "4. 完成后重新运行此脚本"
    echo ""
    exit 1
fi

# 启动服务
echo ""
echo "📦 构建并启动服务..."
docker compose up -d --build

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态："
docker compose ps

# 检查健康状态
echo ""
echo "🏥 健康检查："
BACKEND_HEALTHY=$(docker inspect --format='{{.State.Health.Status}}' tasklist-backend 2>/dev/null || echo "unknown")
FRONTEND_HEALTHY=$(docker inspect --format='{{.State.Health.Status}}' tasklist-frontend 2>/dev/null || echo "unknown")

echo "   后端服务: $BACKEND_HEALTHY"
echo "   前端服务: $FRONTEND_HEALTHY"

# 显示访问信息
echo ""
echo "======================================"
echo "🎉 系统启动完成！"
echo "======================================"
echo ""
echo "📱 访问地址："
echo "   前端: http://localhost:3000"
echo "   API:  http://localhost:3000/api"
echo ""
echo "👤 默认管理员账号："
echo "   用户名: admin"
echo "   密码:   123456"
echo ""
echo "📝 常用命令："
echo "   查看日志:     docker compose logs -f"
echo "   查看后端日志: docker compose logs -f backend"
echo "   查看前端日志: docker compose logs -f frontend"
echo "   停止服务:     docker compose down"
echo "   重启服务:     docker compose restart"
echo "   进入数据库:   docker compose exec db mysql -u root -p"
echo ""
echo "💾 数据备份："
echo "   docker compose exec db mysqldump -u root -p\$MYSQL_ROOT_PASSWORD tasklist_db > backup.sql"
echo ""
echo "🔧 如果服务未正常启动，请查看日志排查问题"
