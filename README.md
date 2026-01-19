# 个人任务管理系统

<div align="center">

一个基于 **Flask + Vue 3 + MySQL** 的现代化任务管理 Web 应用

支持任务增删改查、用户管理、AI 功能等

🐳 **一键 Docker 部署** | 🔐 **用户认证** | 📱 **响应式设计**

</div>

---

## ✨ 功能特性

### 核心功能

- ✅ **任务管理**
  - 创建、编辑、删除任务
  - 任务状态切换（待完成/已完成）
  - 截止日期设置和过期提醒
  - 按状态、日期筛选和排序

- ✅ **用户系统**
  - 用户注册和登录
  - 基于 Token 的身份认证
  - 角色权限管理（管理员/普通用户）
  - 密码修改功能

- ✅ **附加功能**
  - AI 算命功能
  - BMI 健康管理
  - 假日管理
  - 响应式设计，支持移动端

### 技术亮点

- 🐳 **Docker 容器化部署** - 一键启动，环境隔离
- 🔒 **安全配置** - 无硬编码密码，环境变量管理
- 🎨 **现代化界面** - Element Plus UI 组件库
- 📊 **RESTful API** - 标准化接口设计
- 💾 **数据持久化** - MySQL 数据库 + Docker Volume

---

## 🚀 快速开始（Docker Compose 部署）

### 前置要求

- Docker 20.10+
- Docker Compose V2

### 一键部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd my-tasklist

# 2. 创建配置文件
cp .env.example .env

# 3. 编辑 .env 文件，修改密码和密钥（重要！）
nano .env
# Windows 用户: notepad .env

# 4. 一键启动
./docker-start.sh

# 或手动启动
docker compose up -d --build
```

### 访问系统

- 🌐 **前端地址**: http://localhost:3000
- 👤 **默认账号**: `admin` / `123456`

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务
docker compose logs -f backend
docker compose logs -f frontend
```

### 停止服务

```bash
docker compose down
```

---

## ⚙️ 配置说明

### 环境变量配置（.env 文件）

**必须修改的配置（生产环境）：**

```env
# 数据库密码
MYSQL_ROOT_PASSWORD=your_secure_root_password_here
MYSQL_PASSWORD=your_secure_user_password_here

# Flask 密钥（至少 32 位）
SECRET_KEY=your-random-secret-key-here

# 前端端口（可选，默认 3000）
FRONTEND_PORT=3000
```

**生成随机密钥：**

```bash
# 方式1：使用 openssl
openssl rand -hex 32

# 方式2：使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 📚 技术栈

### 后端
- **Python 3.10** - 编程语言
- **Flask 2.3** - Web 框架
- **Flask-SQLAlchemy** - ORM
- **Flask-CORS** - 跨域支持
- **PyMySQL** - MySQL 驱动
- **Gunicorn** - WSGI 服务器

### 前端
- **Vue 3** - 前端框架
- **Vue Router 4** - 路由管理
- **Axios** - HTTP 客户端
- **Element Plus** - UI 组件库
- **Vite** - 构建工具

### 数据库
- **MySQL 8.0** - 关系型数据库

### 部署
- **Docker** - 容器化
- **Docker Compose** - 服务编排
- **Nginx** - 反向代理

---

## 📁 项目结构

```
my-tasklist/
├── backend/                    # 后端 Flask 应用
│   ├── app.py                  # 应用入口
│   ├── config.py               # 配置文件（环境变量）
│   ├── models.py               # 数据库模型
│   ├── auth_utils.py           # 认证工具
│   ├── requirements.txt        # Python 依赖
│   └── routes/                 # API 路由
│       ├── auth_routes.py      # 认证接口
│       ├── task_routes.py      # 任务接口
│       ├── fortune_routes.py   # 算命功能
│       └── bmi_routes.py       # BMI 功能
│
├── frontend/                   # 前端 Vue 应用
│   ├── src/
│   │   ├── api/                # API 调用
│   │   ├── components/         # 组件
│   │   ├── views/              # 页面
│   │   ├── App.vue             # 根组件
│   │   └── router.js           # 路由配置
│   ├── package.json            # 前端依赖
│   └── vite.config.js          # Vite 配置
│
├── Dockerfile.backend          # 后端镜像
├── Dockerfile.frontend         # 前端镜像
├── docker-compose.yml          # Docker 编排
├── nginx.conf                  # Nginx 配置
├── .env.example                # 环境变量模板
├── docker-start.sh             # 启动脚本
├── database.sql                # 数据库初始化
└── README.md                   # 项目文档
```

---

## 🔧 常用操作

### 服务管理

```bash
# 查看服务状态
docker compose ps

# 重启服务
docker compose restart

# 重启特定服务
docker compose restart backend

# 更新代码后重新部署
git pull
docker compose up -d --build
```

### 数据库管理

```bash
# 备份数据库
docker compose exec db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker compose exec -T db mysql \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db < backup.sql

# 进入数据库
docker compose exec db mysql -u root -p
```

### 容器调试

```bash
# 进入后端容器
docker compose exec backend bash

# 进入前端容器
docker compose exec frontend sh

