# Docker Compose 迁移完成总结

## 🎉 项目已成功改造为 Docker Compose 部署

所有硬编码配置已移除，现在可以在任何 Docker 环境中一键部署！

---

## 📋 改造内容清单

### ✅ 新增文件

| 文件 | 说明 |
|------|------|
| `Dockerfile.backend` | 后端 Flask 应用的 Docker 镜像定义 |
| `Dockerfile.frontend` | 前端 Vue 应用的多阶段构建 Dockerfile |
| `docker-compose.yml` | 服务编排配置（数据库、后端、前端） |
| `nginx.conf` | Nginx 反向代理配置 |
| `.dockerignore` | Docker 构建时忽略的文件 |
| `.env.example` | 环境变量模板 |
| `docker-start.sh` | 一键启动脚本 |
| `DOCKER_DEPLOY.md` | Docker 部署详细文档 |
| `DOCKER_README.md` | Docker 快速参考 |

### ✅ 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/config.py` | 移除硬编码密码，从环境变量读取配置 |
| `frontend/vite.config.js` | 移除硬编码 IP `192.168.0.2`，从环境变量读取 |
| `CLAUDE.md` | 新增 Docker 部署章节 |
| `.gitignore` | 已包含 `.env`（确保不提交敏感信息） |

---

## 🚀 快速开始（新环境部署）

### 前置要求

- Docker 20.10+
- Docker Compose V2

### 部署步骤

```bash
# 1. 进入项目目录
cd my-tasklist

# 2. 复制环境变量模板（必须手动创建，不要跳过！）
cp .env.example .env

# 3. 编辑 .env 文件修改密码和密钥（重要！）
# Windows 用户：notepad .env
# Linux/Mac：nano .env 或 vim .env
nano .env

# 修改以下配置：
# - MYSQL_ROOT_PASSWORD=设置强密码
# - MYSQL_PASSWORD=设置强密码
# - SECRET_KEY=生成随机密钥

# 4. 启动服务（二选一）
./docker-start.sh           # 推荐：使用自动化脚本
docker compose up -d --build  # 或手动启动

# 5. 访问系统
# 浏览器打开 http://localhost:3000
```

**默认账号：**
- 用户名：`admin`
- 密码：`123456`

---

## 🔧 环境变量说明

### 必须修改的配置（生产环境）

```env
# 数据库 root 密码
MYSQL_ROOT_PASSWORD=your_secure_root_password_here

# 应用数据库密码
MYSQL_PASSWORD=your_secure_user_password_here

# Flask 密钥（至少 32 位随机字符串）
SECRET_KEY=change-this-to-a-random-secret-key-in-production
```

**生成随机密钥：**

```bash
# 方式1：使用 openssl
openssl rand -hex 32

# 方式2：使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### 可选配置

```env
# 数据库配置
MYSQL_DATABASE=tasklist_db   # 数据库名
MYSQL_USER=taskuser          # 数据库用户名
MYSQL_PORT=3306              # 数据库端口

# 前端端口
FRONTEND_PORT=3000           # 可改为其他端口，如 8080

