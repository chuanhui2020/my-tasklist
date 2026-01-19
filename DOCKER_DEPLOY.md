# Docker Compose 部署指南

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose V2

### 一键部署

```bash
# 1. 克隆项目（或解压项目）
git clone <your-repo-url>
cd my-tasklist

# 2. 运行启动脚本
chmod +x docker-start.sh
./docker-start.sh

# 3. 访问系统
# 浏览器打开 http://localhost:3000
```

默认管理员账号：
- 用户名: `admin`
- 密码: `123456`

---

## 详细部署步骤

### 第一步：配置环境变量

```bash
# 1. 复制环境变量模板（不要直接使用模板！）
cp .env.example .env

# 2. 编辑 .env 文件修改密码和密钥（重要！）
nano .env
```

**必须修改的配置：**

```env
# 数据库密码（生产环境必须修改！）
MYSQL_ROOT_PASSWORD=your_secure_root_password_here
MYSQL_PASSWORD=your_secure_user_password_here

# Flask 密钥（生产环境必须修改！）
SECRET_KEY=your-random-secret-key-at-least-32-characters-long

# 前端访问端口（可选，默认 3000）
FRONTEND_PORT=3000
```

**生成强随机密钥：**

```bash
# Linux/Mac
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### 第二步：启动服务

```bash
# 构建并启动所有服务（后台运行）
docker compose up -d --build

# 查看启动日志
docker compose logs -f
```

### 第三步：验证部署

```bash
# 查看容器状态
docker compose ps

# 应该看到 3 个容器都在运行：
# - tasklist-db (MySQL)
# - tasklist-backend (Flask)
# - tasklist-frontend (Nginx)

# 检查健康状态
docker compose ps --format json | jq '.[].Health'
```

访问 http://localhost:3000，如果能看到登录页面，说明部署成功！

---

## 服务管理

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# 查看最近 100 行日志
docker compose logs --tail=100 backend
```

### 重启服务

```bash
# 重启所有服务
docker compose restart

# 重启特定服务
docker compose restart backend

# 重新构建并重启
docker compose up -d --build
```

### 停止服务

```bash
# 停止所有服务（保留数据）
docker compose down

# 停止并删除所有数据（危险！）
docker compose down -v
```

### 更新代码

```bash
# 1. 拉取最新代码
git pull origin master

# 2. 重新构建并启动
docker compose up -d --build

# 3. 查看日志确认
docker compose logs -f backend
```

---

## 数据管理

### 数据库备份

```bash
# 备份到本地文件
docker compose exec db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 或者使用环境变量（需要先 source .env）
docker compose exec db mysqldump \
  -u root -p${MYSQL_ROOT_PASSWORD} \
  tasklist_db > backup.sql
```

### 数据库恢复

```bash
# 从备份文件恢复
docker compose exec -T db mysql \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db < backup.sql
```

### 进入数据库

```bash
# 进入 MySQL 命令行
docker compose exec db mysql -u root -p

# 输入 MYSQL_ROOT_PASSWORD 后即可执行 SQL
# mysql> USE tasklist_db;
# mysql> SHOW TABLES;
# mysql> SELECT * FROM users;
```

### 数据持久化

数据库数据存储在 Docker 命名卷中：

```bash
# 查看数据卷
docker volume ls | grep tasklist

# 查看数据卷详情
docker volume inspect tasklist_mysql_data

# 备份数据卷
docker run --rm \
  -v tasklist_mysql_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/mysql_data_backup.tar.gz /data
```

---

## 故障排查

### 服务无法启动

```bash
# 1. 查看容器状态
docker compose ps

# 2. 查看详细日志
docker compose logs backend
docker compose logs frontend
docker compose logs db

# 3. 检查端口占用
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :3306

# Linux/Mac
lsof -i :3000
lsof -i :3306

# 4. 重新启动
docker compose down
docker compose up -d
```

### 后端连接数据库失败