# 查看容器资源占用
docker stats
```

---

## 📊 API 接口

### 认证相关
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/users` - 创建用户（管理员）
- `POST /api/auth/change-password` - 修改密码

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取单个任务
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `PATCH /api/tasks/:id/status` - 更新任务状态
- `DELETE /api/tasks/:id` - 删除任务

### 其他功能
- `POST /api/fortune/generate` - AI 算命
- `POST /api/bmi/advice` - BMI 健康建议
- `GET /api/holidays/manual` - 获取假日列表

---

## 💾 数据库设计

### users 表
```sql
id            INT PRIMARY KEY AUTO_INCREMENT
username      VARCHAR(64) UNIQUE NOT NULL
password_hash VARCHAR(512) NOT NULL
role          ENUM('admin', 'user') DEFAULT 'user'
created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
```

### tasks 表
```sql
id          INT PRIMARY KEY AUTO_INCREMENT
title       VARCHAR(255) NOT NULL
description TEXT
status      ENUM('pending', 'done') DEFAULT 'pending'
due_date    DATE
user_id     INT NOT NULL (外键关联 users)
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

### holidays 表
```sql
id          INT PRIMARY KEY AUTO_INCREMENT
date        DATE UNIQUE NOT NULL
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## 🛠️ 开发指南

### Docker 开发环境（推荐）

```bash
# 启动开发环境
docker compose up -d

# 查看实时日志
docker compose logs -f backend
docker compose logs -f frontend

# 修改代码后重启
docker compose restart backend
```

### 传统开发环境

<details>
<summary>点击展开查看传统部署方式</summary>

#### 后端开发

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 设置环境变量
export DATABASE_URL="mysql+pymysql://root:password@localhost/tasklist_db"
export SECRET_KEY="your-secret-key"

# 运行开发服务器
python app.py
```

#### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 设置后端地址并启动
VITE_BACKEND_URL=http://localhost:5000 npm run dev
```

#### 数据库准备

```bash
mysql -u root -p
CREATE DATABASE tasklist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tasklist_db;
SOURCE database.sql;
```

</details>

---

## 📖 文档

- **[DOCKER_README.md](./DOCKER_README.md)** - Docker 快速参考
- **[DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)** - 详细部署文档
- **[DOCKER_MIGRATION.md](./DOCKER_MIGRATION.md)** - Docker 迁移说明
- **[CLAUDE.md](./CLAUDE.md)** - 开发者指南

---

## 🔍 故障排查

### 端口被占用

```bash
# 修改 .env 文件中的端口
FRONTEND_PORT=8080

# 重启服务
docker compose up -d
```

### 服务无法启动

```bash
# 查看详细日志
docker compose logs backend
docker compose logs frontend
docker compose logs db

# 重新构建
docker compose down
docker compose up -d --build
```

### 数据库连接失败

```bash
# 检查数据库状态
docker compose ps db

# 查看数据库日志
docker compose logs db

# 等待数据库完全启动（约 10-30 秒）
```

更多问题请查看 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) 的故障排查章节。

---

## 🎯 使用说明

### 登录系统

1. 访问 http://localhost:3000
2. 使用默认账号登录：`admin` / `123456`
3. 首次使用建议修改密码

### 任务管理

- **新建任务**: 点击"新建任务"按钮，填写标题、描述和截止日期
- **编辑任务**: 点击任务卡片的"编辑"按钮
- **完成任务**: 点击"标记完成"按钮
- **删除任务**: 点击"删除"按钮并确认

### 用户管理（管理员）

- 进入"用户管理"页面
- 创建新用户，设置角色（管理员/普通用户）
- 管理所有用户账号

---

## 🔒 安全建议

### 生产环境部署

1. ✅ **修改默认密码** - 修改 `.env` 中的所有密码
2. ✅ **使用强密钥** - `SECRET_KEY` 至少 32 位随机字符
3. ✅ **启用 HTTPS** - 使用 Let's Encrypt 申请 SSL 证书
4. ✅ **定期备份** - 设置自动化数据库备份
5. ✅ **限制访问** - 配置防火墙，只开放必要端口
6. ✅ **更新依赖** - 定期更新 Docker 镜像和依赖包

### 备份建议

```bash
# 创建备份脚本
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose exec -T db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD \
  tasklist_db > $BACKUP_DIR/backup_$DATE.sql

echo "Backup completed: $BACKUP_DIR/backup_$DATE.sql"
```

---

## 🚀 性能优化

- **资源限制**: 在 `docker-compose.yml` 中配置 CPU 和内存限制
- **数据库优化**: 根据负载调整 MySQL 配置
- **前端缓存**: Nginx 已配置静态资源缓存
- **日志管理**: 配置日志轮转，防止日志文件过大

---

## 📝 更新日志

### v1.1.0 (2026-01-19)
- ✅ 完全 Docker 化部署
- ✅ 移除所有硬编码配置
- ✅ 环境变量化配置管理
- ✅ 一键启动脚本
- ✅ 完善的文档体系

### v1.0.0 (2024-09-16)
- ✅ 基础任务管理功能
- ✅ 用户认证系统
- ✅ AI 功能集成

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 💬 联系方式

如有问题或建议，欢迎：
- 提交 [Issue](../../issues)
- 发送 Pull Request
- 联系项目维护者

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

Made with ❤️ using Flask + Vue 3 + Docker

</div>
