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
# 执行 SQL（查询/临时修数）
npx wrangler d1 execute tasklist_db --remote --command="SELECT * FROM users"
# schema 迁移：只跑 drizzle/ 下尚未执行的文件，并记入 d1_migrations 表
cd backend && npx wrangler d1 migrations list tasklist_db --remote   # 先看待执行列表
cd backend && npm run db:migrate:prod                                # 再执行
```

> **迁移文件不要再用 `d1 execute --file` 手动跑**：线上库 2026-11-23 起改由 wrangler 迁移管理（`wrangler.jsonc` 的 `migrations_dir: "drizzle"`），0000–0011 已补录为已执行，0012 当天通过 `db:migrate:prod` 正常执行。手动跑的文件不会记进 `d1_migrations`，下次 `db:migrate:prod` 会再跑一遍而失败（`table ... already exists` / `duplicate column`）。

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
│   │   └── menu.ts             # /api/menu/* - 菜单识别 (AI vision)
│   └── lib/
│       ├── crypto.ts           # 密码哈希 (PBKDF2) + 笔记加密 (AES-GCM)
│       ├── token.ts            # JWT 生成/验证 (jose)
│       ├── ai.ts               # AI API 调用 (fetch)
│       └── db.ts               # createDB (drizzle + query 重试封装) + 北京时间助手 + D1Error
├── drizzle/                    # D1 迁移 SQL (0000_initial.sql … 0012_task_images_r2_key_unique.sql)，wrangler migrations 管理
└── scripts/
    ├── export_data.py          # MySQL → JSON 导出 (迁移用)
    └── import-to-d1.ts         # JSON → D1 SQL 导入 (迁移用)
```

**Key Patterns:**

1. **Authentication System:**
   - JWT via `jose` library (HS256, Web Crypto API)
   - Token payload: `{user_id: number, role: string, session_version: string}`；`verifyToken` 限定 HS256 并校验字段类型
   - Tokens expire after 24 hours
   - **会话失效**：`users.token_invalid_before` 存会话版本号，改密码/重置密码时轮换为新 UUID，旧 token 立即失效。
     无 `session_version` 的历史 token 按旧规则（`iat` 晚于该时间戳）兼容到自然过期
   - Protected routes use `authMiddleware`，admin 路由额外加 `adminMiddleware`。`authMiddleware` 和 `fileAuthMiddleware`
     用 `createMiddleware<Env>` 声明（普通函数签名的中间件作为路由首个 handler 时，会让后续 handler 的
     `c.req.param()` 被推断成 `string | undefined`）；`adminMiddleware` 仍是普通函数，只跟在 `authMiddleware` 之后使用
   - 文件直链（`<img src>` / 新标签页）用 `fileAuthMiddleware`，额外接受 `?token=`；普通接口不接受 query token
   - 密码策略：新建用户/改密码要求至少 6 位且含大小写字母、数字、特殊字符（已有密码不受影响）；
     管理员重置密码生成随机临时密码并在前端展示
   - Current user via `c.get('user')` (Hono context variable)

2. **Database Access:**
   - 统一用 `createDB(c.env.DB, 'route')`（`lib/db.ts`）得到 `{ db, query }`
   - `query('label', (db) => db.select()...)` 封装一次自动重试，二次失败抛 `D1Error`（由 `index.ts` 全局 `onError` 捕获）
   - 北京时间助手：`beijingNow() / beijingDate() / beijingDatetime()`（业务按东八区取日期）
   - Schema 定义在 `src/db/schema.ts`
   - D1 基于 SQLite：无 ENUM（用 TEXT + Drizzle enum），日期存 TEXT (ISO 8601)
   - 无自动迁移（deploy 不会跑迁移），schema 变更写 SQL 到 `drizzle/` 后用 `npm run db:migrate:prod` 执行

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
   - Images stored in R2 bucket `tasklist-images`, key format: `tasks/{user_id}/{task_id}/{uuid}.{ext}`；
     带 `upload_id` 时为 `tasks/{user_id}/{task_id}/{upload_id}-{uuid}.{ext}`（每个请求独有对象，并发互不覆盖）
   - Supported formats: JPEG, PNG, WebP; max 5MB per file, max 10 per task
   - **幂等上传**：前端为每个待传文件生成 `upload_id`（UUID，重试复用），单文件上传时随表单提交；去重范围是
     同一用户的同一任务（R2 key 前缀含 user_id/task_id），该范围内同一 `upload_id` 最多一条，
     重试命中已有记录返回 200（元数据不一致返回 409）；不同任务复用同一 `upload_id` 互不影响
   - **并发控制在数据库内完成**：张数上限、任务归属、upload_id 去重、`sort_order` 都在同一条原子
     `INSERT ... SELECT ... WHERE` 中判定；未插入时清理本请求的 R2 对象，按原因返回 200/400/404/409。
     注意 `query()` 失败会自动重试一次，「插入其实已提交」时库里那条就是自己的，不能当成并发落败去删对象
   - Image file serving endpoint supports `?token=JWT` query param for `<img src>` usage (`fileAuthMiddleware`)
   - 删除任务：图片记录与任务在同一个 D1 batch 事务中删除，再按实际删掉的记录清理 R2；
     删除图片：先删记录（RETURNING key）再删对象——最坏只残留无引用对象，不会出现记录在、图片 404
   - `task_images.r2_key` 有唯一索引（迁移 0012）

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
- `vars.AI_MODEL`: 业务 AI 模型（当前 `gpt-6.2-sol`：BMI 建议、体重分析、求签、菜单识别）
- `vars.AI_REASONING_EFFORT`: 全局推理档位（当前 `xhigh`），`callAI` 未显式传 `reasoning_effort` 时使用。
  xhigh 较慢（求签类约 30s），各调用的 `max_completion_tokens` 已按此放宽；菜单识别若超出直连 nginx 的 180s 上限，
  可在 `menu.ts` 显式传 `reasoning_effort: 'high'` 回退
