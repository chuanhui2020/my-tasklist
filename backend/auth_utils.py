from functools import wraps
from flask import request, jsonify, g, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from models import User

def _get_serializer():
    secret = current_app.config['SECRET_KEY']
    return URLSafeTimedSerializer(secret_key=secret, salt='tasklist-auth')

def generate_token(user):
    serializer = _get_serializer()
    payload = {'user_id': user.id, 'role': user.role}
    return serializer.dumps(payload)

def verify_token(token):
    serializer = _get_serializer()
    max_age = current_app.config.get('AUTH_TOKEN_MAX_AGE', 60 * 60 * 24)
    try:
        data = serializer.loads(token, max_age=max_age)
    except SignatureExpired:
        raise ValueError('token_expired')
    except BadSignature:
        raise ValueError('token_invalid')

    user = User.query.get(data.get('user_id'))
    if not user:
        raise ValueError('user_missing')
    return user

def require_auth(role=None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': '未登录或凭证无效'}), 401
            token = auth_header.split(' ', 1)[1].strip()
            if not token:
                return jsonify({'error': '未登录或凭证无效'}), 401
            try:
                user = verify_token(token)
            except ValueError as exc:
                message = '登录已过期，请重新登录' if str(exc) == 'token_expired' else '登录状态无效，请重新登录'
                return jsonify({'error': message}), 401

            if role and user.role != role:
                return jsonify({'error': '权限不足'}), 403

            g.current_user = user
            return func(*args, **kwargs)
        return wrapper
    return decorator
