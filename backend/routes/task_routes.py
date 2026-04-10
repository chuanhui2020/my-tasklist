from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import case
from datetime import datetime
from models import Task, User
from schemas import TaskCreate, TaskUpdate, TaskStatusUpdate
from database import get_db
from auth_utils import get_current_user

task_router = APIRouter(prefix='/api')


@task_router.get('/tasks')
def get_tasks(
    status: str = Query(default=None),
    sort: str = Query(default='due_date'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.user_id == user.id)

    if status:
        query = query.filter(Task.status == status)

    total = query.count()

    if sort == 'created_at':
        query = query.order_by(Task.created_at.desc())
    else:
        query = query.order_by(
            case((Task.due_date.is_(None), 1), else_=0),
            Task.due_date.asc(),
            Task.created_at.desc(),
        )

    offset = (page - 1) * page_size
    tasks = query.offset(offset).limit(page_size).all()

    return {
        'items': [task.to_dict() for task in tasks],
        'total': total,
        'page': page,
        'page_size': page_size,
    }


@task_router.get('/tasks/{task_id}')
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return JSONResponse({'error': '任务不存在'}, status_code=404)
    return task.to_dict()


@task_router.post('/tasks', status_code=201)
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not body.title:
        return JSONResponse({'error': '任务标题不能为空'}, status_code=400)

    due_date = None
    if body.due_date:
        try:
            due_date = datetime.strptime(body.due_date, '%Y-%m-%d').date()
        except ValueError:
            return JSONResponse({'error': '日期格式错误，请使用 YYYY-MM-DD 格式'}, status_code=400)

    task = Task(
        title=body.title,
        description=body.description or '',
        due_date=due_date,
        user_id=user.id,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return JSONResponse(task.to_dict(), status_code=201)


@task_router.put('/tasks/{task_id}')
def update_task(
    task_id: int,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return JSONResponse({'error': '任务不存在'}, status_code=404)

    if not body.title:
        return JSONResponse({'error': '任务标题不能为空'}, status_code=400)

    task.title = body.title
    task.description = body.description or ''

    if body.due_date:
        try:
            task.due_date = datetime.strptime(body.due_date, '%Y-%m-%d').date()
        except ValueError:
            return JSONResponse({'error': '日期格式错误，请使用 YYYY-MM-DD 格式'}, status_code=400)
    else:
        task.due_date = None

    db.commit()
    db.refresh(task)
    return task.to_dict()


@task_router.patch('/tasks/{task_id}/status')
def update_task_status(
    task_id: int,
    body: TaskStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return JSONResponse({'error': '任务不存在'}, status_code=404)

    if body.status not in ['pending', 'done']:
        return JSONResponse({'error': '无效的状态值'}, status_code=400)

    task.status = body.status
    db.commit()
    db.refresh(task)

    return task.to_dict()


@task_router.delete('/tasks/{task_id}')
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return JSONResponse({'error': '任务不存在'}, status_code=404)

    db.delete(task)
    db.commit()

    return {'message': '任务已删除'}
