from flask import Blueprint, jsonify, request
import json
import os
import re
import time

import requests

bmi_bp = Blueprint('bmi', __name__)

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


def generate_with_openai(prompt):
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
        'max_tokens': MAX_TOKENS
    }

    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers=headers,
        json=data,
        timeout=30
    )

    if response.status_code != 200:
        return None

    result = response.json()
    return result['choices'][0]['message']['content']


def generate_with_gemini(prompt):
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
            'maxOutputTokens': MAX_TOKENS
        }
    }

    response = requests.post(url, json=data, timeout=30)
    if response.status_code != 200:
        return None

    result = response.json()
    candidates = result.get('candidates', [])
    if not candidates:
        return None

    return candidates[0]['content']['parts'][0]['text']


def generate_with_compatible_api(prompt):
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
        'max_tokens': MAX_TOKENS,
        'stream': False
    }

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }

    response = requests.post(url, headers=headers, json=payload, timeout=60)
    if response.status_code != 200:
        return None

    response_data = response.json()
    return response_data['choices'][0]['message']['content']


def generate_bmi_advice_with_ai(prompt):
    ai_service = os.environ.get('AI_SERVICE', 'openai').lower()
    openai_key = os.environ.get('OPENAI_API_KEY')
    gemini_key = os.environ.get('GEMINI_API_KEY')
    compatible_key = os.environ.get('AI_API_KEY')

    content = None
    if ai_service in ['compatible', 'deepseek', 'siliconflow']:
        content = generate_with_compatible_api(prompt)
    elif ai_service == 'gemini' and gemini_key:
        content = generate_with_gemini(prompt)
    elif ai_service == 'openai' and openai_key:
        content = generate_with_openai(prompt)
    elif ai_service == 'local':
        content = None
    else:
        if compatible_key:
            content = generate_with_compatible_api(prompt)
        elif openai_key:
            content = generate_with_openai(prompt)
        elif gemini_key:
            content = generate_with_gemini(prompt)

    return content


@bmi_bp.route('/advice', methods=['POST'])
def generate_bmi_advice():
    start_time = time.time()
    data = request.get_json() or {}

    try:
        age = int(data.get('age', 0))
        height = float(data.get('height', 0))
        weight = float(data.get('weight', 0))
        bmi = float(data.get('bmi', 0))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': '参数格式错误'}), 400

    if age <= 0 or height <= 0 or weight <= 0:
        return jsonify({'success': False, 'error': '参数缺失'}), 400

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

    return jsonify({
        'success': True,
        'data': {
            'advice': advice
        }
    })
