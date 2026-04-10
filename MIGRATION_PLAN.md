# 后端迁移计划：FastAPI + MySQL → Cloudflare Workers + D1

## 目标

将后端从新加坡服务器（FastAPI + MySQL）迁移到 Cloudflare Workers + D1，消除地理延迟，实现全栈边缘部署，服务器成本归零。

## 迁移后架构

```
用户 → Cloudflare Edge (最近节点)
       ├── Workers (后端 API)  ← api-tasklist.ch-tools.org
       ├── D1 (SQLite 数据库)
       └── Workers Static Assets (前端 SPA)  ← tasklist.ch-tools.org
```

前端无需改动，只需后端重写 + 数据迁移。

---

## 技术选型

| 组件 | 当前 | 迁移后 |
|------|------|--------|
| 运行时 | Python / uvicorn | Cloudflare Workers (V8) |
| 框架 | FastAPI | Hono (轻量，Workers 生态首选) |
| 语言 | Python | TypeScript |
| 数据库 | MySQL 8.4 | Cloudflare D1 (SQLite) |
| ORM | SQLAlchemy 2.0 | Drizzle ORM (D1 原生支持) |
| 认证 | itsdangerous (URLSafeTimedSerializer) | jose (JWT，Workers 兼容) |
| 密码哈希 | werkzeug (pbkdf2:sha256) | Web Crypto API (PBKDF2) |
| 加密 (安全笔记) | cryptography (Fernet + PBKDF2) | Web Crypto API (AES-GCM + PBKDF2) |
| AI 调用 | requests / httpx | fetch (Workers 原生) |
| 配置 | 环境变量 + .env | wrangler.jsonc + Workers Secrets |
| 部署 | docker compose + caddy | wrangler deploy (git push 自动) |

---

## 项目结构

```
workers-backend/
├── wrangler.jsonc              # Workers 配置 + D1 binding
├── package.json
├── tsconfig.json
├── drizzle.config.ts           # Drizzle 迁移配置
├── src/
│   ├── index.ts                # Hono app 入口，路由注册，CORS
│   ├── db/
│   │   └── schema.ts           # Drizzle 表定义 (所有模型)
│   ├── middleware/
│   │   └── auth.ts             # JWT 验证中间件
│   ├── routes/
│   │   ├── auth.ts             # /api/auth/*
│   │   ├── tasks.ts            # /api/tasks/*
│   │   ├── fortune.ts          # /api/fortune/*
│   │   ├── bmi.ts              # /api/bmi/*
│   │   ├── menu.ts             # /api/menu/*
│   │   ├── secure-notes.ts     # /api/secure-notes/*
│   │   └── countdowns.ts       # /api/countdowns/*
│   └── lib/
│       ├── crypto.ts           # 密码哈希 + 安全笔记加解密
│       ├── token.ts            # JWT 生成/验证
│       └── ai.ts               # AI API 调用 (fetch)
├── drizzle/
│   └── 0000_initial.sql        # D1 初始化 SQL
├── scripts/
│   └── migrate-data.ts         # MySQL → D1 数据迁移脚本
└── test/
    └── *.test.ts               # 接口测试
```

---

## D1 数据库 Schema

D1 基于 SQLite，语法差异点：
- 无 ENUM 类型 → 用 TEXT + CHECK 约束
- 无 AUTO_INCREMENT → 用 INTEGER PRIMARY KEY (自动 rowid)
- 日期存为 TEXT (ISO 8601 格式)
- 无 MODIFY COLUMN → 建表时就定义好

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due_date ON tasks(user_id, due_date);

