from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import json
import os
import re
import time

import requests as http_requests

from datetime import date, timedelta
from database import get_db
from auth_utils import get_current_user
from models import User, BmiProfile, WeightRecord

bmi_router = APIRouter(prefix='/api/bmi')

MAX_ITEM_CHARS = 20
MAX_TOKENS = 120


def build_bmi_prompt(age, height, weight, bmi):
    return (
        "你是一位健康管理助手。根据以下数据给出3条最重要的健康建议，聚焦饮食、运动、作息。\n"
        f"年龄: {age} 岁，身高: {height} cm，体重: {weight} kg，BMI: {bmi}。\n"
        "要求：\n"
        "1) 只返回严格 JSON：{\"advice\":[\"...\",\"...\",\"...\"]}\n"
        "2) 每条建议不超过20个中文字符，总字符数不超过80\n"
        "3) 不要输出任何多余文本或 Markdown"
    )


def fallback_advice(bmi):
    if bmi < 18.5:
        return ['提高优质蛋白摄入', '每周 2-3 次力量训练', '规律作息保持恢复']
    if bmi <= 23.9:
        return ['保持均衡饮食', '每周 150 分钟运动', '定期记录体重变化']
    if bmi <= 27.9:
        return ['减少高糖高油食物', '增加日常步行', '每周 2-3 次有氧']
    return ['控制总热量摄入', '循序渐进提高活动量', '必要时咨询专业意见']


def normalize_advice(advice, fallback):
    items = []
    if isinstance(advice, list):
        items = [str(item).strip() for item in advice if str(item).strip()]
    elif isinstance(advice, str):
        parts = re.split(r'[\r\n]+', advice)
        if len(parts) == 1:
            parts = re.split(r'[。；;]+', advice)
        items = [part.strip(' -•0123456789.、)[]{}"\'`') for part in parts if part.strip()]

    if not items:
        items = list(fallback)

    cleaned = []
    for item in items:
        trimmed = re.sub(r'^\s*advice\s*[:=]\s*', '', item, flags=re.I).strip()
        trimmed = trimmed.strip('[]{}"\'`')
        if not trimmed:
            continue
        cleaned.append(trimmed[:MAX_ITEM_CHARS])
        if len(cleaned) == 3:
            break

    if len(cleaned) < 3:
        for item in fallback:
            if len(cleaned) == 3:
                break
            if item not in cleaned:
                cleaned.append(item[:MAX_ITEM_CHARS])

    return cleaned[:3]


def extract_items_from_text(text):
    if not text:
        return []
    candidate = text.strip()
    match = re.search(r'"?advice"?\s*[:=]\s*\[(.*)', candidate, re.S)
    if match:
        candidate = match.group(1)

    parts = re.split(r'[\r\n,，。；;]+', candidate)
    items = []
    for part in parts:
        cleaned = part.strip().strip('[]{}"\'`')
        cleaned = re.sub(r'^\s*advice\s*[:=]\s*', '', cleaned, flags=re.I).strip()
        if cleaned:
            items.append(cleaned)
    return items


def extract_advice(content, fallback):
    if not content:
        return None
    cleaned = content.strip()
    if '```json' in cleaned:
        cleaned = cleaned.split('```json')[1].split('```')[0].strip()
    elif '```' in cleaned:
        cleaned = cleaned.split('```')[1].split('```')[0].strip()

    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            advice = payload.get('advice')
        else:
            advice = payload
        return normalize_advice(advice, fallback)
    except json.JSONDecodeError:
        extracted = extract_items_from_text(cleaned)
        if extracted:
            return normalize_advice(extracted, fallback)
        return normalize_advice(cleaned, fallback)


def generate_with_openai(prompt, max_tokens=MAX_TOKENS):
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        return None

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    data = {
        'model': 'gpt-3.5-turbo',
        'messages': [
            {'role': 'system', 'content': '你是一位简洁的健康管理助手。'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.5,
        'max_tokens': max_tokens
    }

    response = http_requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers=headers,
        json=data,
        timeout=30
    )

    if response.status_code != 200:
        return None

    result = response.json()
    try:
        return result['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        print(f"⚠️ OpenAI API 返回结构异常: {json.dumps(result, ensure_ascii=False, default=str)[:500]}")
        return None


def generate_with_gemini(prompt, max_tokens=MAX_TOKENS):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return None

    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'gemini-pro:generateContent?key={api_key}'
    )
    data = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.5,
            'maxOutputTokens': max_tokens
        }
    }

    response = http_requests.post(url, json=data, timeout=30)
    if response.status_code != 200:
        return None

    result = response.json()
    candidates = result.get('candidates', [])
    if not candidates:
        return None

    return candidates[0]['content']['parts'][0]['text']


