import sys
import os

os.environ['PYTHONUNBUFFERED'] = '1'

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import inspect, text
from config import settings
from database import engine, SessionLocal, Base
from models import User, Task, FortuneRecord


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and run migrations
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        inspector = inspect(engine)
        user_columns = {col['name']: col for col in inspector.get_columns('users')}
        password_col = user_columns.get('password_hash')
        if password_col and getattr(password_col.get('type'), 'length', 512) < 512:
            db.execute(text('ALTER TABLE users MODIFY password_hash VARCHAR(512) NOT NULL'))
            db.commit()
            inspector = inspect(engine)

        admin = db.query(User).filter_by(username='admin').first()
        if not admin:
            admin = User(username='admin', role='admin')
            admin.set_password('123456')
            db.add(admin)
            db.commit()
            db.refresh(admin)

        inspector = inspect(engine)
        task_columns = {col['name']: col for col in inspector.get_columns('tasks')}
        if 'user_id' not in task_columns:
            db.execute(text('ALTER TABLE tasks ADD COLUMN user_id INT NULL'))
            db.commit()
            inspector = inspect(engine)
            task_columns = {col['name']: col for col in inspector.get_columns('tasks')}

        if 'user_id' in task_columns:
            db.execute(
                text('UPDATE tasks SET user_id = :admin_id WHERE user_id IS NULL'),
                {'admin_id': admin.id},
            )
            db.commit()
            if task_columns['user_id'].get('nullable', False):
                db.execute(text('ALTER TABLE tasks MODIFY user_id INT NOT NULL'))
                db.commit()
            inspector = inspect(engine)
            indexes = inspector.get_indexes('tasks')
            if not any(idx['name'] == 'idx_tasks_user' for idx in indexes):
                try:
                    db.execute(text('ALTER TABLE tasks ADD INDEX idx_tasks_user (user_id)'))
                    db.commit()
                except Exception:
                    db.rollback()

        # Migrate fortune_records: add work_fortune column
        if 'fortune_records' in inspector.get_table_names():
            fr_columns = {col['name'] for col in inspector.get_columns('fortune_records')}
            if 'work_fortune' not in fr_columns:
                try:
                    db.execute(text('ALTER TABLE fortune_records ADD COLUMN work_fortune TEXT NULL'))
                    db.commit()
                except Exception:
                    db.rollback()
    finally:
        db.close()

    yield


app = FastAPI(lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Custom exception handlers for consistent error response format
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse({'error': exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse({'error': '参数格式错误'}, status_code=400)


# Register routers
from routes.auth_routes import auth_router
from routes.task_routes import task_router
from routes.fortune_routes import fortune_router
from routes.bmi_routes import bmi_router

app.include_router(auth_router)
app.include_router(task_router)
app.include_router(fortune_router)
app.include_router(bmi_router)
