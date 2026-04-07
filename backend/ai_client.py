import os
import time
import base64
import requests as http_requests
from ai_logger import log_ai_transaction


def _build_chat_completions_url(base_url: str) -> str:
    url = base_url.rstrip('/')
    if not url.endswith('/v1/chat/completions') and '/v1' not in url:
        url += '/v1/chat/completions'
    elif not url.endswith('/chat/completions'):
        url += '/chat/completions'
    return url


def chat_completion(prompt, system_prompt, temperature=0.7, max_tokens=800):
    """
    调用 OpenAI 兼容 API，返回 content 字符串或 None。
    环境变量: AI_API_KEY, AI_BASE_URL, AI_MODEL
    """
    if os.environ.get('AI_SERVICE', '').lower() == 'local':
        return None

    api_key = os.environ.get('AI_API_KEY')
    if not api_key:
        return None

    base_url = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('AI_MODEL', 'deepseek-chat')

    url = _build_chat_completions_url(base_url)

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': temperature,
        'max_tokens': max_tokens,
        'stream': False
    }

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    }

    start_time = time.time()
    status_code = 0

    try:
        response = http_requests.post(url, headers=headers, json=payload, timeout=60)
        status_code = response.status_code
        response_data = response.json() if status_code == 200 else {"error": response.text}
        duration = time.time() - start_time
        log_ai_transaction("OpenAI-Compatible", model, payload, response_data, status_code, duration)

        if status_code != 200:
            return None

        return response_data['choices'][0]['message']['content']
    except Exception as e:
        duration = time.time() - start_time
        log_ai_transaction("OpenAI-Compatible", model, payload, {"error": str(e)}, status_code, duration)
        return None


def vision_chat_completion(
    image_bytes,
    mime_type,
    prompt,
    system_prompt,
    temperature=0,
    max_tokens=1800,
):
    """
    调用 OpenAI 兼容视觉接口，返回 content 字符串或 None。
    环境变量: AI_API_KEY, AI_BASE_URL, AI_VISION_MODEL/AI_MODEL
    """
    if os.environ.get('AI_SERVICE', '').lower() == 'local':
        return None

    api_key = os.environ.get('AI_API_KEY')
    if not api_key:
        return None

    base_url = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('AI_VISION_MODEL') or os.environ.get('AI_MODEL', 'deepseek-chat')
    url = _build_chat_completions_url(base_url)

    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    image_url = f'data:{mime_type};base64,{image_b64}'

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': image_url}},
                ],
            },
        ],
        'temperature': temperature,
        'max_tokens': max_tokens,
        'stream': False,
    }

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}',
    }

    start_time = time.time()
    status_code = 0

    try:
        response = http_requests.post(url, headers=headers, json=payload, timeout=90)
        status_code = response.status_code
        response_data = response.json() if status_code == 200 else {'error': response.text}
        duration = time.time() - start_time
        log_ai_transaction('OpenAI-Compatible-Vision', model, {'prompt': prompt, 'mime_type': mime_type}, response_data, status_code, duration)

        if status_code != 200:
            return None

        return response_data['choices'][0]['message']['content']
    except Exception as e:
        duration = time.time() - start_time
        log_ai_transaction('OpenAI-Compatible-Vision', model, {'prompt': prompt, 'mime_type': mime_type}, {'error': str(e)}, status_code, duration)
        return None
