from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import json
import re
import sys
import time
import traceback
from datetime import datetime, date

import random

import requests as http_requests

from database import get_db
from auth_utils import get_current_user
from models import User, FortuneRecord

fortune_router = APIRouter(prefix='/api/fortune')

SYSTEM_PROMPT = '你是一位精通周易与传统占卜的老法师，输出必须是纯 JSON 格式，所有内容使用简体中文。'


FORTUNE_TYPES = [
    {'type': 'great', 'text': '上上签', 'weight': 5},
    {'type': 'good', 'text': '上签', 'weight': 20},
    {'type': 'medium', 'text': '中签', 'weight': 45},
    {'type': 'fair', 'text': '中下签', 'weight': 20},
    {'type': 'poor', 'text': '下签', 'weight': 10},
]


def pick_fortune_type():
    types = [t['type'] for t in FORTUNE_TYPES]
    weights = [t['weight'] for t in FORTUNE_TYPES]
    return random.choices(types, weights=weights, k=1)[0]


def get_fortune_type_text(fortune_type):
    for t in FORTUNE_TYPES:
        if t['type'] == fortune_type:
            return t['text']
    return '中签'


def get_current_season():
    month = date.today().month
    if month in (3, 4, 5):
        return '春'
    elif month in (6, 7, 8):
        return '夏'
    elif month in (9, 10, 11):
        return '秋'
    else:
        return '冬'


def build_fortune_prompt(fortune_number, fortune_type):
    themes = ['事业前程', '姻缘桃花', '财运亨通', '学业进步', '健康平安', '家庭和睦', '旅行出行', '贵人相助']
    elements = ['金', '木', '水', '火', '土']
    imagery_styles = [
        '山水意境', '花鸟虫鱼', '日月星辰', '风雨雷电',
        '江河湖海', '松竹梅兰', '龙凤麒麟', '琴棋书画',
        '云雾霞光', '剑胆琴心'
    ]

    theme = random.choice(themes)
    season = get_current_season()
    element = random.choice(elements)
    imagery = random.choice(imagery_styles)
    today = date.today().strftime('%Y年%m月%d日')
    type_text = get_fortune_type_text(fortune_type)

    return f"""现在是{today}，{season}季，五行属{element}。
求签者抽到了第 {fortune_number} 签，心中所念偏向「{theme}」。
此签已定为「{type_text}」（{fortune_type}），请严格按照此签型生成对应的签诗与解读。

请根据签号、签型、时节与五行，生成一支独特的灵签。每次生成的签诗和解读都应不同，体现当下时运。
签诗的意境和解读的语气必须与「{type_text}」的吉凶程度相符。

**签诗创作要求（非常重要）：**
- 本次签诗请以「{imagery}」为意象风格
- 签诗四句中禁止直接出现"春""夏""秋""冬"这四个季节字，用其他意象来暗示时令
- 每支签诗的用词、意象、典故都必须独特，不要套用常见模板
- 避免使用"花开""春来""春风"等高频词汇

**所有文字必须使用简体中文。**

严格按照以下 JSON 格式返回，不要包含任何 markdown 格式标记：
{{
    "type": "{fortune_type}",
    "typeText": "{type_text}",
    "poem": "四句七言签诗，每句以逗号或句号结尾，最后一句必须以句号（。）结尾",
    "interpretation": "对签诗的详细白话解说，包含运势分析",
    "advice": [
        {{ "label": "事业", "value": "简短建议" }},
        {{ "label": "财运", "value": "简短建议" }},
        {{ "label": "感情", "value": "简短建议" }},
        {{ "label": "健康", "value": "简短建议" }}
    ],
    "work_fortune": "今日工作运势，用搞笑幽默的语气写，像朋友吐槽一样，例如：宜摸鱼、宜假装很忙、宜带薪拉屎、宜疯狂加班冲KPI、宜跟老板画大饼等，30字以内"
}}"""


