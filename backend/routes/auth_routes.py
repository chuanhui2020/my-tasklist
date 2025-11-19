from flask import Blueprint, request, jsonify, g
from models import db, User
from auth_utils import generate_token, require_auth

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': '请输入用户名和密码'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    token = generate_token(user)
    return jsonify({'token': token, 'user': user.to_dict()})

@auth_bp.route('/auth/me', methods=['GET'])
@require_auth()
def current_user_profile():
    user = getattr(g, 'current_user', None)
    if not user:
        return jsonify({'error': '未登录或凭证无效'}), 401
    return jsonify({'user': user.to_dict()})

@auth_bp.route('/auth/users', methods=['POST'])
@require_auth(role='admin')
def create_user():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = data.get('role') or 'user'

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    if role not in ['admin', 'user']:
        return jsonify({'error': '角色无效'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': '用户名已存在'}), 400

    user = User(username=username, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'user': user.to_dict()}), 201

@auth_bp.route('/auth/change-password', methods=['POST'])
@require_auth()
def change_password():
    user = getattr(g, 'current_user', None)
    if not user:
        return jsonify({'error': '未登录或凭证无效'}), 401
    
    data = request.json or {}
    old_password = data.get('old_password') or ''
    new_password = data.get('new_password') or ''
    
    if not old_password or not new_password:
        return jsonify({'error': '原密码和新密码不能为空'}), 400
    
    if not user.check_password(old_password):
        return jsonify({'error': '原密码错误'}), 400
    
    if old_password == new_password:
        return jsonify({'error': '新密码不能与原密码相同'}), 400
    
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': '密码修改成功'}), 200
