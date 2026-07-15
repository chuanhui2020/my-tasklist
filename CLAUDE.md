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
       │   ├── Queue (fortune-image-queue，占卜生图异步任务)
       │   └── Cron (*/5 min，保活 D1)
       └── Workers Static Assets (前端 SPA)  ← tasklist.ch-tools.org
```

全栈边缘部署，零服务器成本。前后端跨域（不同子域名），后端配置 CORS。Code Review 自动化已从 Cloudflare Container 迁移到 GitHub Actions（见下方「Git 工作流」）。

**部署后端：**
```bash
cd backend
npx wrangler deploy
```

**前端自动部署：** 每次 `git push` 到 master 触发 Cloudflare Workers 构建。

**管理 Secrets：**
```bash
echo "value" | npx wrangler secret put SECRET_KEY   # JWT 签名密钥
echo "value" | npx wrangler secret put AI_API_KEY    # AI 服务密钥
```
> Code Review 的 AI 密钥是 GitHub Actions Secret（`AI_API_KEY`），与 Worker 的 wrangler secret 相互独立。

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
├── wrangler.jsonc              # Workers 配置 + D1/R2/Queue binding + Cron
├── package.json
├── tsconfig.json
├── drizzle.config.ts           # Drizzle 迁移配置
├── src/
│   ├── index.ts                # Hono app 入口，路由注册，CORS，scheduled(cron) + queue 消费者
│   ├── types.ts                # Env 类型定义 (Bindings)
│   ├── db/
│   │   └── schema.ts           # Drizzle 表定义 (所有模型)
│   ├── middleware/
│   │   └── auth.ts             # JWT 验证中间件 + admin 权限中间件
│   ├── routes/
│   │   ├── auth.ts             # /api/auth/* - 登录、用户管理、改密码
│   │   ├── tasks.ts            # /api/tasks/* - 任务 CRUD + 分页排序 + 图片上传/预览/删除
│   │   ├── fortune.ts          # /api/fortune/* - AI 运势签文 + 异步生图 (Queue)
│   │   ├── bmi.ts              # /api/bmi/* - BMI + 体重记录(upsert) + AI 分析
│   │   ├── secure-notes.ts     # /api/secure-notes/* - 加密笔记
│   │   ├── countdowns.ts       # /api/countdowns/* - 倒计时提醒
│   │   ├── menu.ts             # /api/menu/* - 菜单识别 (AI vision)
│   │   └── finance.ts          # /api/finance/* - 贷款管理 + 独立密码
│   └── lib/
│       ├── crypto.ts           # 密码哈希 (PBKDF2) + 笔记加密 (AES-GCM)
│       ├── token.ts            # JWT 生成/验证 (jose)
│       ├── ai.ts               # AI API 调用 (fetch)
│       └── db.ts               # createDB (drizzle + query 重试封装) + 北京时间助手 + D1Error
├── drizzle/                    # D1 迁移 SQL (0000_initial.sql … 0008_fortune_image_status.sql)
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
   - 统一用 `createDB(c.env.DB, 'route')`（`lib/db.ts`）得到 `{ db, query }`
   - `query('label', (db) => db.select()...)` 封装一次自动重试，二次失败抛 `D1Error`（由 `index.ts` 全局 `onError` 捕获）
   - 北京时间助手：`beijingNow() / beijingDate() / beijingDatetime()`（业务按东八区取日期）
   - Schema 定义在 `src/db/schema.ts`
   - D1 基于 SQLite：无 ENUM（用 TEXT + Drizzle enum），日期存 TEXT (ISO 8601)
   - 无自动迁移，schema 变更需手动写 SQL 并执行

3. **Models (`db/schema.ts`):**
   - `users`: username, password_hash, role (admin/user), last_login_at, token_invalid_before
   - `tasks`: title, description, status (pending/done), due_date, user_id
   - `taskImages`: task_id, user_id, r2_key, filename, mime_type, size, sort_order
   - `bmiProfiles`: gender, age, height, weight (per user, unique)
   - `fortuneRecords`: fortune_number, fortune_type, type_text, poem, interpretation, advice, work_fortune, image_r2_key, image_status
   - `secureNotes`: title, description, encrypted_content, salt, password_hash
   - `weightRecords`: weight, date (unique per user per date；写入为 upsert，同日再记录即更新)
   - `countdowns`: title, target_time, remind_before, remind_level, status
   - `weeklyMenus`: week_start, menu_json, uploaded_by
   - `financePasswords`: 财务模块独立密码 (per user, unique)
   - `loans`: name, bank, loan_type (mortgage/bank_loan), remaining_balance, monthly_payment, remaining_months, annual_rate, status

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
- `vars.AI_BASE_URL`: AI 服务地址（橙云网关）
- `vars.AI_IMAGE_BASE_URL`: AI 生图直连地址（灰云直连，绕过 100s 超时）
- `vars.AI_MODEL`: AI model name
- Secrets (via `wrangler secret put`): `SECRET_KEY`, `AI_API_KEY`
- D1 binding: `DB` → `tasklist_db`
- R2 binding: `IMAGES_BUCKET` → `tasklist-images`
- Queue binding: `FORTUNE_IMAGE_QUEUE` → `fortune-image-queue`（占卜生图异步，producer + consumer）
- Cron 触发器: `*/5 * * * *`（scheduled handler 跑 `SELECT 1` 保活 D1）

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
import { authMiddleware } from '../middleware/auth'
import { createDB } from '../lib/db'
import type { Env } from '../types'

export const yourRoutes = new Hono<Env>()
yourRoutes.use('*', authMiddleware)

yourRoutes.get('/', async (c) => {
  const user = c.get('user')
  const { query } = createDB(c.env.DB, 'your-feature')
  const rows = await query('list items', (db) => db.select().from(/* table */))
  return c.json({ result: rows })
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

自动 Code Review 由 **GitHub Actions**（`.github/workflows/code-review.yml`）驱动，push 到任意 **非 master/main** 分支即触发。Workflow 分三个 job 顺序执行：

1. **lint** → 前端 `npm run lint` + 后端 `npm run lint`
2. **build-check** → 前端 `npm run build` + 后端 `npm run typecheck`
3. **code-review** →
   - 查找/创建 `dev→master` PR（标题 `Auto PR: <branch>`）
   - Codex CLI 审查 `git diff origin/master...HEAD`，按固定格式发 PR 评论并给出 `VERDICT: PASS|FAIL`
   - **PASS** → `gh pr merge` 自动合并到 master（合并失败会留言提示人工处理）
   - **FAIL** → 不合并，给 PR 打 `needs-fix` 标签

> 只有 lint、build-check 通过后才会跑 Codex review；所以本地 push 前先自查 `lint` / `build` / `typecheck` 可少走弯路。

**提交代码后建议流程：**

1. 提交并 push 到 `dev`
2. 轮询最新 workflow run：`gh run list --branch dev --limit 1 --json status,conclusion,headSha`
3. 查看 review 评论：`gh api repos/chuanhui2020/my-tasklist/issues/<PR号>/comments --jq '.[-1].body'`
4. **PASS 合并后**同步本地：`git fetch origin master && git merge origin/master && git push origin dev`
5. **FAIL** → 修复 critical 问题后再次 push，触发新一轮 review，直到 PASS
6. **后端改动需手动部署**：`cd backend && npx wrangler deploy`（前端由 master push 自动部署，后端不会随合并自动上线）
