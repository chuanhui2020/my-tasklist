from datetime import date, timedelta, datetime
import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ai_client import vision_chat_completion
from auth_utils import get_current_user, require_admin
from database import get_db
from models import User, WeeklyMenu

menu_router = APIRouter(prefix='/api/menu')

MENU_SYSTEM_PROMPT = (
    '你是一个菜单信息提取助手。'
    '你的任务是从公司每周菜单图片中提取结构化数据。'
    '只返回严格 JSON，不要 Markdown，不要解释，不要代码块。'
)

MENU_USER_PROMPT = """请识别这张公司每周菜单图片，并返回严格 JSON。

要求：
1. 顶层只能有："午餐"、"水果"、"晚餐"
2. 日期键只能是："周一"、"周二"、"周三"、"周四"、"周五"、"周六"、"周日"
3. 周一到周日可能缺失若干天，这是正常情况，缺失的日期不要输出
4. 午餐和晚餐下，每一天只能有：
   - "主荤"
   - "半荤"
   - "素菜"
   - "杂粮"
   - "主食"
   - "汤粥"
5. 上述分类的值都必须是字符串数组
6. 水果下每一天的值也必须是字符串数组
7. 如果某个分类没有内容，返回空数组 []
8. 保留菜名中的备注，例如“（含猪）”“（辣）”
9. 不要补充图片里没有的信息
10. 最终输出必须能被 Python 的 json.loads 直接解析

输出示例：
{
  "午餐": {
    "周二": {
      "主荤": [],
      "半荤": [],
      "素菜": [],
      "杂粮": [],
      "主食": [],
      "汤粥": []
    }
  },
  "水果": {
    "周二": []
  },
  "晚餐": {
    "周二": {
      "主荤": [],
      "半荤": [],
      "素菜": [],
      "杂粮": [],
      "主食": [],
      "汤粥": []
    }
  }
}
"""

WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
MENU_CATEGORIES = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']
ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024


def get_week_start(target: date | None = None) -> date:
    target = target or date.today()
    return target - timedelta(days=target.weekday())


def parse_week_start(value: str | None) -> date:
    if not value:
        return get_week_start()
    try:
        parsed = datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise ValueError('week_start 格式必须为 YYYY-MM-DD')
    return get_week_start(parsed)


def strip_code_fences(content: str) -> str:
    cleaned = content.strip()
    if '```json' in cleaned:
        cleaned = cleaned.split('```json', 1)[1].split('```', 1)[0].strip()
    elif '```' in cleaned:
        cleaned = cleaned.split('```', 1)[1].split('```', 1)[0].strip()
    return cleaned


def normalize_day_menu(payload):
    if not isinstance(payload, dict):
        payload = {}
    normalized = {}
    for category in MENU_CATEGORIES:
        raw_items = payload.get(category, [])
        if not isinstance(raw_items, list):
            raw_items = [raw_items] if raw_items else []
        normalized[category] = [str(item).strip() for item in raw_items if str(item).strip()]
    return normalized


def normalize_menu_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError('菜单 JSON 必须是对象')

    normalized = {'午餐': {}, '水果': {}, '晚餐': {}}

    for meal_key in ['午餐', '晚餐']:
        meal_payload = payload.get(meal_key, {})
        if meal_payload and not isinstance(meal_payload, dict):
            raise ValueError(f'{meal_key} 必须是对象')
        for weekday, day_menu in (meal_payload or {}).items():
            if weekday not in WEEKDAYS:
                continue
            normalized[meal_key][weekday] = normalize_day_menu(day_menu)

    fruit_payload = payload.get('水果', {})
    if fruit_payload and not isinstance(fruit_payload, dict):
        raise ValueError('水果 必须是对象')
    for weekday, items in (fruit_payload or {}).items():
        if weekday not in WEEKDAYS:
            continue
        if not isinstance(items, list):
            items = [items] if items else []
        normalized['水果'][weekday] = [str(item).strip() for item in items if str(item).strip()]

    return normalized


def parse_menu_json(content: str):
    cleaned = strip_code_fences(content)
    payload = json.loads(cleaned)
    return normalize_menu_payload(payload)


def get_today_menu_entry(menu_data, target: date | None = None):
    target = target or date.today()
    weekday_key = WEEKDAYS[target.weekday()]
    return {
        'weekday': weekday_key,
        'lunch': menu_data.get('午餐', {}).get(weekday_key),
        'fruit': menu_data.get('水果', {}).get(weekday_key, []),
        'dinner': menu_data.get('晚餐', {}).get(weekday_key),
    }


@menu_router.get('/today')
def get_today_menu(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    week_start = get_week_start()
    menu = db.query(WeeklyMenu).filter_by(week_start=week_start).first()

    if not menu:
        return {
            'week_start': week_start.strftime('%Y-%m-%d'),
            'weekday': WEEKDAYS[date.today().weekday()],
            'lunch': None,
            'fruit': [],
            'dinner': None,
            'available': False,
        }

    menu_data = menu.to_dict()['menu']
    today_entry = get_today_menu_entry(menu_data)
    return {
        'week_start': week_start.strftime('%Y-%m-%d'),
        'uploaded_at': menu.updated_at.strftime('%Y-%m-%d %H:%M:%S') if menu.updated_at else None,
        'available': bool(today_entry['lunch'] or today_entry['fruit'] or today_entry['dinner']),
        **today_entry,
    }


@menu_router.post('/upload')
async def upload_menu_image(
    image: UploadFile = File(...),
    week_start: str = Form(default=''),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if image.content_type not in ALLOWED_TYPES:
        return JSONResponse({'error': '仅支持 jpg/png/webp 图片'}, status_code=400)

    try:
        normalized_week_start = parse_week_start(week_start or None)
    except ValueError as exc:
        return JSONResponse({'error': str(exc)}, status_code=400)

    image_bytes = await image.read()
    if not image_bytes:
        return JSONResponse({'error': '图片不能为空'}, status_code=400)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        return JSONResponse({'error': '图片大小不能超过 10MB'}, status_code=400)

    content = vision_chat_completion(
        image_bytes=image_bytes,
        mime_type=image.content_type,
        prompt=MENU_USER_PROMPT,
        system_prompt=MENU_SYSTEM_PROMPT,
        temperature=0,
        max_tokens=2200,
    )

    if not content:
        return JSONResponse({'error': '菜单识别失败，请检查模型配置或稍后重试'}, status_code=503)

    try:
        menu_payload = parse_menu_json(content)
    except (json.JSONDecodeError, ValueError):
        return JSONResponse({'error': '菜单识别结果格式无效，请重新上传更清晰的图片'}, status_code=422)

    record = db.query(WeeklyMenu).filter_by(week_start=normalized_week_start).first()
    if record:
        record.menu_json = json.dumps(menu_payload, ensure_ascii=False)
        record.uploaded_by = admin.id
    else:
        record = WeeklyMenu(
            week_start=normalized_week_start,
            menu_json=json.dumps(menu_payload, ensure_ascii=False),
            uploaded_by=admin.id,
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    return {
        'success': True,
        'data': {
            **record.to_dict(),
            'today': get_today_menu_entry(menu_payload),
        },
    }