def generate_fortune_with_ai(fortune_number, fortune_type):
    ai_service = os.environ.get('AI_SERVICE', 'openai').lower()

    print(f"\n🎋 开始生成第 {fortune_number} 签 (预定签型: {fortune_type})")
    print(f"📋 当前配置:")
    print(f"   AI_SERVICE = {ai_service}")

    openai_key = os.environ.get('OPENAI_API_KEY')
    gemini_key = os.environ.get('GEMINI_API_KEY')
    compatible_key = os.environ.get('AI_API_KEY')

    print(f"   OPENAI_API_KEY = {'已配置' if openai_key else '未配置'}")
    print(f"   GEMINI_API_KEY = {'已配置 (' + gemini_key[:8] + '...)' if gemini_key else '未配置'}")
    print(f"   AI_API_KEY     = {'已配置 (' + compatible_key[:8] + '...)' if compatible_key else '未配置'}")

    prompt = build_fortune_prompt(fortune_number, fortune_type)
    fortune_data = None

    if ai_service in ['compatible', 'deepseek', 'siliconflow']:
        print(f"🎯 决策：使用兼容模式 (DeepSeek/SiliconFlow/Zhipu)")
        fortune_data = generate_with_compatible_api(prompt)
    elif ai_service == 'gemini' and gemini_key:
        print(f"🎯 决策：使用 Gemini API")
        fortune_data = generate_with_gemini(prompt)
    elif ai_service == 'openai' and openai_key:
        print(f"🎯 决策：使用 OpenAI API")
        fortune_data = generate_with_openai(prompt)
    elif ai_service == 'local':
        print(f"🎯 决策：强制使用本地模式")
    else:
        if compatible_key:
            print(f"🎯 决策：默认使用兼容模式")
            fortune_data = generate_with_compatible_api(prompt)
        elif openai_key:
            print(f"🎯 决策：默认使用 OpenAI API")
            fortune_data = generate_with_openai(prompt)
        elif gemini_key:
            print(f"🎯 决策：默认使用 Gemini API")
            fortune_data = generate_with_gemini(prompt)
        else:
            print(f"⚠️  未配置任何 API Key")

    if not fortune_data:
        print(f"\n🔄 自动降级到备用签文")
        fortune_data = generate_fallback_fortune(fortune_number, fortune_type)

    # Enforce the pre-determined type regardless of AI output
    fortune_data['type'] = fortune_type
    fortune_data['typeText'] = get_fortune_type_text(fortune_type)

    return fortune_data


def generate_with_openai(prompt):
    api_key = os.environ.get('OPENAI_API_KEY')
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    data = {
        'model': 'gpt-3.5-turbo',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.95,
        'max_tokens': 800
    }

    response = http_requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers=headers,
        json=data,
        timeout=30
    )

    if response.status_code == 200:
        result = response.json()
        content = result['choices'][0]['message']['content']

        try:
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            return json.loads(content)
        except Exception:
            return generate_fallback_fortune(1)
    else:
        raise Exception(f"OpenAI API error: {response.status_code}")


