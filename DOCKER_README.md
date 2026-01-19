# Docker 快速参考

## 快速启动

```bash
# 方式1：使用启动脚本（推荐）
# 1. 创建配置文件
cp .env.example .env
# 2. 编辑 .env 修改密码和密钥
nano .env
# 3. 运行启动脚本
./docker-start.sh

# 方式2：手动启动
cp .env.example .env
# 编辑 .env 文件修改密码...
docker compose up -d --build
```

访问：http://localhost:3000

默认账号：`admin` / `123456`

## 常用命令

```bash
# 启动
docker compose up -d

# 停止
docker compose down

# 重启
docker compose restart

# 查看日志
docker compose logs -f

# 更新代码
git pull && docker compose up -d --build

# 备份数据库
docker compose exec db mysqldump -u root -p tasklist_db > backup.sql

# 进入容器
docker compose exec backend bash
docker compose exec frontend sh
docker compose exec db mysql -u root -p
```

## 端口配置

在 `.env` 文件中修改：

```env
FRONTEND_PORT=3000  # 前端端口
MYSQL_PORT=3306     # 数据库端口（可选暴露）
```

## 故障排查

```bash
# 查看容器状态
docker compose ps

# 查看详细日志
docker compose logs backend
docker compose logs frontend
docker compose logs db

# 重新构建
docker compose build --no-cache
docker compose up -d
```

详细文档见 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)