# Flask 环境
FLASK_ENV=production         # 或 development
```

---

## 📊 服务架构

```
┌─────────────────┐
│   用户浏览器     │
│  localhost:3000 │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Frontend        │
│  (Nginx)        │  ← 提供静态文件 + API 反向代理
└────────┬────────┘
         │ /api/*
         ▼
┌─────────────────┐
│  Backend        │
│  (Flask)        │  ← Python 应用 + Gunicorn
└────────┬────────┘
         │ MySQL
         ▼
┌─────────────────┐
│  Database       │
│  (MySQL 8.0)    │  ← 数据存储
└─────────────────┘
```

**内部网络：**
- 服务间通过 Docker 网络 `tasklist_network` 通信
- 使用服务名作为主机名（`db`, `backend`, `frontend`）
- 外部只暴露前端端口 3000

---

## 🛠️ 常用命令

### 日常操作

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f              # 所有服务
docker compose logs -f backend      # 仅后端
docker compose logs -f frontend     # 仅前端
docker compose logs -f db           # 仅数据库

# 重启服务
docker compose restart              # 重启所有
docker compose restart backend      # 重启后端

# 停止服务
docker compose down                 # 停止（保留数据）
docker compose down -v              # 停止并删除数据（危险！）
```

### 代码更新

```bash
# 拉取最新代码
git pull origin master

# 重新构建并启动
docker compose up -d --build

# 查看启动日志
docker compose logs -f
```

### 数据库操作

```bash
# 备份数据库
docker compose exec db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > backup.sql

# 恢复数据库
docker compose exec -T db mysql \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db < backup.sql

# 进入数据库
docker compose exec db mysql -u root -p
# 输入 MYSQL_ROOT_PASSWORD

# 查看数据
USE tasklist_db;
SHOW TABLES;
SELECT * FROM users;
```

### 调试

```bash
# 进入容器内部
docker compose exec backend bash     # 后端容器
docker compose exec frontend sh      # 前端容器（Alpine Linux）
docker compose exec db bash          # 数据库容器

# 检查健康状态
docker inspect tasklist-backend --format='{{.State.Health.Status}}'
docker inspect tasklist-frontend --format='{{.State.Health.Status}}'

# 查看容器资源占用
docker stats
```

---

## 🔍 故障排查

### 问题1：端口被占用

```bash
# Windows 查看端口占用
netstat -ano | findstr :3000

# 解决：修改 .env 中的 FRONTEND_PORT
FRONTEND_PORT=8080
docker compose up -d
```

### 问题2：数据库连接失败

```bash
# 1. 检查数据库是否启动
docker compose ps db

# 2. 查看数据库日志
docker compose logs db

# 3. 等待数据库健康检查通过（约 10-30 秒）
docker inspect tasklist-db --format='{{.State.Health.Status}}'

# 4. 重启后端（数据库就绪后）
docker compose restart backend
```

### 问题3：前端无法访问后端

```bash
# 1. 检查后端是否启动
docker compose ps backend

# 2. 测试后端 API
curl http://localhost:3000/api/tasks

# 3. 查看 nginx 日志
docker compose logs frontend

# 4. 进入前端容器测试
docker compose exec frontend sh
wget -O- http://backend:5000/api/tasks
```

---

## 📦 数据持久化

### 数据存储位置

- **数据库数据：** Docker 卷 `tasklist_mysql_data`
- **位置：** 由 Docker 管理，通常在 `/var/lib/docker/volumes/`

### 数据备份建议

**定期备份（推荐）：**

```bash
# 创建备份脚本 backup.sh
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose exec -T db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > $BACKUP_DIR/backup_$DATE.sql

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql"

# 添加到定时任务（Linux/Mac）
# crontab -e
# 0 2 * * * /path/to/backup.sh
```

### 迁移到新服务器

```bash
# 在旧服务器备份
docker compose exec db mysqldump -u root -p tasklist_db > backup.sql

# 在新服务器恢复
# 1. 部署 Docker Compose
cp .env.example .env
# 编辑 .env
docker compose up -d

# 2. 等待服务启动
sleep 30

# 3. 导入数据
docker compose exec -T db mysql -u root -p tasklist_db < backup.sql
```

---

## ✨ 改进亮点

### 1. 无硬编码配置

- ❌ 之前：数据库密码 `123456` 硬编码在 `config.py`
- ✅ 现在：所有配置从环境变量读取

- ❌ 之前：API 地址 `192.168.0.2:5000` 硬编码在 `vite.config.js`
- ✅ 现在：从 `VITE_BACKEND_URL` 环境变量读取

### 2. 一键部署

- ❌ 之前：需手动安装 Python、Node.js、MySQL，配置多个服务
- ✅ 现在：只需 Docker，运行 `./docker-start.sh` 即可

### 3. 环境一致性

- ❌ 之前：开发环境和生产环境差异大，容易出问题
- ✅ 现在：Docker 确保环境完全一致

### 4. 资源隔离

- ❌ 之前：服务直接运行在主机上，可能冲突
- ✅ 现在：容器隔离，互不影响

### 5. 易于维护

- ❌ 之前：更新需要手动重启多个服务
- ✅ 现在：`docker compose up -d --build` 一键更新

---

## 📝 兼容性说明

### 保留原有部署方式

如果你更喜欢传统部署方式，原有的启动脚本仍然可用：

```bash
# 传统方式启动（需要本地安装 Python、Node.js、MySQL）
./start.sh dev
```

两种方式可以共存，互不影响。

### 开发环境建议

- **日常开发：** 使用传统方式（`./start.sh dev`）
  - 优点：热重载更快，调试方便

- **测试部署：** 使用 Docker Compose
  - 优点：测试生产环境，确保配置正确

- **生产环境：** 使用 Docker Compose（强烈推荐）
  - 优点：稳定、易维护、资源隔离

---

## 🎯 下一步建议

### 1. 配置域名和 HTTPS（生产环境）

```bash
# 使用 Nginx 反向代理 + Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. 配置监控（可选）

- 使用 Portainer 管理 Docker 容器
- 使用 Prometheus + Grafana 监控资源
- 配置日志聚合（ELK 或 Loki）

### 3. 自动化部署（可选）

- 配置 GitHub Actions / GitLab CI
- 自动构建镜像并部署
- 实现 CI/CD 流程

---

## 📚 文档索引

- **快速参考：** [DOCKER_README.md](./DOCKER_README.md)
- **详细文档：** [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)
- **开发指南：** [CLAUDE.md](./CLAUDE.md)
- **项目说明：** [README.md](./README.md)

---

## ✅ 测试清单

在新环境部署后，建议进行以下测试：

- [ ] 访问 http://localhost:3000，能看到登录页面
- [ ] 使用 `admin` / `123456` 登录成功
- [ ] 创建一个新任务
- [ ] 编辑任务
- [ ] 删除任务
- [ ] 退出登录，重新登录
- [ ] 重启服务（`docker compose restart`），数据未丢失
- [ ] 查看日志（`docker compose logs -f`），无错误

---

## 🎊 完成！

你的任务管理系统现在已经完全 Docker 化，可以在任何支持 Docker 的环境中快速部署！

**需要帮助？**
- 查看 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) 获取详细文档
- 查看服务日志：`docker compose logs -f`
- 检查服务状态：`docker compose ps`
