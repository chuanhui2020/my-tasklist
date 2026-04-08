# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Task Management System - A full-stack web application built with FastAPI (backend) + Vue 3 (frontend) + MySQL.

**Tech Stack:**
- Backend: FastAPI, SQLAlchemy 2.0, PyMySQL
- Frontend: Vue 3, Vue Router 4, Element Plus, Vite
- Database: MySQL 8.4
- Auth: JWT-like tokens using itsdangerous

## Deployment

### Production Architecture

```
Cloudflare Workers (free)
└── Vue 3 SPA static files (tasklist.ch-tools.org)
    Built & deployed via wrangler on git push

Server (1C2G Singapore, shared with other services)
├── caddy (reverse proxy, already running)
├── tasklist-backend (FastAPI, 127.0.0.1:9000 → container :8000)
└── tasklist-db (MySQL 8.4, 127.0.0.1:3307 → container :3306)
    API domain: api-tasklist.ch-tools.org
```

Frontend and backend are cross-origin. Backend uses `CORS_ORIGINS` env var to allow the frontend domain.

**Production deploy (backend):**
```bash
cd ~/my-tasklist
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

**Frontend auto-deploys** on every `git push` via Cloudflare Workers build pipeline.

### Local Development (Docker Compose)

```bash
cp .env.example .env && nano .env
docker compose up -d --build
# Access: http://localhost:3000
```

Uses `docker-compose.yml` which includes frontend Nginx container + backend + db (all-in-one).

**Common Commands:**
```bash
docker compose logs -f
docker compose restart
docker compose down
docker compose exec db mysqldump -u root -p tasklist_db > backup.sql
```

**Environment Variables (.env):**
- `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD`: Database passwords
- `SECRET_KEY`: Token signing key (itsdangerous)
- `CORS_ORIGINS`: Allowed frontend origins (comma-separated)
- `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`: AI service config
- `VITE_API_BASE_URL`: Frontend API base URL (build-time, for Cloudflare Workers)

**Data Persistence:** `mysql_data` Docker volume

## Architecture

### Backend Structure

```
backend/
├── app.py              # FastAPI app entry point, lifespan, router registration
├── config.py           # Settings class (env-based configuration)
├── database.py         # SQLAlchemy engine, SessionLocal, Base, get_db dependency
├── models.py           # SQLAlchemy models: User, Task
├── schemas.py          # Pydantic request models
├── auth_utils.py       # Token generation/verification, get_current_user / require_admin dependencies
└── routes/
    ├── auth_routes.py      # /api/auth/* - login, profile, user management
    ├── task_routes.py      # /api/tasks/* - CRUD for tasks
    ├── fortune_routes.py   # /api/fortune/* - fortune telling feature
    └── bmi_routes.py       # /api/bmi/* - BMI calculator feature
```

**Key Patterns:**

1. **Authentication System:**
   - Uses `itsdangerous.URLSafeTimedSerializer` for stateless tokens
   - Token payload: `{user_id: int, role: str}`
   - Tokens expire after 24 hours (configurable via `AUTH_TOKEN_MAX_AGE`)
   - Protected routes use `Depends(get_current_user)` or `Depends(require_admin)`
   - Current user injected via FastAPI dependency injection

2. **Database Initialization (`app.py` lifespan):**
   - On startup, the app:
     - Creates all tables via `Base.metadata.create_all()`
     - Checks and migrates schema (e.g., password_hash length, user_id column)
     - Creates default admin user (username: `admin`, password: `123456`)
     - Updates existing tasks to belong to admin if user_id is NULL

3. **Database Session (`database.py`):**
   - `get_db()` generator provides a SQLAlchemy session per request via `Depends(get_db)`
   - Session is automatically closed after each request

4. **Models (`models.py`):**
   - `User`: username, password_hash, role (admin/user), has many tasks
   - `Task`: title, description, status (pending/done), due_date, user_id (FK)
   - All models have `to_dict()` methods for JSON serialization

5. **API Response Pattern:**
   - Success: `return {...}` (or `JSONResponse({...}, status_code=201)` for creation)
   - Error: `JSONResponse({'error': 'message'}, status_code=4xx)`
   - Custom exception handlers ensure `HTTPException` returns `{"error": "..."}` format
   - `RequestValidationError` returns 400 + `{"error": "参数格式错误"}`
   - Auth errors return 401, permission errors return 403

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
│   └── ChangePassword.vue  # Password change
├── components/
│   ├── MilkDragon.vue      # 3D voxel dragon scene (Three.js)
│   └── relax/              # 9 Three.js 3D relaxation animations
│       ├── BreathingCircle.vue    # 极光 (Aurora ribbons + ShaderMaterial)
│       ├── PendulumWave.vue       # 数字雨 (Matrix-style 3D text rain)
│       ├── RainDrops.vue          # 粒子星系 (8000-particle spiral galaxy)
│       ├── LavaLamp.vue           # 几何隧道 (Neon geometric tunnel)
│       ├── BouncingBalls.vue      # 粒子网络 (Node network with dynamic connections)
│       ├── Kaleidoscope.vue       # 流光线条 (Glowing spiral curves)
│       ├── ParticleFireworks.vue  # 分形生长 (Fractal tree growth animation)
│       ├── WaterRipple.vue        # 波形山脉 (Synthwave wireframe terrain)
│       └── StarrySky.vue          # DNA螺旋 (Double helix with particles)
└── composables/
    └── useAuth.js          # Auth state composable
```