def generate_with_gemini(prompt):
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

    print(f"\n{'='*60}")
    print(f"🤖 [Gemini AI] 开始调用 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={GEMINI_API_KEY}'

    data = {
        'contents': [{
            'parts': [{'text': prompt}]
        }],
        'generationConfig': {
            'temperature': 0.8,
            'maxOutputTokens': 800
        }
    }

    print(f"📤 请求 URL: {url[:80]}...{GEMINI_API_KEY[-8:]}")
    print(f"📝 提示词长度: {len(prompt)} 字符")
    print(f"⚙️  配置: temperature=0.8, maxTokens=800")
    print(f"\n发送请求中...")

    try:
        response = http_requests.post(url, json=data, timeout=30)

        print(f"📥 响应状态码: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print(f"✅ 调用成功！")
            print(f"\n原始响应结构:")
            print(f"  - candidates 数量: {len(result.get('candidates', []))}")

            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                print(f"  - finishReason: {candidate.get('finishReason', 'N/A')}")

                content = candidate['content']['parts'][0]['text']
                print(f"  - 生成内容长度: {len(content)} 字符")
                print(f"\n📜 AI 生成的原始内容:")
                print(f"{'-'*60}")
                print(content[:500] + ('...' if len(content) > 500 else ''))
                print(f"{'-'*60}")

                try:
                    if '```json' in content:
                        print(f"\n🔧 检测到 JSON 代码块，正在提取...")
                        content = content.split('```json')[1].split('```')[0].strip()
                    elif '```' in content:
                        print(f"\n🔧 检测到代码块，正在提取...")
                        content = content.split('```')[1].split('```')[0].strip()

                    fortune_data = json.loads(content)

                    print(f"\n✨ 签文解析成功！")
                    print(f"  - 签型: {fortune_data.get('typeText', 'N/A')}")
                    print(f"  - 签诗: {fortune_data.get('poem', 'N/A')[:50]}...")
                    print(f"  - 解签长度: {len(fortune_data.get('interpretation', ''))} 字")
                    print(f"  - 指引数量: {len(fortune_data.get('advice', []))} 条")
                    print(f"{'='*60}\n")

                    return fortune_data

                except json.JSONDecodeError as e:
                    print(f"\n❌ JSON 解析失败: {str(e)}")
                    print(f"尝试解析的内容: {content[:200]}...")
                    print(f"⚠️  降级到备用签文")
                    print(f"{'='*60}\n")
                    return generate_fallback_fortune(1)
            else:
                print(f"\n❌ 响应中没有 candidates")
                print(f"完整响应: {result}")
                print(f"⚠️  降级到备用签文")
                print(f"{'='*60}\n")
                return generate_fallback_fortune(1)

        else:
            error_body = response.text[:500]
            print(f"\n❌ API 调用失败")
            print(f"状态码: {response.status_code}")
            print(f"错误信息: {error_body}")
            print(f"⚠️  降级到备用签文")
            print(f"{'='*60}\n")
            raise Exception(f"Gemini API error: {response.status_code}")

    except http_requests.exceptions.Timeout:
        print(f"\n⏱️  请求超时（30秒）")
        print(f"⚠️  降级到备用签文")
        print(f"{'='*60}\n")
        raise Exception("Gemini API timeout")

    except http_requests.exceptions.RequestException as e:
        print(f"\n❌ 网络请求异常: {str(e)}")
        print(f"⚠️  降级到备用签文")
        print(f"{'='*60}\n")
        raise Exception(f"Gemini API request error: {str(e)}")


def log_ai_transaction(service, model, request_data, response_data, status_code, duration):
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, f"ai_requests_{datetime.now().strftime('%Y-%m-%d')}.log")

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    log_entry = {
        "timestamp": timestamp,
        "service": service,
        "model": model,
        "status_code": status_code,
        "duration": f"{duration:.2f}s",
        "request": request_data,
        "response": response_data
    }

    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {service} ({model}) - Status: {status_code} - Time: {duration:.2f}s\n")
            f.write("-" * 80 + "\n")
            f.write(json.dumps(log_entry, ensure_ascii=False, indent=2))
            f.write("\n" + "=" * 80 + "\n\n")
    except Exception as e:
        print(f"❌ 写入日志文件失败: {e}")


def generate_with_compatible_api(prompt):
    start_time = time.time()

    api_key = os.environ.get('AI_API_KEY')
    base_url = os.environ.get('AI_BASE_URL', 'https://api.deepseek.com')
    model = os.environ.get('AI_MODEL', 'deepseek-chat')

    if not api_key:
        print("❌ 未配置 AI_API_KEY")
        return None

    print(f"\n============================================================")
    print(f"🤖 [Compatible AI] 开始调用 - {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"============================================================")
    print(f"🔗 Base URL: {base_url}")
    print(f"🧠 Model: {model}")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.95,
        "max_tokens": 800,
        "stream": False
    }

    response_data = None
    status_code = 0

    try:
        print("\n发送请求中...")
        url = base_url.rstrip('/')
        if not url.endswith('/v1/chat/completions') and '/v1' not in url:
            url += '/v1/chat/completions'
        elif not url.endswith('/chat/completions'):
            url += '/chat/completions'

        print(f"📤 请求 URL: {url}")

        response = http_requests.post(url, headers=headers, json=payload, timeout=60)

        status_code = response.status_code
        print(f"📥 响应状态码: {status_code}")

        try:
            response_data = response.json()
        except Exception:
            response_data = response.text

        duration = time.time() - start_time
        log_ai_transaction("Compatible API", model, payload, response_data, status_code, duration)

        if status_code != 200:
            print(f"\n❌ API 调用失败")
            print(f"状态码: {status_code}")
            print(f"错误信息: {response.text}")
            return None

        content = response_data['choices'][0]['message']['content']

        print(f"\n📜 AI 生成的原始内容:")
        print("-" * 60)
        print(content)
        print("-" * 60)

        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]

        fortune_data = json.loads(content.strip())

        print("\n✨ 签文解析成功！")
        return fortune_data

    except Exception as e:
        duration = time.time() - start_time
        print(f"\n❌ AI 生成异常: {str(e)}")

        log_ai_transaction("Compatible API", model, payload, {"error": str(e)}, status_code, duration)

        traceback.print_exc()
        return None


