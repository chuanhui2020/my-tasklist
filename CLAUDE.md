# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Task Management System - A full-stack edge-deployed web application.

**Tech Stack:**
- Backend: Hono, Drizzle ORM, TypeScript, Cloudflare Workers
- Frontend: Vue 3, Vue Router 4, Element Plus, Vite
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2 (任务图片)
- Auth: JWT (jose library)

## Deployment

### Production Architecture

```
用户 → Cloudflare Edge (最近节点)
       ├── Workers (后端 API)  ← api-tasklist.ch-tools.org
       │   ├── D1 (SQLite 数据库)
       │   ├── R2 (图片存储)
       │   └── Container (Code Review 自动化)
       └── Workers Static Assets (前端 SPA)  ← tasklist.ch-tools.org
```

全栈边缘部署，零服务器成本。前后端跨域（不同子域名），后端配置 CORS。

**部署后端：**
```bash
cd backend
npx wrangler deploy
```

**前端自动部署：** 每次 `git push` 到 master 触发 Cloudflare Workers 构建。

**管理 Secrets：**
```bash
echo "value" | npx wrangler secret put SECRET_KEY
echo "value" | npx wrangler secret put AI_API_KEY
```

**D1 数据库操作：**
```bash
# 执行 SQL
npx wrangler d1 execute tasklist_db --remote --command="SELECT * FROM users"
# 执行 SQL 文件
npx wrangler d1 execute tasklist_db --remote --file=drizzle/0000_initial.sql
```

### Local Development

```bash
cd backend
npm install
npx wrangler dev
```

本地开发使用 wrangler 内置的 D1 本地模拟（SQLite），无需外部数据库。

## Architecture

### Backend Structure

```
backend/
├── wrangler.jsonc              # Workers 配置 + D1 binding + R2 binding + Container
├── package.json
├── tsconfig.json
├── drizzle.config.ts           # Drizzle 迁移配置
├── src/
│   ├── index.ts                # Hono app 入口，路由注册，CORS
│   ├── types.ts                # Env 类型定义 (Bindings)
│   ├── container.ts            # CodeReviewContainer (Durable Object + Container)
│   ├── db/
│   │   └── schema.ts           # Drizzle 表定义 (所有模型)
│   ├── middleware/
│   │   └── auth.ts             # JWT 验证中间件 + admin 权限中间件
│   ├── routes/
│   │   ├── auth.ts             # /api/auth/* - 登录、用户管理、改密码
│   │   ├── tasks.ts            # /api/tasks/* - 任务 CRUD + 分页排序 + 图片上传/预览/删除
│   │   ├── fortune.ts          # /api/fortune/* - AI 运势签文
│   │   ├── bmi.ts              # /api/bmi/* - BMI + 体重记录 + AI 分析
│   │   ├── secure-notes.ts     # /api/secure-notes/* - 加密笔记
│   │   ├── countdowns.ts       # /api/countdowns/* - 倒计时提醒
│   │   ├── menu.ts             # /api/menu/* - 菜单识别 (AI vision)
│   │   └── github-webhook.ts   # /api/webhooks/github - GitHub Webhook (自动 Code Review)
│   └── lib/
│       ├── crypto.ts           # 密码哈希 (PBKDF2) + 笔记加密 (AES-GCM)
│       ├── token.ts            # JWT 生成/验证 (jose)
│       ├── ai.ts               # AI API 调用 (fetch)
│       └── github.ts           # GitHub API 工具函数
├── container/                  # Code Review Container (Node.js 运行时)
├── drizzle/
│   ├── 0000_initial.sql        # D1 初始化 SQL
│   ├── 0001_task_images.sql    # 任务图片表迁移
│   ├── 0002_last_login_at.sql  # 用户最近登录时间
│   └── 0002_secure_notes_description.sql  # 笔记描述字段
└── scripts/
    ├── export_data.py          # MySQL → JSON 导出 (迁移用)
    └── import-to-d1.ts         # JSON → D1 SQL 导入 (迁移用)
```

**Key Patterns:**