```bash
# 1. 检查数据库是否启动
docker compose ps db

# 2. 检查数据库健康状态
docker inspect tasklist-db --format='{{.State.Health.Status}}'

# 3. 查看数据库日志
docker compose logs db

# 4. 验证数据库连接
docker compose exec db mysql -u taskuser -p$MYSQL_PASSWORD -e "SELECT 1;"

# 5. 检查环境变量
docker compose exec backend env | grep DATABASE_URL
```

### 前端无法访问后端

```bash
# 1. 检查后端健康状态
curl http://localhost:3000/api/tasks

# 2. 进入前端容器测试
docker compose exec frontend sh
# 在容器内执行：
wget -O- http://backend:5000/api/tasks

# 3. 检查 nginx 配置
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

# 4. 查看 nginx 日志
docker compose exec frontend tail -f /var/log/nginx/error.log
```

### 数据库初始化失败

```bash
# 1. 删除现有数据并重新初始化
docker compose down -v  # 警告：会删除所有数据！
docker compose up -d

# 2. 手动初始化
docker compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD tasklist_db < database.sql
```

---

## 性能优化

### 调整资源限制

编辑 `docker-compose.yml`，添加资源限制：

```yaml
services:
  backend:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### MySQL 性能调优

创建 `mysql.cnf`：

```ini
[mysqld]
max_connections = 50
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
```

在 `docker-compose.yml` 中挂载：

```yaml
services:
  db:
    volumes:
      - ./mysql.cnf:/etc/mysql/conf.d/custom.cnf:ro
```

---

## 生产环境部署建议

### 1. 使用 HTTPS

使用 Nginx 反向代理 + Let's Encrypt：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d your-domain.com

# 配置自动续期
sudo certbot renew --dry-run
```

### 2. 配置域名

修改 `nginx.conf` 中的 `server_name`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 修改为你的域名
    # ...
}
```

### 3. 环境变量安全

- ✅ 永远不要将 `.env` 文件提交到 Git
- ✅ 使用强随机密码
- ✅ 定期更换密钥
- ✅ 在 `.gitignore` 中添加 `.env`

### 4. 定期备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
docker compose exec -T db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > $BACKUP_DIR/db_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql"
```

添加到 crontab（每天凌晨 2 点备份）：

```bash
0 2 * * * /path/to/backup.sh
```

### 5. 监控和日志

使用 Docker 日志驱动：

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 常见问题 (FAQ)

**Q: 如何修改前端访问端口？**

A: 修改 `.env` 文件中的 `FRONTEND_PORT`，然后重启：

```bash
# .env
FRONTEND_PORT=8080

# 重启
docker compose up -d
```

**Q: 如何重置管理员密码？**

A: 进入数据库手动修改：

```sql
-- 进入数据库
docker compose exec db mysql -u root -p tasklist_db

-- 重置密码为 123456
UPDATE users SET password_hash = 'scrypt:32768:8:1$...' WHERE username = 'admin';
```

或者删除数据库重新初始化（会丢失所有数据）。

**Q: 能否在同一服务器部署多个实例？**

A: 可以，修改项目目录和端口即可：

```bash
# 实例 1
cd ~/tasklist-instance1
FRONTEND_PORT=3000 docker compose up -d

# 实例 2
cd ~/tasklist-instance2
FRONTEND_PORT=3001 docker compose up -d
```

**Q: 如何升级 Docker 镜像版本？**

A: 修改 Dockerfile 中的基础镜像版本，然后重新构建：

```bash
docker compose build --no-cache
docker compose up -d
```

---

## 卸载

```bash
# 停止并删除所有容器
docker compose down

# 删除数据卷（会删除数据库数据！）
docker compose down -v

# 删除镜像
docker rmi tasklist-backend tasklist-frontend

# 删除项目文件
cd ..
rm -rf my-tasklist
```

---

## 技术支持

如有问题，请查看：

1. 日志输出：`docker compose logs -f`
2. 健康检查：`docker compose ps`
3. GitHub Issues: [项目地址]

---

## 更新日志

### v1.0.0 (2026-01-19)
- ✅ 初始 Docker Compose 配置
- ✅ 移除所有硬编码配置
- ✅ 支持环境变量配置
- ✅ 添加健康检查
- ✅ 添加自动化部署脚本
