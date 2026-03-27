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

### Docker Compose

**Quick Start:**

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Edit .env file (IMPORTANT: change passwords and secret key!)
nano .env

# 3. Start all services
docker compose up -d --build

# Or use the startup script
./docker-start.sh
```

**Access:** http://localhost:3000

**Common Commands:**

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Update code
git pull && docker compose up -d --build

# Backup database
docker compose exec db mysqldump -u root -p tasklist_db > backup.sql
```

**See [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) for detailed documentation.**

**Docker Architecture:**
- `db` service: MySQL 8.4 database
- `backend` service: FastAPI + Uvicorn (Python 3.10)
- `frontend` service: Nginx + Vue 3 static files
- `prometheus` service: Prometheus monitoring (15-day data retention)
- `grafana` service: Grafana dashboard (via `grafana.ch-tools.org`)
- `mysql-exporter` service: MySQL metrics exporter for Prometheus

**Environment Variables (.env):**
- `MYSQL_ROOT_PASSWORD`: Database root password
- `MYSQL_PASSWORD`: Application database password
- `SECRET_KEY`: Application secret key (must be random in production!)
- `FRONTEND_PORT`: Frontend access port (default: 3000)
- `GRAFANA_PASSWORD`: Grafana admin password (default: admin123)

**Data Persistence:**
- Database data: `mysql_data` Docker volume
- Prometheus data: `prometheus_data` Docker volume
- Grafana data: `grafana_data` Docker volume
- Survives container restarts and rebuilds
- Backup regularly for production use

**Monitoring (Prometheus + Grafana):**
- Prometheus scrapes FastAPI metrics (`backend:8000/metrics`) and MySQL metrics (`mysql-exporter:9104`) every 15s
- Grafana auto-provisions Prometheus as default datasource via `grafana/provisioning/datasources/datasources.yml`
- Grafana accessible at `https://grafana.ch-tools.org` (Nginx reverse proxy + Cloudflare HTTPS)
- MySQL Exporter uses dedicated DB user, config in `mysql-exporter/.my.cnf`, init SQL in `mysql-exporter/init-exporter-user.sql`
- Data retention: 15 days (`--storage.tsdb.retention.time=15d`)

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
   - Axios instance with `/api` base URL
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
- Backend API URL read from `VITE_BACKEND_URL` environment variable
- Default: `http://localhost:8000`
- In Docker: Nginx handles API proxy, so this is only for development

**Docker Environment:**
- All configuration via `.env` file
- Docker Compose automatically sets `DATABASE_URL` for backend
- Frontend uses Nginx reverse proxy (no need for CORS or proxy config)

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