def generate_fallback_fortune(fortune_number, fortune_type=None):
    poems = [
        '福至心自宽，云散天地阔，诚心祈善愿，吉庆自然来。',
        '云开见月明，守得清风至，耐心待时机，好运必相随。',
        '登高望远处，前程似锦绣，勤勉不懈怠，功名可期待。',
        '水到渠成时，莫急莫躁进，静待良机至，万事皆顺遂。',
        '柳暗复明处，转机在眼前，坚持初心志，终见彩虹现。',
        '凤凰展翅飞，龙跃九重天，时来运转至，富贵自绵延。',
        '梅香自苦寒，宝剑锋从磨，历经风雨后，彩虹映山河。',
        '明月照前程，清风送吉祥，心诚则灵验，万事得安康。',
        '桃李满天下，德行积善果，广结良善缘，福禄自然开。',
        '江海纳百川，山高人为峰，胸怀天下志，功成名就中。'
    ]

    interpretations = [
        '此签示意运势渐佳，诸事顺遂。当下虽有小阻，但只要保持诚心与耐心，终能拨云见日，迎来转机。贵人相助，事业有成，财运亨通，感情美满。',
        '签示前路光明，贵人相助。凡事宜积极进取，但需谨慎行事，切勿操之过急，方能水到渠成。守正待时，必有所获。',
        '此签暗示需要等待时机，不宜急进。当前虽有困顿，但守得云开见月明，耐心等待必有收获。静心修为，厚积薄发。',
        '签文提醒需要坚持与努力，机会就在不远处。只要不放弃，持之以恒，定能达成所愿。天道酬勤，功不唐捐。',
        '此签预示转机将至，困境即将过去。保持乐观心态，积极面对，好运即将降临。柳暗花明，否极泰来。',
        '上上大吉之签，诸事皆宜。当前运势极佳，正是大展宏图之时。把握机遇，勇往直前，必能成就一番事业。',
        '此签示意需经磨练方能成功。虽然过程艰辛，但只要坚持不懈，终将苦尽甘来，收获丰硕果实。',
        '签文吉祥，心诚则灵。只要保持善良之心，诚实待人，自然会得到上天眷顾，万事如意。',
        '此签预示德行重要，积善之家必有余庆。多行善事，广结善缘，福报自然降临，子孙昌盛。',
        '大志之签，适合有远大抱负之人。胸怀天下，志存高远，只要脚踏实地，必能成就大业。'
    ]

    advice_options = [
        [
            {'label': '事业', 'value': '贵人相助，宜把握机会'},
            {'label': '财运', 'value': '正财稳定，偏财需谨慎'},
            {'label': '感情', 'value': '真诚相待，情缘可期'},
            {'label': '健康', 'value': '注意休息，保持平和'}
        ],
        [
            {'label': '事业', 'value': '稳中求进，切勿冒进'},
            {'label': '财运', 'value': '量入为出，理财有道'},
            {'label': '感情', 'value': '耐心等待，缘分自来'},
            {'label': '健康', 'value': '规律作息，身心安康'}
        ],
        [
            {'label': '事业', 'value': '积极进取，勇于创新'},
            {'label': '财运', 'value': '投资有道，财源广进'},
            {'label': '感情', 'value': '主动出击，把握良机'},
            {'label': '健康', 'value': '适度运动，精神饱满'}
        ],
        [
            {'label': '事业', 'value': '厚积薄发，静待时机'},
            {'label': '财运', 'value': '守财为上，勿贪小利'},
            {'label': '感情', 'value': '以诚待人，终成眷属'},
            {'label': '健康', 'value': '调养身心，勿过劳累'}
        ],
        [
            {'label': '事业', 'value': '转机将至，莫要放弃'},
            {'label': '财运', 'value': '先苦后甘，财运渐旺'},
            {'label': '感情', 'value': '破镜重圆，重拾旧缘'},
            {'label': '健康', 'value': '病痛渐愈，注意调理'}
        ]
    ]

    random.seed(fortune_number)
    poem_index = fortune_number % len(poems)
    interp_index = fortune_number % len(interpretations)
    advice_index = fortune_number % len(advice_options)

    work_fortunes = [
        '宜摸鱼，老板不在工位的时候就是你的黄金时间',
        '宜带薪拉屎，每次多蹲五分钟，一年多赚一个月',
        '宜假装很忙，打字声音要大，表情要严肃',
        '宜疯狂加班冲KPI，今天不卷明天被卷',
        '宜跟老板画大饼，反正画饼不用交税',
        '宜躺平，今日诸事不宜，唯有躺平保平安',
        '宜提前下班，反正也没人发现你几点走的',
        '宜开会摸鱼，打开笔记本假装记录，实则刷手机',
        '宜写周报吹牛，把喝咖啡写成调研市场行情',
        '宜找同事聊八卦，美其名曰跨部门沟通协作',
    ]
    work_index = fortune_number % len(work_fortunes)

    if not fortune_type:
        fortune_type = 'medium'

    return {
        'type': fortune_type,
        'typeText': get_fortune_type_text(fortune_type),
        'poem': poems[poem_index],
        'interpretation': interpretations[interp_index],
        'advice': advice_options[advice_index],
        'work_fortune': work_fortunes[work_index]
    }


