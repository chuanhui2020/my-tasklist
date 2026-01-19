from flask import Blueprint, request, jsonify, g
from models import db, Task
from datetime import datetime
from sqlalchemy import case
from auth_utils import require_auth


task_bp = Blueprint('tasks', __name__)

@task_bp.route('/tasks', methods=['GET'])
@require_auth()
def get_tasks():
    status_filter = request.args.get('status')
    sort_by = request.args.get('sort', 'due_date')

    query = Task.query.filter(Task.user_id == g.current_user.id)

    if status_filter:
        query = query.filter(Task.status == status_filter)

    if sort_by == 'created_at':
        tasks = query.order_by(Task.created_at.desc()).all()
    else:
        tasks = query.order_by(
            case((Task.due_date.is_(None), 1), else_=0),
            Task.due_date.asc(),
            Task.created_at.desc()
        ).all()

    return jsonify([task.to_dict() for task in tasks])

@task_bp.route('/tasks/<int:task_id>', methods=['GET'])
@require_auth()
def get_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=g.current_user.id).first()
    if not task:
        return jsonify({'error': '任务不存在'}), 404
    return jsonify(task.to_dict())

@task_bp.route('/tasks', methods=['POST'])
@require_auth()
def create_task():
    data = request.json or {}

    if not data.get('title'):
        return jsonify({'error': '任务标题不能为空'}), 400

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD 格式'}), 400

    task = Task(
        title=data['title'],
        description=data.get('description', ''),
        due_date=due_date,
        user_id=g.current_user.id
    )

    db.session.add(task)
    db.session.commit()

    return jsonify(task.to_dict()), 201

@task_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@require_auth()
def update_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=g.current_user.id).first()
    if not task:
        return jsonify({'error': '任务不存在'}), 404

    data = request.json or {}

    if not data.get('title'):
        return jsonify({'error': '任务标题不能为空'}), 400

    task.title = data['title']
    task.description = data.get('description', '')

    if data.get('due_date'):
        try:
            task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD 格式'}), 400
    else:
        task.due_date = None

    db.session.commit()
    return jsonify(task.to_dict())

@task_bp.route('/tasks/<int:task_id>/status', methods=['PATCH'])
@require_auth()
def update_task_status(task_id):
    task = Task.query.filter_by(id=task_id, user_id=g.current_user.id).first()
    if not task:
        return jsonify({'error': '任务不存在'}), 404

    data = request.json or {}

    if 'status' not in data or data['status'] not in ['pending', 'done']:
        return jsonify({'error': '无效的状态值'}), 400

    task.status = data['status']
    db.session.commit()

    return jsonify(task.to_dict())

@task_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@require_auth()
def delete_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=g.current_user.id).first()
    if not task:
        return jsonify({'error': '任务不存在'}), 404

    db.session.delete(task)
    db.session.commit()

    return jsonify({'message': '任务已删除'})