- 生图模型写在 `lib/ai.ts`（当前 `gpt-image-2.6-sunburst`，无推理档位参数）
- Code Review 模型在 `.github/workflows/code-review.yml` 的 `AI_MODEL`（当前 `gpt-6.2-astra`，Codex `model_reasoning_effort = "xhigh"`）
- Secrets (via `wrangler secret put`): `SECRET_KEY`, `AI_API_KEY`（GitHub Actions 另有同名 secret `AI_API_KEY`，换 key 时两处都要换）
- Rate limit binding: `BMI_ADVICE_LIMITER`（`/api/bmi/advice` 按用户 10 次/分钟）
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
- 注意：SPA 回退会把缺失的旧 chunk 返回成 index.html（200 + text/html）。部署后已打开的旧页面切换到按需加载的路由会失败，
  `router.js` 的 `router.onError` 会捕获并整页跳转到目标地址加载新版本（同一目标 10 秒内只重载一次）

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
2. Write migration SQL in `drizzle/` directory，文件名用下一个序号（如 `0013_xxx.sql`），wrangler 按文件名排序执行
3. Execute: `cd backend && npm run db:migrate:prod`（只执行未记录的迁移；本地开发用 `npm run db:migrate`）
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
- Password: `123456`（初始密码；新密码策略只约束之后新建/修改的密码）
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

**Codex CLI 版本已锁死，不会自动升级。**

`code-review.yml` 的 `npm install -g @openai/codex@<version>` 固定了版本（当前 `0.171.0`）。想升级就手动改那一行的版本号，但**升级前务必确认 `codex exec` 的参数和 config.toml 键名没变** —— 2026-08 升到 `0.147.0` 时 `exec` 移除了 `--full-auto`，`codex exec` 直接报 `unexpected argument` 秒退，review 长期静默失效（当时未锁版本，每次自动装 latest）。

升级检查方法：本地装新版本，把 workflow 里的 config.toml 抠出来放进临时 `CODEX_HOME`（base_url 指向本机关闭端口，不连外网），跑 `codex exec --strict-config ...`，看配置能否加载、启动头里的 `sandbox` / `reasoning effort` 是否符合预期。2026-11 升 `0.171.0` 时就是这样查出旧的 `sandbox` / `reasoning_effort` 是无效键（一直被静默忽略），正确键名是 `sandbox_mode` / `model_reasoning_effort`。

配套的防线（改 workflow 时别拆掉）：

- **空输出 = job 变红**：review 无有效输出时会走 `Fail on empty review` 步骤 `exit 1`。此前这种情况 job 仍是绿灯、只打 `needs-fix` 标签，故障要翻 PR 才看得见。该步骤**必须排在评论和打标签之后**，否则 PR 上不会留下任何线索。
- **只从 `-o` 文件解析 review 和 VERDICT**：`codex exec` 的原始输出会回显整段 PROMPT（含 `===REVIEW_START===` 标记和 `VERDICT: PASS` 模板），从原始输出解析会在模型失败时把模板当成 review。
- **`--strict-config`**：config.toml 写错键名直接报错退出（进而触发上一条变红），不再静默忽略。
- **`timeout 1080` 包住 `codex exec`**：网关不通时 codex 会无限重连，必须在步骤超时（20 min，xhigh 档审查较慢）前退出，后续评论/打标签/变红才能执行。
- **原始输出进日志**：`codex exec` 的 stdout/stderr 会 tail 进 job log。定位 review 失败先看这段，别猜。

Codex 以 `--sandbox read-only` + `approval_policy = "never"` 运行：审查只需读代码和跑 `git diff`，不给写盘和联网权限，避免仓库内容做提示注入后窃取 `GH_TOKEN` / `OPENAI_API_KEY`。沙箱只约束模型生成的命令，codex 自身访问模型 API 不受影响。

**提交代码后建议流程：**

1. 提交并 push 到 `dev`
2. 轮询最新 workflow run：`gh run list --branch dev --limit 1 --json status,conclusion,headSha`
3. 查看 review 评论：`gh api repos/chuanhui2020/my-tasklist/issues/<PR号>/comments --jq '.[-1].body'`
4. **PASS 合并后**同步本地：`git fetch origin master && git merge origin/master && git push origin dev`
5. **FAIL** → 修复 critical 问题后再次 push，触发新一轮 review，直到 PASS
6. **后端改动需手动部署**：`cd backend && npx wrangler deploy`（前端由 master push 自动部署，后端不会随合并自动上线）