CREATE TABLE bmi_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  gender TEXT NOT NULL DEFAULT 'male',
  age INTEGER NOT NULL DEFAULT 28,
  height INTEGER NOT NULL DEFAULT 170,
  weight REAL NOT NULL DEFAULT 65.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fortune_records (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fortune_number INTEGER NOT NULL,
  fortune_type TEXT NOT NULL,
  type_text TEXT NOT NULL,
  poem TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  advice TEXT NOT NULL,
  work_fortune TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE secure_notes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE weight_records (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  weight REAL NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE countdowns (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  target_time TEXT NOT NULL,
  remind_before INTEGER NOT NULL DEFAULT 5,
  remind_level TEXT NOT NULL DEFAULT 'urgent' CHECK (remind_level IN ('normal', 'urgent', 'crazy')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'dismissed')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE weekly_menus (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  menu_json TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## API 端点清单 (1:1 对应)

所有端点保持路径和请求/响应格式不变，前端零改动。

### Auth (`/api/auth`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/login | 登录，返回 token + user |
| GET | /auth/me | 当前用户信息 |
| GET | /auth/users | 用户列表 (admin) |
| POST | /auth/users | 创建用户 (admin) |
| POST | /auth/change-password | 修改密码 |

### Tasks (`/api/tasks`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /tasks | 分页列表 (page, page_size, status, sort) |
| GET | /tasks/:id | 单个任务 |
| POST | /tasks | 创建 |
| PUT | /tasks/:id | 更新 |
| PATCH | /tasks/:id/status | 切换状态 |
| DELETE | /tasks/:id | 删除 |

### Fortune (`/api/fortune`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /generate | 生成运势 (每日1次) |
| GET | /today | 今日运势 |
| GET | /history | 历史记录 |

### BMI (`/api/bmi`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /advice | AI 健康建议 |
| GET | /profile | 获取档案 |
| PUT | /profile | 保存档案 |
| POST | /weight | 记录体重 |
| GET | /weight/today | 今日体重 |
| GET | /weight/history | 体重历史 |
| POST | /weight/analysis | AI 体重分析 |

### Menu (`/api/menu`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /list | 菜单列表 |
| GET | /today | 今日菜单 |
| POST | /upload | 上传菜单图片 (admin, multipart) |

### Secure Notes (`/api/secure-notes`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 笔记列表 |
| POST | / | 创建加密笔记 |
| POST | /:id/unlock | 解锁笔记 |
| PUT | /:id | 更新笔记 |
| DELETE | /:id | 删除笔记 |

### Countdowns (`/api/countdowns`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 倒计时列表 |
| POST | / | 创建 |
| PUT | /:id | 更新 |
| DELETE | /:id | 删除 |
| GET | /upcoming | 即将到期 |
| PATCH | /:id/dismiss | 关闭提醒 |

---

## 关键迁移细节

### 1. 认证系统

当前用 itsdangerous 的 URLSafeTimedSerializer，迁移到标准 JWT：

```typescript
// 用 jose 库 (Workers 兼容，基于 Web Crypto API)
import { SignJWT, jwtVerify } from 'jose'

// 生成 token
const token = await new SignJWT({ user_id, role })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(secret)

// 验证 token
const { payload } = await jwtVerify(token, secret)
```

**注意：** 迁移后旧 token 全部失效，用户需重新登录。这是可接受的一次性影响。

### 2. 密码哈希

当前 werkzeug 用 `pbkdf2:sha256`，格式为 `pbkdf2:sha256:600000$salt$hash`。

迁移方案：
- 新系统用 Web Crypto API 的 PBKDF2
- 数据迁移时需要兼容验证旧格式，或者要求所有用户重置密码
- **推荐：** 迁移脚本中解析 werkzeug 格式，用相同参数重新验证，首次登录时用新格式重新哈希

```typescript
// 验证 werkzeug 格式的密码
async function verifyWerkzeugHash(password: string, hash: string): Promise<boolean> {
  // 解析 pbkdf2:sha256:iterations$salt$hash
  const [method, salt, digest] = parseWerkzeugHash(hash)
  // 用 Web Crypto API 重新计算并比较
}

// 新密码用标准格式
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']),
    256
  )
  return `pbkdf2$${toHex(salt)}$${toHex(key)}`
}
```

### 3. 安全笔记加密

当前用 Fernet (AES-128-CBC + HMAC-SHA256)，迁移到 AES-256-GCM：

- 数据迁移时无法解密（需要用户密码），所以加密数据原样迁移
- 需要在新系统中实现 Fernet 解密兼容层，或者标记旧笔记让用户重新加密
- **推荐：** 实现 Fernet 兼容解密，新笔记用 AES-GCM。通过 salt 前缀区分新旧格式

### 4. AI 调用

直接用 fetch 替代 requests/httpx，逻辑不变：

```typescript
const response = await fetch(AI_BASE_URL + '/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.AI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, messages, temperature, max_tokens }),
})
```

Workers 有 30s CPU 时间限制，但 AI 调用是 I/O 等待不算 CPU，所以没问题。

### 5. 菜单图片上传

当前接收 multipart/form-data，base64 编码后发给 AI vision API。Workers 支持 `request.formData()`，可以直接处理。

如果图片较大，考虑先上传到 R2 再处理，但当前直接 base64 传给 AI 的方式在 Workers 中也可行（Workers 内存限制 128MB，足够）。

### 6. 日期时间处理

MySQL 的 DATETIME → D1 存 TEXT (ISO 8601)。

```typescript
// 写入
datetime('now')  // SQLite 函数
new Date().toISOString()  // JS 生成

// 读取时前端已经在处理字符串格式，影响不大
// 注意时区：统一用 UTC 存储，前端自行转换显示
```

### 7. AI 日志

当前写文件系统，Workers 无文件系统。方案：
- 去掉文件日志，改用 `console.log` → Cloudflare Workers Logs (已开启 observability)
- 或者写入单独的 D1 表 / KV

**推荐：** 直接用 console.log，Cloudflare 的 observability 已经配置好了。

---

## 数据迁移方案

### 步骤

1. 从 MySQL 导出所有表数据为 JSON
2. 转换数据格式（日期格式、JSON 字段等）
3. 通过 D1 API 或 wrangler d1 execute 批量导入

```bash
# 1. SSH 到服务器，导出数据
docker compose exec db mysqldump -u root -p tasklist_db \
  --no-create-info --complete-insert --skip-lock-tables > data.sql

# 2. 或者用脚本导出为 JSON (更可控)
python scripts/export_data.py > data.json

# 3. 创建 D1 数据库
wrangler d1 create tasklist-db

# 4. 执行 schema
wrangler d1 execute tasklist-db --file=drizzle/0000_initial.sql

# 5. 导入数据
node scripts/import-to-d1.js
```

### 注意事项
- 密码哈希原样迁移，新系统需兼容 werkzeug 格式
- 加密笔记的 encrypted_content 原样迁移
- 日期从 `2024-01-01 12:00:00` 转为 `2024-01-01T12:00:00.000Z`
- JSON 字段 (advice, menu_json) 原样迁移（已经是 TEXT）

---

## wrangler.jsonc 配置

```jsonc
{
  "name": "tasklist-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-08",
  "observability": {
    "enabled": true,
    "logs": { "enabled": true }
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tasklist-db",
      "database_id": "<创建后填入>"
    }
  ],
  "routes": [
    { "pattern": "api-tasklist.ch-tools.org/*", "zone_name": "ch-tools.org" }
  ],
  "vars": {
    "CORS_ORIGINS": "https://tasklist.ch-tools.org",
    "AI_BASE_URL": "https://api.deepseek.com",
    "AI_MODEL": "deepseek-chat"
  }
  // SECRET_KEY, AI_API_KEY 通过 wrangler secret put 设置
}
```

---

## 实施步骤

### 阶段 1：搭建项目骨架
1. 初始化 workers-backend 项目 (Hono + Drizzle + TypeScript)
2. 配置 wrangler.jsonc + D1 binding
3. 定义 Drizzle schema (所有表)
4. 实现 CORS 中间件

### 阶段 2：核心功能
5. 实现 crypto.ts (密码哈希 + werkzeug 兼容)
6. 实现 token.ts (JWT 生成/验证)
7. 实现 auth 中间件
8. 实现 auth 路由 (登录、用户管理)
9. 实现 tasks 路由 (CRUD + 分页)

### 阶段 3：扩展功能
10. 实现 ai.ts (fetch 调用 AI API)
11. 实现 fortune 路由
12. 实现 bmi 路由
13. 实现 secure-notes 路由 (Fernet 兼容解密 + AES-GCM 新加密)
14. 实现 countdowns 路由
15. 实现 menu 路由 (含图片上传)

### 阶段 4：数据迁移 & 部署
16. 创建 D1 数据库，执行 schema
17. 编写数据迁移脚本，从 MySQL 导入 D1
18. 部署 Workers，配置 secrets
19. DNS 切换 api-tasklist.ch-tools.org 指向 Workers
20. 验证所有功能正常
21. 关闭新加坡服务器上的后端容器

### 阶段 5：清理
22. 删除旧的 backend/ 目录和 Docker 相关文件（或归档）
23. 更新 CLAUDE.md 文档

---

## Cloudflare 免费额度 (Workers + D1)

| 资源 | 免费额度 | 预估用量 |
|------|----------|----------|
| Workers 请求 | 10万次/天 | 远远够用 |
| Workers CPU | 10ms/请求 | 大部分请求 <5ms |
| D1 读取 | 500万行/天 | 远远够用 |
| D1 写入 | 10万行/天 | 远远够用 |
| D1 存储 | 5GB | 个人用 <100MB |

个人使用完全在免费额度内。

---

## 风险与回退

- **回退方案：** 新加坡服务器保留运行，DNS 切回即可秒级回退
- **数据同步：** 切换期间冻结写入，或切换后从 D1 导回 MySQL
- **token 失效：** 迁移后所有用户需重新登录（一次性）
- **加密笔记：** 需要 Fernet 兼容层，否则旧笔记无法解密
- **Workers 限制：** 单次请求 128MB 内存、30s CPU — 对本应用绑绑有余