@fortune_router.post('/generate')
def generate_fortune(body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sys.stdout.flush()
    sys.stderr.flush()

    start_time = time.time()
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    print("\n" + "="*80, flush=True)
    print(f"🎯 [API 请求] 收到签文生成请求 - {timestamp}", flush=True)
    print("="*80, flush=True)

    try:
        # Check daily limit
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        existing = db.query(FortuneRecord).filter(
            FortuneRecord.user_id == user.id,
            FortuneRecord.created_at >= today_start,
            FortuneRecord.created_at <= today_end
        ).first()

        if existing:
            return JSONResponse({
                'success': False,
                'error': '今日已求过签，每日仅可求签一次',
                'data': existing.to_dict()
            }, status_code=429)

        fortune_number = body.get('fortuneNumber', 1)
        print(f"\n🎲 解析签号: {fortune_number}")

        if not isinstance(fortune_number, int) or fortune_number < 1 or fortune_number > 100:
            return JSONResponse({'error': '签号必须在 1-100 之间'}, status_code=400)

        print(f"✅ 验证通过")

        fortune_type = pick_fortune_type()
        print(f"🎲 随机签型: {fortune_type} ({get_fortune_type_text(fortune_type)})")
        print(f"\n⏳ 开始生成签文...")
        print("-"*80)

        gen_start = time.time()
        fortune_data = generate_fortune_with_ai(fortune_number, fortune_type)
        gen_time = time.time() - gen_start

        print("-"*80)
        print(f"✅ 签文生成完成，耗时: {gen_time:.2f} 秒")

        print(f"\n📜 签文摘要:")
        print(f"   签型: {fortune_data.get('typeText', 'N/A')}")
        print(f"   签诗: {fortune_data.get('poem', 'N/A')[:30]}...")
        print(f"   解签长度: {len(fortune_data.get('interpretation', ''))} 字")
        print(f"   指引数量: {len(fortune_data.get('advice', []))} 条")

        # Persist to database
        record = FortuneRecord(
            user_id=user.id,
            fortune_number=fortune_number,
            fortune_type=fortune_data.get('type', 'medium'),
            type_text=fortune_data.get('typeText', '中签'),
            poem=fortune_data.get('poem', ''),
            interpretation=fortune_data.get('interpretation', ''),
            advice=json.dumps(fortune_data.get('advice', []), ensure_ascii=False),
            work_fortune=fortune_data.get('work_fortune', '')
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        response_data = {
            'success': True,
            'data': record.to_dict()
        }

        total_time = time.time() - start_time

        print(f"\n📤 [API 响应] 返回成功 200")
        print(f"   总耗时: {total_time:.2f} 秒")
        print("="*80 + "\n")

        return response_data

    except Exception as e:
        error_time = time.time() - start_time

        print(f"\n❌ [API 异常] 发生错误")
        print(f"   异常类型: {type(e).__name__}")
        print(f"   异常信息: {str(e)}")

        traceback.print_exc()

        return JSONResponse(
            {'success': False, 'error': str(e)},
            status_code=500,
        )


@fortune_router.get('/today')
def get_today_fortune(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    record = db.query(FortuneRecord).filter(
        FortuneRecord.user_id == user.id,
        FortuneRecord.created_at >= today_start,
        FortuneRecord.created_at <= today_end
    ).first()

    if record:
        return {'drawn': True, 'data': record.to_dict()}
    return {'drawn': False, 'data': None}


@fortune_router.get('/history')
def get_fortune_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    records = db.query(FortuneRecord).filter(
        FortuneRecord.user_id == user.id
    ).order_by(FortuneRecord.created_at.desc()).limit(10).all()

    return {'records': [r.to_dict() for r in records]}