1. **Authentication System:**
   - JWT via `jose` library (HS256, Web Crypto API)
   - Token payload: `{user_id: number, role: string}`
   - Tokens expire after 24 hours
   - Protected routes use `authMiddleware`，admin 路由额外加 `adminMiddleware`
   - Current user via `c.get('user')` (Hono context variable)

2. **Database Access:**
   - Drizzle ORM with D1 driver: `const db = drizzle(c.env.DB)`
   - Schema 定义在 `src/db/schema.ts`
   - D1 基于 SQLite：无 ENUM（用 TEXT + Drizzle enum），日期存 TEXT (ISO 8601)
   - 无自动迁移，schema 变更需手动写 SQL 并执行

3. **Models (`db/schema.ts`):**
   - `users`: username, password_hash, role (admin/user), last_login_at
   - `tasks`: title, description, status (pending/done), due_date, user_id
   - `taskImages`: task_id, user_id, r2_key, filename, mime_type, size, sort_order
   - `bmiProfiles`: gender, age, height, weight (per user, unique)
   - `fortuneRecords`: fortune_number, fortune_type, type_text, poem, interpretation, advice, work_fortune
   - `secureNotes`: title, description, encrypted_content, salt, password_hash
   - `weightRecords`: weight, date (unique per user per date)
   - `countdowns`: title, target_time, remind_before, remind_level, status
   - `weeklyMenus`: week_start, menu_json, uploaded_by

4. **API Response Pattern:**
   - Success: `c.json({...})` or `c.json({...}, 201)`
   - Error: `c.json({error: '消息'}, 4xx)`
   - Auth errors: 401, permission errors: 403

5. **Password Hashing (`lib/crypto.ts`):**
   - PBKDF2-SHA256, 100,000 iterations (Workers 限制最大 100,000)
   - 存储格式: `pbkdf2$salt_hex$hash_hex`

6. **Secure Notes Encryption (`lib/crypto.ts`):**
   - AES-256-GCM, prefix `aesgcm$`
   - Key derivation: PBKDF2-SHA256, 100,000 iterations

7. **Task Images (R2 Storage):**
   - Images stored in R2 bucket `tasklist-images`, key format: `tasks/{user_id}/{task_id}/{uuid}.{ext}`
   - Supported formats: JPEG, PNG, WebP; max 5MB per file, max 10 per task
   - Image file serving endpoint supports `?token=JWT` query param for `<img src>` usage (before authMiddleware)
   - Upload/delete endpoints use standard authMiddleware
   - Task deletion cascades: deletes R2 objects + DB rows

### Frontend Structure

```
frontend/src/
├── main.js                 # App entry point, Vue app creation
├── App.vue                 # Root component with navigation
├── router.js               # Vue Router with auth guards
├── api/
│   └── index.js            # Axios instance, API methods, auth storage
├── views/
│   ├── Login.vue           # Login page
│   ├── TaskList.vue        # Task management + 3D animation carousel
│   ├── Home.vue            # Home/dashboard
│   ├── Fortune.vue         # Fortune telling feature
│   ├── BmiManager.vue      # BMI calculator
│   ├── AdminUsers.vue      # User management (admin only)
│   ├── SecureNotes.vue     # Encrypted notes
│   ├── ChangePassword.vue  # Password change
│   ├── CrazyCountdown.vue  # Countdown timer page
│   └── MenuManager.vue     # Weekly menu management (AI vision)
├── components/
│   ├── TaskForm.vue        # 任务新建/编辑对话框 (含图片上传)
│   ├── TaskCard.vue        # 任务卡片组件 (含图片缩略图预览)
│   ├── CountdownOverlay.vue # 倒计时全屏覆盖提醒
│   ├── LifeProgress.vue    # 人生进度可视化
│   └── relax/              # 20 个 Three.js 3D 放松动画
└── composables/
    └── useAuth.js          # Auth state composable
```

**Key Patterns:**

1. **API Client (`api/index.js`):**
   - Axios instance with base URL from `VITE_API_BASE_URL` (default `/api`)
   - 60s timeout (for AI-powered features)
   - Request interceptor: adds `Authorization: Bearer <token>` header
   - Response interceptor: handles 401 (redirect to login), shows error messages

2. **Routing (`router.js`):**
   - All routes except `/login` require auth (`meta.requiresAuth: true`)
   - Admin routes have `meta.requiresAdmin: true`
   - `beforeEach` guard checks token and role

