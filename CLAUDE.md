# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal Task Management System - A full-stack web application built with Flask (backend) + Vue 3 (frontend) + MySQL.

**Tech Stack:**
- Backend: Flask 2.3, Flask-SQLAlchemy, PyMySQL
- Frontend: Vue 3, Vue Router 4, Element Plus, Vite
- Database: MySQL 8.0+
- Auth: JWT-like tokens using itsdangerous

## Deployment Options

### Option 1: Docker Compose (Recommended for Production)

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
- `db` service: MySQL 8.0 database
- `backend` service: Flask + Gunicorn (Python 3.10)
- `frontend` service: Nginx + Vue 3 static files

**Environment Variables (.env):**
- `MYSQL_ROOT_PASSWORD`: Database root password
- `MYSQL_PASSWORD`: Application database password
- `SECRET_KEY`: Flask secret key (must be random in production!)
- `FRONTEND_PORT`: Frontend access port (default: 3000)

**Data Persistence:**
- Database data: `mysql_data` Docker volume
- Survives container restarts and rebuilds
- Backup regularly for production use

### Option 2: Traditional Deployment (Development)

#### Backend (Python)

The project supports both `uv` (preferred) and `pip` for dependency management.

```bash
cd backend

# With uv (recommended):
uv venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync --frozen --no-dev

# With pip (fallback):
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server:
python app.py  # Runs on http://localhost:5000
```

**Dependencies are managed in:**
- `pyproject.toml` (primary, used by uv)
- `requirements.txt` (fallback for pip, also used by Docker)
- `uv.lock` (lockfile)

#### Frontend (Vue 3)

```bash
cd frontend

# Install dependencies:
npm install

# Development server with environment variable:
VITE_BACKEND_URL=http://localhost:5000 npm run dev    # Runs on http://localhost:3000

# Production build:
npm run build

# Preview production build:
npm run preview
```

**Frontend Configuration:**
- `vite.config.js` reads `VITE_BACKEND_URL` from environment
- Default: `http://localhost:5000`
- Set different URL for remote backend

#### Full Stack Startup (Legacy)

Use the provided shell scripts:

```bash
# Development mode (hot reload):
./start.sh dev

# Production mode (builds frontend):
./start.sh prod

# Stop all services:
./stop.sh
```

The `start.sh` script:
- Checks for Python3, Node.js, and MySQL
- Starts backend on port 5000
- Starts frontend on port 3000
- Logs to `backend.log` and `frontend.log`
- Saves PIDs to `.pids` file

#### Database Setup (Manual)

```bash
mysql -u root -p
CREATE DATABASE tasklist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tasklist_db;
SOURCE database.sql;
```

**Default database config** (in `backend/config.py`):
```
mysql+pymysql://root:123456@localhost/tasklist_db?charset=utf8mb4
```

Override via environment variable: `DATABASE_URL`

## Architecture

### Backend Structure

```
backend/
├── app.py              # Flask app entry point, blueprint registration
├── config.py           # Database and secret key configuration
├── models.py           # SQLAlchemy models: User, Task
├── auth_utils.py       # Token generation/verification, @require_auth decorator
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
   - Protected routes use `@require_auth()` or `@require_auth(role='admin')` decorator
   - Current user stored in Flask's `g.current_user`

2. **Database Initialization (`app.py`):**
   - On startup, the app:
     - Creates all tables via `db.create_all()`
     - Checks and migrates schema (e.g., password_hash length, user_id column)
     - Creates default admin user (username: `admin`, password: `123456`)
     - Updates existing tasks to belong to admin if user_id is NULL

3. **Models (`models.py`):**
   - `User`: username, password_hash, role (admin/user), has many tasks
   - `Task`: title, description, status (pending/done), due_date, user_id (FK)
   - All models have `to_dict()` methods for JSON serialization

4. **API Response Pattern:**
   - Success: `return jsonify({...}), 200` (or 201 for creation)
   - Error: `return jsonify({'error': 'message'}), 4xx`
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
│   ├── TaskList.vue        # Task management (main feature)
│   ├── Home.vue            # Home/dashboard
│   ├── Fortune.vue         # Fortune telling feature
│   ├── BmiManager.vue      # BMI calculator
│   ├── AdminUsers.vue      # User management (admin only)
│   └── ChangePassword.vue  # Password change
└── components/             # Reusable components
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

## Database Migrations

The app performs **inline schema migrations** in `app.py` on startup:
- Checks column existence/type via SQLAlchemy `inspect()`
- Executes raw SQL `ALTER TABLE` statements when needed
- Example: ensures `users.password_hash` is VARCHAR(512), adds `tasks.user_id` if missing

**When adding new columns:**
1. Update the model in `models.py`
2. Add migration logic in `app.py` startup section (inside `with app.app_context()`)
3. Use `inspector.get_columns()` to check if column exists before altering

## Configuration

**No Hardcoded Values:**
- All sensitive configuration is read from environment variables
- `.env.example` provides a template for required variables
- Never commit `.env` file to Git (already in `.gitignore`)

**Backend (`backend/config.py`):**
- `SECRET_KEY`: Flask secret key (from `SECRET_KEY` env var)
- `DATABASE_URL`: Full database connection string (from `DATABASE_URL` env var)
- Falls back to localhost defaults for development

**Frontend (`frontend/vite.config.js`):**
- Backend API URL read from `VITE_BACKEND_URL` environment variable
- Default: `http://localhost:5000`
- In Docker: Nginx handles API proxy, so this is only for development

**Docker Environment:**
- All configuration via `.env` file
- Docker Compose automatically sets `DATABASE_URL` for backend
- Frontend uses Nginx reverse proxy (no need for CORS or proxy config)

## Common Patterns

### Adding a New Protected API Endpoint

```python
from flask import Blueprint, request, jsonify, g
from auth_utils import require_auth
from models import db

your_bp = Blueprint('your_feature', __name__)

@your_bp.route('/your-route', methods=['GET'])
@require_auth()  # or @require_auth(role='admin')
def your_handler():
    current_user = g.current_user
    # ... your logic
    return jsonify({'result': '...'}), 200
```

Then register in `app.py`:
```python
from routes.your_routes import your_bp
app.register_blueprint(your_bp, url_prefix='/api/your-feature')
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

1. Define model in `models.py` with `to_dict()` method
2. Add migration logic in `app.py` startup (check if table/columns exist)
3. Import and use in route handlers
4. Remember to commit with `db.session.commit()`

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `123456`
- Role: `admin`

Created automatically on first startup if not exists.
