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

SYSTEM_PROMPT = '你是一位精通周易與傳統占卜的老法師，輸出必須是純 JSON 格式，所有內容使用繁體中文。'


FORTUNE_TYPES = [
    {'type': 'great', 'text': '上上籤', 'weight': 5},
    {'type': 'good', 'text': '上籤', 'weight': 20},
    {'type': 'medium', 'text': '中籤', 'weight': 45},
    {'type': 'fair', 'text': '中下籤', 'weight': 20},
    {'type': 'poor', 'text': '下籤', 'weight': 10},
]


def pick_fortune_type():
    types = [t['type'] for t in FORTUNE_TYPES]
    weights = [t['weight'] for t in FORTUNE_TYPES]
    return random.choices(types, weights=weights, k=1)[0]


def get_fortune_type_text(fortune_type):
    for t in FORTUNE_TYPES:
        if t['type'] == fortune_type:
            return t['text']
    return '中籤'


def build_fortune_prompt(fortune_number, fortune_type):
    themes = ['事業前程', '姻緣桃花', '財運亨通', '學業進步', '健康平安', '家庭和睦', '旅行出行', '貴人相助']
    seasons = ['春', '夏', '秋', '冬']
    elements = ['金', '木', '水', '火', '土']

    theme = random.choice(themes)
    season = random.choice(seasons)
    element = random.choice(elements)
    today = date.today().strftime('%Y年%m月%d日')
    type_text = get_fortune_type_text(fortune_type)

    return f"""現在是{today}，{season}季，五行屬{element}。
求籤者抽到了第 {fortune_number} 籤，心中所念偏向「{theme}」。
此籤已定為「{type_text}」（{fortune_type}），請嚴格按照此籤型生成對應的籤詩與解讀。

請根據籤號、籤型、時節與五行，生成一支獨特的靈籤。每次生成的籤詩和解讀都應不同，體現當下時運。
籤詩的意境和解讀的語氣必須與「{type_text}」的吉凶程度相符。

**所有文字必須使用繁體中文。**

嚴格按照以下 JSON 格式返回，不要包含任何 markdown 格式標記：
{{
    "type": "{fortune_type}",
    "typeText": "{type_text}",
    "poem": "四句七言籤詩，每句以逗號或句號結尾，最後一句必須以句號（。）結尾",
    "interpretation": "對籤詩的詳細白話解說，包含運勢分析",
    "advice": [
        {{ "label": "事業", "value": "簡短建議" }},
        {{ "label": "財運", "value": "簡短建議" }},
        {{ "label": "感情", "value": "簡短建議" }},
        {{ "label": "健康", "value": "簡短建議" }}
    ],
    "work_fortune": "今日工作運勢，用搞笑幽默的語氣寫，像朋友吐槽一樣，例如：宜摸魚、宜假裝很忙、宜帶薪拉屎、宜瘋狂加班衝KPI、宜跟老闆畫大餅等，30字以內"
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
        '春來花自開，福至心自寬，誠心祈善願，吉慶自然來。',
        '雲開見月明，守得花開時，耐心待時機，好運必相隨。',
        '登高望遠處，前程似錦繡，勤勉不懈怠，功名可期待。',
        '水到渠成時，莫急莫躁進，靜待良機至，萬事皆順遂。',
        '柳暗花明處，轉機在眼前，堅持初心志，終見彩虹現。',
        '鳳凰展翅飛，龍躍九重天，時來運轉至，富貴自綿延。',
        '梅花香自苦，寶劍鋒從磨，歷經風雨後，彩虹映山河。',
        '明月照前程，清風送吉祥，心誠則靈驗，萬事得安康。',
        '桃李滿天下，春風化雨來，德行積善果，福祿自然開。',
        '江海納百川，山高人為峰，胸懷天下志，功成名就中。'
    ]

    interpretations = [
        '此籤示意運勢漸佳，諸事順遂。當下雖有小阻，但只要保持誠心與耐心，終能撥雲見日，迎來轉機。貴人相助，事業有成，財運亨通，感情美滿。',
        '籤示前路光明，貴人相助。凡事宜積極進取，但需謹慎行事，切勿操之過急，方能水到渠成。守正待時，必有所獲。',
        '此籤暗示需要等待時機，不宜急進。當前雖有困頓，但守得雲開見月明，耐心等待必有收穫。靜心修為，厚積薄發。',
        '籤文提醒需要堅持與努力，機會就在不遠處。只要不放棄，持之以恆，定能達成所願。天道酬勤，功不唐捐。',
        '此籤預示轉機將至，困境即將過去。保持樂觀心態，積極面對，好運即將降臨。柳暗花明，否極泰來。',
        '上上大吉之籤，諸事皆宜。當前運勢極佳，正是大展宏圖之時。把握機遇，勇往直前，必能成就一番事業。',
        '此籤示意需經磨練方能成功。雖然過程艱辛，但只要堅持不懈，終將苦盡甘來，收穫豐碩果實。',
        '籤文吉祥，心誠則靈。只要保持善良之心，誠實待人，自然會得到上天眷顧，萬事如意。',
        '此籤預示德行重要，積善之家必有餘慶。多行善事，廣結善緣，福報自然降臨，子孫昌盛。',
        '大志之籤，適合有遠大抱負之人。胸懷天下，志存高遠，只要腳踏實地，必能成就大業。'
    ]

    advice_options = [
        [
            {'label': '事業', 'value': '貴人相助，宜把握機會'},
            {'label': '財運', 'value': '正財穩定，偏財需謹慎'},
            {'label': '感情', 'value': '真誠相待，情緣可期'},
            {'label': '健康', 'value': '注意休息，保持平和'}
        ],
        [
            {'label': '事業', 'value': '穩中求進，切勿冒進'},
            {'label': '財運', 'value': '量入為出，理財有道'},
            {'label': '感情', 'value': '耐心等待，緣分自來'},
            {'label': '健康', 'value': '規律作息，身心安康'}
        ],
        [
            {'label': '事業', 'value': '積極進取，勇於創新'},
            {'label': '財運', 'value': '投資有道，財源廣進'},
            {'label': '感情', 'value': '主動出擊，把握良機'},
            {'label': '健康', 'value': '適度運動，精神飽滿'}
        ],
        [
            {'label': '事業', 'value': '厚積薄發，靜待時機'},
            {'label': '財運', 'value': '守財為上，勿貪小利'},
            {'label': '感情', 'value': '以誠待人，終成眷屬'},
            {'label': '健康', 'value': '調養身心，勿過勞累'}
        ],
        [
            {'label': '事業', 'value': '轉機將至，莫要放棄'},
            {'label': '財運', 'value': '先苦後甘，財運漸旺'},
            {'label': '感情', 'value': '破鏡重圓，重拾舊緣'},
            {'label': '健康', 'value': '病痛漸癒，注意調理'}
        ]
    ]

    random.seed(fortune_number)
    poem_index = fortune_number % len(poems)
    interp_index = fortune_number % len(interpretations)
    advice_index = fortune_number % len(advice_options)

    work_fortunes = [
        '宜摸魚，老闆不在工位的時候就是你的黃金時間',
        '宜帶薪拉屎，每次多蹲五分鐘，一年多賺一個月',
        '宜假裝很忙，打字聲音要大，表情要嚴肅',
        '宜瘋狂加班衝KPI，今天不卷明天被卷',
        '宜跟老闆畫大餅，反正畫餅不用交稅',
        '宜躺平，今日諸事不宜，唯有躺平保平安',
        '宜提前下班，反正也沒人發現你幾點走的',
        '宜開會摸魚，打開筆記本假裝記錄，實則刷手機',
        '宜寫週報吹牛，把喝咖啡寫成調研市場行情',
        '宜找同事聊八卦，美其名曰跨部門溝通協作',
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
                'error': '今日已求過籤，每日僅可求籤一次',
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
            type_text=fortune_data.get('typeText', '中籤'),
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
