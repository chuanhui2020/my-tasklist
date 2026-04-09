from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import Countdown, User
from schemas import CountdownCreate, CountdownUpdate
from database import get_db
from auth_utils import get_current_user

countdown_router = APIRouter(prefix='/api')


@countdown_router.get('/countdowns')
def get_countdowns(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    countdowns = db.query(Countdown).filter(
        Countdown.user_id == user.id
    ).order_by(Countdown.target_time.asc()).all()
    return [c.to_dict() for c in countdowns]


@countdown_router.post('/countdowns', status_code=201)
def create_countdown(
    body: CountdownCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not body.title:
        return JSONResponse({'error': '倒计时标题不能为空'}, status_code=400)
    if not body.target_time:
        return JSONResponse({'error': '目标时间不能为空'}, status_code=400)

    try:
        target_time = datetime.strptime(body.target_time, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return JSONResponse({'error': '时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式'}, status_code=400)

    if body.remind_level not in ('normal', 'urgent', 'crazy'):
        return JSONResponse({'error': '无效的提醒级别'}, status_code=400)

    countdown = Countdown(
        title=body.title,
        target_time=target_time,
        remind_before=body.remind_before,
        remind_level=body.remind_level,
        user_id=user.id,
    )
    db.add(countdown)
    db.commit()
    db.refresh(countdown)
    return JSONResponse(countdown.to_dict(), status_code=201)


@countdown_router.put('/countdowns/{countdown_id}')
def update_countdown(
    countdown_id: int,
    body: CountdownUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    countdown = db.query(Countdown).filter_by(id=countdown_id, user_id=user.id).first()
    if not countdown:
        return JSONResponse({'error': '倒计时不存在'}, status_code=404)

    if not body.title:
        return JSONResponse({'error': '倒计时标题不能为空'}, status_code=400)

    try:
        target_time = datetime.strptime(body.target_time, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return JSONResponse({'error': '时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式'}, status_code=400)

    if body.remind_level not in ('normal', 'urgent', 'crazy'):
        return JSONResponse({'error': '无效的提醒级别'}, status_code=400)

    countdown.title = body.title
    countdown.target_time = target_time
    countdown.remind_before = body.remind_before
    countdown.remind_level = body.remind_level
    db.commit()
    db.refresh(countdown)
    return countdown.to_dict()


@countdown_router.delete('/countdowns/{countdown_id}')
def delete_countdown(
    countdown_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    countdown = db.query(Countdown).filter_by(id=countdown_id, user_id=user.id).first()
    if not countdown:
        return JSONResponse({'error': '倒计时不存在'}, status_code=404)

    db.delete(countdown)
    db.commit()
    return {'message': '倒计时已删除'}


@countdown_router.get('/countdowns/upcoming')
def get_upcoming_countdowns(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now()
    countdowns = db.query(Countdown).filter(
        Countdown.user_id == user.id,
        Countdown.status == 'active',
    ).all()

    upcoming = []
    for c in countdowns:
        remind_start = c.target_time - timedelta(minutes=c.remind_before)
        if now >= remind_start:
            upcoming.append(c.to_dict())

    return upcoming


@countdown_router.patch('/countdowns/{countdown_id}/dismiss')
def dismiss_countdown(
    countdown_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    countdown = db.query(Countdown).filter_by(id=countdown_id, user_id=user.id).first()
    if not countdown:
        return JSONResponse({'error': '倒计时不存在'}, status_code=404)

    countdown.status = 'dismissed'
    db.commit()
    return {'message': '已关闭提醒'}