**Key Patterns:**

1. **API Client (`api/index.js`):**
   - Axios instance with base URL from `VITE_API_BASE_URL` env var (default `/api`)
   - 60s timeout (for AI-powered features)
   - Request interceptor: adds `Authorization: Bearer <token>` header
   - Response interceptor: handles 401 (redirect to login), shows error messages
   - `authStorage` utility: manages `tasklist_token` and `tasklist_user` in localStorage

2. **Routing (`router.js`):**
   - All routes except `/login` require auth (`meta.requiresAuth: true`)
   - Admin routes have `meta.requiresAdmin: true`
   - `beforeEach` guard checks token and role before navigation
   - Login page accepts `?redirect=` query param for post-login redirection

3. **Authentication Flow:**
   - Login → store token + user object → redirect to tasks or original route
   - 401 response → clear storage → redirect to login with current path as redirect param
   - Token stored as `tasklist_token`, user object as `tasklist_user` (JSON string)

## Special Features

### Fortune Telling (`fortune_routes.py`, `Fortune.vue`)
- AI-generated fortune telling based on user input
- Long timeout (60s) for AI processing
- Uses external API (likely AI service)

### BMI Calculator (`bmi_routes.py`, `BmiManager.vue`)
- BMI calculation with AI-generated health advice
- Stores BMI records per user
- Extended timeout for AI advice generation

### 3D Animation Carousel (TaskList.vue sidebar)
- 10 Three.js 3D scenes auto-rotating every 10 seconds in the "体素花园" sidebar
- Components in `components/relax/` + `MilkDragon.vue`
- All components use `markRaw()` to prevent Vue deep reactivity on Three.js objects
- Each component manages its own `requestAnimationFrame` loop and cleanup via `onBeforeUnmount`
- Controls: previous/pause/next buttons + clickable navigation dots
- Uses Additive Blending, GLSL ShaderMaterial, BufferGeometry particles, InstancedMesh

## Database Migrations

The app performs **inline schema migrations** in `app.py` lifespan on startup:
- Checks column existence/type via SQLAlchemy `inspect()`
- Executes raw SQL `ALTER TABLE` statements when needed
- Example: ensures `users.password_hash` is VARCHAR(512), adds `tasks.user_id` if missing

**When adding new columns:**
1. Update the model in `models.py`
2. Add migration logic in `app.py` lifespan startup section
3. Use `inspector.get_columns()` to check if column exists before altering

## Configuration

**No Hardcoded Values:**
- All sensitive configuration is read from environment variables
- `.env.example` provides a template for required variables
- Never commit `.env` file to Git (already in `.gitignore`)

**Backend (`backend/config.py`):**
- `SECRET_KEY`: Application secret key (from `SECRET_KEY` env var)
- `DATABASE_URL`: Full database connection string (from `DATABASE_URL` env var)
- Falls back to localhost defaults for development

**Frontend (`frontend/vite.config.js`):**
- `VITE_API_BASE_URL`: API base URL, set at build time (Cloudflare Workers uses `https://api-tasklist.ch-tools.org/api`)
- Default: `/api` (for local dev with Nginx proxy)
- `VITE_BACKEND_URL`: Dev server proxy target (default `http://localhost:8000`)

**Frontend Deployment (`frontend/wrangler.jsonc`):**
- Cloudflare Workers static asset deployment
- SPA routing via `not_found_handling: "single-page-application"`
- Auto-build & deploy on `git push` to master

**Docker Environment:**
- Local dev: `docker-compose.yml` (frontend + backend + db, all-in-one)
- Production: `docker-compose.prod.yml` (backend + db only, frontend on Cloudflare Workers)

## Common Patterns

### Adding a New Protected API Endpoint

```python
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from auth_utils import get_current_user, require_admin
from models import User

your_router = APIRouter(prefix='/api/your-feature')

@your_router.get('/your-route')
def your_handler(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # or Depends(require_admin)
):
    # ... your logic
    return {'result': '...'}
```

Then register in `app.py`:
```python
from routes.your_routes import your_router
app.include_router(your_router)
```

### Adding a New Frontend Route

1. Create component in `views/YourComponent.vue`
2. Add route in `router.js`:
   ```javascript
   {
     path: '/your-path',
     name: 'YourComponent',
     component: YourComponent,
     meta: { requiresAuth: true }  // add requiresAdmin: true if needed
   }
   ```
3. Add API method in `api/index.js` if needed
4. Add navigation link in `App.vue`

### Adding a New Database Model

1. Define model in `models.py` with `to_dict()` method (inherit from `Base`)
2. Add migration logic in `app.py` lifespan (check if table/columns exist)
3. Import and use in route handlers
4. Remember to commit with `db.commit()`

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `123456`
- Role: `admin`

Created automatically on first startup if not exists.