3. **Authentication Flow:**
   - Login → store token + user → redirect to tasks
   - 401 response → clear storage → redirect to login
   - Token stored as `tasklist_token` in localStorage

## Configuration

**Backend (`backend/wrangler.jsonc`):**
- `vars.CORS_ORIGINS`: Allowed frontend origins (comma-separated)
- `vars.AI_BASE_URL`: AI service URL
- `vars.AI_MODEL`: AI model name
- Secrets (via `wrangler secret put`): `SECRET_KEY`, `AI_API_KEY`, `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `OPENAI_API_KEY`
- D1 binding: `DB` → `tasklist_db`
- R2 binding: `IMAGES_BUCKET` → `tasklist-images`
- Durable Object binding: `CODE_REVIEW_CONTAINER` → `CodeReviewContainer`
- Container: `CodeReviewContainer` (Node.js, Code Review 自动化)

**Frontend (`frontend/.env.production`):**
- `VITE_API_BASE_URL`: API base URL (production: `https://api-tasklist.ch-tools.org/api`)

**Frontend Deployment (`frontend/wrangler.jsonc`):**
- Cloudflare Workers static asset deployment
- SPA routing via `not_found_handling: "single-page-application"`
- Auto-build & deploy on `git push` to master

## Common Patterns

### Adding a New Protected API Endpoint

```typescript
// src/routes/your-feature.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { authMiddleware } from '../middleware/auth'
import type { Env } from '../types'

export const yourRoutes = new Hono<Env>()
yourRoutes.use('*', authMiddleware)

yourRoutes.get('/', async (c) => {
  const user = c.get('user')
  const db = drizzle(c.env.DB)
  // ... your logic
  return c.json({ result: '...' })
})
```

Then register in `src/index.ts`:
```typescript
import { yourRoutes } from './routes/your-feature'
app.route('/api/your-feature', yourRoutes)
```

### Adding a New Database Table

1. Define table in `src/db/schema.ts` using Drizzle syntax
2. Write migration SQL in `drizzle/` directory
3. Execute: `npx wrangler d1 execute tasklist_db --remote --file=drizzle/xxxx.sql`
4. Import and use in route handlers

### Adding a New Frontend Route

1. Create component in `views/YourComponent.vue`
2. Add route in `router.js` with `meta: { requiresAuth: true }`
3. Add API method in `api/index.js` if needed
4. Add navigation link in `App.vue`

## Cloudflare Workers Constraints

- PBKDF2 iterations: max 100,000
- CPU time: 10ms per request (I/O wait doesn't count)
- Memory: 128MB per request
- No file system access (use console.log for logging)
- D1 is SQLite: no ENUM, dates stored as TEXT, no AUTO_INCREMENT (use INTEGER PRIMARY KEY)

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `123456`
- Role: `admin`

## Git 工作流：提交 → Review → 修复

本项目配置了自动 Code Review 流程，每次 push 到 dev 分支后会自动触发。提交代码后必须遵循以下流程：

1. **提交并推送到 dev 分支**
2. **等待 PR 自动创建**：webhook 会自动创建 dev→master 的 PR（如果没有 open 的）
3. **等待 Review 完成**：轮询 PR 状态直到评论数增加（Codex AI Review 会发评论）
4. **检查 Review 结果**：
   - `VERDICT: PASS` → PR 会被自动合并（若自动合并失败需人工处理），同步本地 `git fetch origin master && git merge origin/master`
   - `VERDICT: FAIL` → PR 不会合并，需要修复后重新提交
5. **修复 Review 问题**：
   - FAIL 时的 critical issues：必须修复，否则 verdict 不会变为 PASS
   - Warnings/Suggestions：PASS 时仍建议修复，提交新 commit 推送到 dev 会触发新一轮 review
6. **重复步骤 3-5**，直到 PASS（自动合并依据是 verdict，不是 warning 数量）

轮询命令：`gh pr view <number> --json state,comments --jq '{state: .state, comment_count: (.comments | length)}'`
查看评论：`gh api repos/chuanhui2020/my-tasklist/issues/<number>/comments --jq '.[<last_index>].body'`
