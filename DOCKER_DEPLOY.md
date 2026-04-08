# 部署指南

## 生产架构

```
用户浏览器
  ├── https://tasklist.ch-tools.org → Cloudflare Workers（Vue 3 SPA 静态文件）
  └── https://api-tasklist.ch-tools.org/api/* → Cloudflare Proxy → Caddy → FastAPI(:9000) → MySQL(:3307)
```

| 组件 | 技术 | 位置 |
|------|------|------|
| 前端 | Cloudflare Workers | 全球 CDN，git push 自动构建部署 |
| 反向代理 | Caddy | 服务器已有，添加 API 反代规则 |
| 后端 | FastAPI + Uvicorn | Docker 容器（docker-compose.prod.yml） |
| 数据库 | MySQL 8.4 | Docker 容器，数据持久化到 volume |
| SSL | Cloudflare Proxy | 前端和 API 均通过 Cloudflare 自动 HTTPS |

---

## 生产环境部署

### 1. 后端 + 数据库（服务器）

```bash
# 克隆项目
git clone <repo-url> && cd my-tasklist

# 配置环境变量
cp .env.example .env
nano .env  # 填入 MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, SECRET_KEY, AI_API_KEY

# 启动
docker compose -f docker-compose.prod.yml up -d --build

# 验证
curl http://127.0.0.1:9000/docs
```

### 2. Caddy 反向代理

在已有的 Caddyfile 中添加：

```caddyfile
api-tasklist.ch-tools.org {
    reverse_proxy 127.0.0.1:9000 {
        transport http {
            read_timeout 120s
            write_timeout 120s
        }
    }
}
```

重载：`systemctl reload caddy`

### 3. 前端（Cloudflare Workers）

已通过 `frontend/wrangler.jsonc` 配置，git push 自动触发构建部署。

Cloudflare 构建配置：
- Root directory: `frontend`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- 环境变量: `VITE_API_BASE_URL=https://api-tasklist.ch-tools.org/api`, `NODE_VERSION=22`

### 4. DNS 配置（Cloudflare）

| 类型 | 名称 | 内容 | 代理 |
|------|------|------|------|
| CNAME | tasklist | Workers 自动管理 | - |
| A | api-tasklist | 服务器 IP | 开启 |

---

## 本地开发部署

使用 `docker-compose.yml`（包含前端 Nginx + 后端 + 数据库，全部本地运行）：

```bash
cp .env.example .env && nano .env
docker compose up -d --build
# 访问 http://localhost:3000
```

---

## 后端更新

```bash
ssh root@服务器
cd ~/my-tasklist
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

前端更新无需手动操作，git push 后 Cloudflare Workers 自动重新构建部署。

---

## 数据库管理

```bash
# 备份（生产环境用 docker-compose.prod.yml）
docker compose -f docker-compose.prod.yml exec db mysqldump \
  -u root -p$MYSQL_ROOT_PASSWORD tasklist_db > backup_$(date +%Y%m%d).sql

# 恢复
docker compose -f docker-compose.prod.yml exec -T db mysql \
  -u root -p$MYSQL_ROOT_PASSWORD tasklist_db < backup.sql

# 进入数据库
docker compose -f docker-compose.prod.yml exec db mysql \
  -u root -p --default-character-set=utf8mb4 tasklist_db
```

---

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `MYSQL_ROOT_PASSWORD` | 数据库 root 密码 | 是 |
| `MYSQL_PASSWORD` | 应用数据库密码 | 是 |
| `SECRET_KEY` | Token 签名密钥 | 是 |
| `CORS_ORIGINS` | 允许的前端域名（逗号分隔） | 否（有默认值） |
| `AI_API_KEY` | AI 服务密钥 | 是（AI 功能需要） |
| `AI_BASE_URL` | AI 服务地址 | 否（默认 deepseek） |
| `AI_MODEL` | AI 模型名称 | 否（默认 deepseek-chat） |

---

## 故障排查

```bash
# 查看容器状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f db

# 检查后端健康
curl http://127.0.0.1:9000/docs

# 检查数据库连接
docker compose -f docker-compose.prod.yml exec db mysqladmin ping -u root -p
```
