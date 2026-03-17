from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from models import User
from schemas import LoginRequest, UserCreate, ChangePassword
from database import get_db
from auth_utils import generate_token, get_current_user, require_admin

auth_router = APIRouter(prefix='/api')


@auth_router.post('/auth/login')
def login(body: LoginRequest, db: Session = Depends(get_db)):
    username = (body.username or '').strip()
    password = body.password or ''

    if not username or not password:
        return JSONResponse({'error': '请输入用户名和密码'}, status_code=400)

    user = db.query(User).filter_by(username=username).first()
    if not user or not user.check_password(password):
        return JSONResponse({'error': '用户名或密码错误'}, status_code=401)

    token = generate_token(user)
    return {'token': token, 'user': user.to_dict()}


@auth_router.get('/auth/me')
def current_user_profile(user: User = Depends(get_current_user)):
    return {'user': user.to_dict()}


@auth_router.post('/auth/users', status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    username = (body.username or '').strip()
    password = body.password or ''
    role = body.role or 'user'

    if not username or not password:
        return JSONResponse({'error': '用户名和密码不能为空'}, status_code=400)

    if role not in ['admin', 'user']:
        return JSONResponse({'error': '角色无效'}, status_code=400)

    if db.query(User).filter_by(username=username).first():
        return JSONResponse({'error': '用户名已存在'}, status_code=400)

    user = User(username=username, role=role)
    user.set_password(password)
    db.add(user)
    db.commit()
    db.refresh(user)

    return JSONResponse({'user': user.to_dict()}, status_code=201)


@auth_router.post('/auth/change-password')
def change_password(
    body: ChangePassword,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    old_password = body.old_password or ''
    new_password = body.new_password or ''

    if not old_password or not new_password:
        return JSONResponse({'error': '原密码和新密码不能为空'}, status_code=400)

    if not user.check_password(old_password):
        return JSONResponse({'error': '原密码错误'}, status_code=400)

    if old_password == new_password:
        return JSONResponse({'error': '新密码不能与原密码相同'}, status_code=400)

    user.set_password(new_password)
    db.commit()

    return {'message': '密码修改成功'}