def generate_with_compatible_api(prompt, max_tokens=MAX_TOKENS):
    api_key = os.environ.get('AI_API_KEY')
    if not api_key:
        return None

    base_url = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('AI_MODEL', 'deepseek-chat')

    url = base_url.rstrip('/')
    if not url.endswith('/v1/chat/completions') and '/v1' not in url:
        url += '/v1/chat/completions'
    elif not url.endswith('/chat/completions'):
        url += '/chat/completions'

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': '你是一位简洁的健康管理助手，输出必须是纯 JSON。'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.5,
        'max_tokens': max_tokens,
        'stream': False
    }

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }

    response = http_requests.post(url, headers=headers, json=payload, timeout=60)
    if response.status_code != 200:
        return None

    response_data = response.json()
    try:
        return response_data['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        print(f"⚠️ AI API 返回结构异常: {json.dumps(response_data, ensure_ascii=False, default=str)[:500]}")
        return None


def generate_bmi_advice_with_ai(prompt, max_tokens=MAX_TOKENS):
    ai_service = os.environ.get('AI_SERVICE', 'openai').lower()
    openai_key = os.environ.get('OPENAI_API_KEY')
    gemini_key = os.environ.get('GEMINI_API_KEY')
    compatible_key = os.environ.get('AI_API_KEY')

    content = None
    if ai_service in ['compatible', 'deepseek', 'siliconflow']:
        content = generate_with_compatible_api(prompt, max_tokens)
    elif ai_service == 'gemini' and gemini_key:
        content = generate_with_gemini(prompt, max_tokens)
    elif ai_service == 'openai' and openai_key:
        content = generate_with_openai(prompt, max_tokens)
    elif ai_service == 'local':
        content = None
    else:
        if compatible_key:
            content = generate_with_compatible_api(prompt, max_tokens)
        elif openai_key:
            content = generate_with_openai(prompt, max_tokens)
        elif gemini_key:
            content = generate_with_gemini(prompt, max_tokens)

    return content


@bmi_router.post('/advice')
def generate_bmi_advice(body: dict):
    start_time = time.time()

    try:
        age = int(body.get('age', 0))
        height = float(body.get('height', 0))
        weight = float(body.get('weight', 0))
        bmi = float(body.get('bmi', 0))
    except (TypeError, ValueError):
        return JSONResponse({'success': False, 'error': '参数格式错误'}, status_code=400)

    if age <= 0 or height <= 0 or weight <= 0:
        return JSONResponse({'success': False, 'error': '参数缺失'}, status_code=400)

    height_m = height / 100
    calculated_bmi = round(weight / (height_m * height_m), 1) if height_m else 0
    bmi_value = bmi if bmi > 0 else calculated_bmi
    bmi_value = round(bmi_value, 1)

    fallback = fallback_advice(bmi_value)
    prompt = build_bmi_prompt(age, height, weight, bmi_value)
    content = generate_bmi_advice_with_ai(prompt)

    advice = extract_advice(content, fallback) if content else fallback
    advice = normalize_advice(advice, fallback)

    duration = time.time() - start_time
    print(f"📌 BMI 建议生成完成，耗时 {duration:.2f}s")

    return {
        'success': True,
        'data': {
            'advice': advice
        }
    }


@bmi_router.get('/profile')
def get_bmi_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(BmiProfile).filter_by(user_id=user.id).first()
    if not profile:
        return {'success': True, 'data': None}
    return {'success': True, 'data': profile.to_dict()}


@bmi_router.put('/profile')
def save_bmi_profile(body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    gender = body.get('gender', 'male')
    age = int(body.get('age', 28))
    height = int(body.get('height', 170))
    weight = float(body.get('weight', 65))

    profile = db.query(BmiProfile).filter_by(user_id=user.id).first()
    if profile:
        profile.gender = gender
        profile.age = age
        profile.height = height
        profile.weight = weight
    else:
        profile = BmiProfile(user_id=user.id, gender=gender, age=age, height=height, weight=weight)
        db.add(profile)
    db.commit()
    return {'success': True, 'data': profile.to_dict()}


def build_weight_analysis_prompt(records, profile):
    data_lines = '\n'.join(
        f"  {r.date.strftime('%Y-%m-%d')}: {r.weight} kg"
        for r in records
    )
    height_m = profile.height / 100 if profile else 1.70
    latest_weight = records[-1].weight
    earliest_weight = records[0].weight
    weight_change = latest_weight - earliest_weight
    current_bmi = round(latest_weight / (height_m * height_m), 1)

    return (
        "你是一位专业的健康管理顾问。请根据以下用户的体重记录数据进行分析。\n\n"
        f"用户信息：性别 {'男' if not profile or profile.gender == 'male' else '女'}，"
        f"年龄 {profile.age if profile else 28} 岁，"
        f"身高 {profile.height if profile else 170} cm\n\n"
        f"体重记录（共 {len(records)} 条，时间跨度 {(records[-1].date - records[0].date).days} 天）：\n"
        f"{data_lines}\n\n"
        f"当前BMI: {current_bmi}\n"
        f"期间体重变化: {weight_change:+.1f} kg\n\n"
        "请从以下几个方面进行分析：\n"
        "1. 体重变化趋势总结（上升/下降/波动/平稳）\n"
        "2. 变化速率是否健康合理\n"
        "3. 基于BMI的健康评估\n"
        "4. 针对性的饮食和运动建议\n"
        "5. 需要注意的健康风险（如有）\n\n"
        "要求：\n"
        "- 使用中文回答\n"
        "- 语气专业但亲切\n"
        "- 总字数控制在300字以内\n"
        "- 使用简洁的段落格式"
    )


@bmi_router.post('/weight')
def record_weight(body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        weight = float(body.get('weight', 0))
    except (TypeError, ValueError):
        return JSONResponse({'error': '体重数据无效'}, status_code=400)

    if weight < 30 or weight > 300:
        return JSONResponse({'error': '体重数据无效，请输入30-300kg之间的值'}, status_code=400)

    # 支持补录：可选 date 参数，默认今天
    record_date = date.today()
    date_str = body.get('date')
    if date_str:
        try:
            from datetime import datetime as dt
            record_date = dt.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return JSONResponse({'error': '日期格式无效'}, status_code=400)
        # 补录限制：最近90天内，不能超过今天
        earliest = date.today() - timedelta(days=90)
        if record_date > date.today():
            return JSONResponse({'error': '不能记录未来日期的体重'}, status_code=400)
        if record_date < earliest:
            return JSONResponse({'error': '只能补录最近三个月的体重数据'}, status_code=400)

    existing = db.query(WeightRecord).filter_by(user_id=user.id, date=record_date).first()
    if existing:
        return JSONResponse({'error': f'{record_date.strftime("%Y-%m-%d")} 的体重已记录，无法修改'}, status_code=409)

    record = WeightRecord(user_id=user.id, weight=weight, date=record_date)
    db.add(record)

    # 只有记录今天的体重时才同步更新 profile
    if record_date == date.today():
        profile = db.query(BmiProfile).filter_by(user_id=user.id).first()
        if profile:
            profile.weight = weight

    db.commit()
    return {'success': True, 'data': record.to_dict()}


@bmi_router.get('/weight/today')
def get_today_weight(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    record = db.query(WeightRecord).filter_by(user_id=user.id, date=today).first()
    if record:
        return {'recorded': True, 'data': record.to_dict()}
    return {'recorded': False, 'data': None}


@bmi_router.get('/weight/history')
def get_weight_history(days: int = 90, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    days = min(max(days, 7), 365)
    start_date = date.today() - timedelta(days=days)
    records = (
        db.query(WeightRecord)
        .filter(WeightRecord.user_id == user.id, WeightRecord.date >= start_date)
        .order_by(WeightRecord.date.asc())
        .all()
    )
    return {'success': True, 'data': [r.to_dict() for r in records]}


@bmi_router.post('/weight/analysis')
def analyze_weight(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    start_date = date.today() - timedelta(days=90)
    records = (
        db.query(WeightRecord)
        .filter(WeightRecord.user_id == user.id, WeightRecord.date >= start_date)
        .order_by(WeightRecord.date.asc())
        .all()
    )

    if len(records) < 3:
        return JSONResponse({'error': '体重记录不足，至少需要3条记录才能进行分析'}, status_code=400)

    profile = db.query(BmiProfile).filter_by(user_id=user.id).first()
    prompt = build_weight_analysis_prompt(records, profile)

    start_time = time.time()
    content = generate_bmi_advice_with_ai(prompt, max_tokens=800)
    duration = time.time() - start_time
    print(f"📌 体重分析生成完成，耗时 {duration:.2f}s")

    if not content:
        return JSONResponse({'error': 'AI 分析服务暂不可用，请稍后再试'}, status_code=503)

    return {'success': True, 'data': {'analysis': content}}
