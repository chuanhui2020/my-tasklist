from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from config import settings
from database import get_db
from models import User


def _get_serializer():
    return URLSafeTimedSerializer(secret_key=settings.SECRET_KEY, salt='tasklist-auth')


def generate_token(user):
    serializer = _get_serializer()
    payload = {'user_id': user.id, 'role': user.role}
    return serializer.dumps(payload)


def verify_token(token, db: Session):
    serializer = _get_serializer()
    max_age = settings.AUTH_TOKEN_MAX_AGE
    try:
        data = serializer.loads(token, max_age=max_age)
    except SignatureExpired:
        raise ValueError('token_expired')
    except BadSignature:
        raise ValueError('token_invalid')

    user = db.get(User, data.get('user_id'))
    if not user:
        raise ValueError('user_missing')
    return user


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str = Header(default=''),
) -> User:
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='未登录或凭证无效')
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail='未登录或凭证无效')
    try:
        user = verify_token(token, db)
    except ValueError as exc:
        message = '登录已过期，请重新登录' if str(exc) == 'token_expired' else '登录状态无效，请重新登录'
        raise HTTPException(status_code=401, detail=message)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='权限不足')
    return user
