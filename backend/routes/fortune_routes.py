from flask import Blueprint, jsonify, request
from functools import wraps
import os
import json
# from logger_config import fortune_logger as logger  # 临时注释，使用 print 代替

fortune_bp = Blueprint('fortune', __name__)

# 这里可以配置多种 AI 服务
AI_SERVICE = os.environ.get('AI_SERVICE', 'openai')  # 可选: openai, gemini, local
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

def generate_fortune_with_ai(fortune_number):
    """使用 AI 生成签文"""
    
    print(f"\n🎋 开始生成第 {fortune_number} 签")
    print(f"📋 当前配置:")
    print(f"   AI_SERVICE = {AI_SERVICE}")
    print(f"   OPENAI_API_KEY = {'已配置' if OPENAI_API_KEY else '未配置'}")
    print(f"   GEMINI_API_KEY = {'已配置 (' + GEMINI_API_KEY[-8:] + ')' if GEMINI_API_KEY else '未配置'}")
    
    prompt = f"""你是一位精通中国传统文化的占卜大师。请为第 {fortune_number} 签生成一支完整的灵签。

要求：
1. 使用繁体中文
2. 签诗：四句七言诗，押韵，意境优美
3. 签型：从"上上籤"、"上籤"、"中籤"、"中下籤"、"下籤"中选择一个
4. 解签：100-150字，解释签诗含义和运势
5. 指引：分别给出事业、财运、感情、健康四个方面的建议，每条10-15字

请以JSON格式返回，格式如下：
{{
  "type": "great/good/medium/fair/poor",
  "typeText": "上上籤/上籤/中籤/中下籤/下籤",
  "poem": "签诗四句，用，和。分隔",
  "interpretation": "解签内容",
  "advice": [
    {{"label": "事業", "value": "建议内容"}},
    {{"label": "財運", "value": "建议内容"}},
    {{"label": "感情", "value": "建议内容"}},
    {{"label": "健康", "value": "建议内容"}}
  ]
}}"""

    try:
        if AI_SERVICE == 'openai' and OPENAI_API_KEY:
            print(f"🎯 决策：使用 OpenAI API")
            return generate_with_openai(prompt)
        elif AI_SERVICE == 'gemini' and GEMINI_API_KEY:
            print(f"🎯 决策：使用 Gemini API")
            return generate_with_gemini(prompt)
        else:
            print(f"🎯 决策：使用备用签文（未配置 AI 或配置不完整）")
            return generate_fallback_fortune(fortune_number)
    except Exception as e:
        print(f"❌ AI 生成异常: {e}")
        print(f"🔄 自动降级到备用签文")
        return generate_fallback_fortune(fortune_number)

def generate_with_openai(prompt):
    """使用 OpenAI API 生成"""
    import requests
    
    headers = {
        'Authorization': f'Bearer {OPENAI_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gpt-3.5-turbo',
        'messages': [
            {'role': 'system', 'content': '你是一位精通中国传统占卜文化的大师，擅长解读灵签。'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.8,
        'max_tokens': 800
    }
    
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers=headers,
        json=data,
        timeout=30
    )
    
    if response.status_code == 200:
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # 尝试解析 JSON
        try:
            # 提取 JSON 部分
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            return json.loads(content)
        except:
            # 如果解析失败，返回备用数据
            return generate_fallback_fortune(1)
    else:
        raise Exception(f"OpenAI API error: {response.status_code}")

def generate_with_gemini(prompt):
    """使用 Google Gemini API 生成"""
    import requests
    from datetime import datetime
    
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
        response = requests.post(url, json=data, timeout=30)
        
        print(f"📥 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            # 记录完整响应（用于调试）
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
                
                # 尝试解析 JSON
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
            
    except requests.exceptions.Timeout:
        print(f"\n⏱️  请求超时（30秒）")
        print(f"⚠️  降级到备用签文")
        print(f"{'='*60}\n")
        raise Exception("Gemini API timeout")
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ 网络请求异常: {str(e)}")
        print(f"⚠️  降级到备用签文")
        print(f"{'='*60}\n")
        raise Exception(f"Gemini API request error: {str(e)}")

def generate_fallback_fortune(fortune_number):
    """备用签文生成（当 AI 不可用时）"""
    import random
    
    types = [
        {'type': 'great', 'text': '上上籤'},
        {'type': 'good', 'text': '上籤'},
        {'type': 'medium', 'text': '中籤'},
        {'type': 'fair', 'text': '中下籤'},
        {'type': 'poor', 'text': '下籤'}
    ]
    
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
    
    # 根据签号选择（使用签号作为种子保证同一签号结果一致）
    random.seed(fortune_number)
    selected_type = types[fortune_number % len(types)]
    poem_index = fortune_number % len(poems)
    interp_index = fortune_number % len(interpretations)
    advice_index = fortune_number % len(advice_options)
    
    return {
        'type': selected_type['type'],
        'typeText': selected_type['text'],
        'poem': poems[poem_index],
        'interpretation': interpretations[interp_index],
        'advice': advice_options[advice_index]
    }

@fortune_bp.route('/generate', methods=['POST'])
def generate_fortune():
    """生成签文 API"""
    from datetime import datetime
    import time
    
    start_time = time.time()
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    print("\n" + "="*80)
    print(f"🎯 [API 请求] 收到签文生成请求 - {timestamp}")
    print("="*80)
    
    # 打印请求信息
    print(f"📍 请求路径: {request.path}")
    print(f"🌐 请求方法: {request.method}")
    print(f"🔗 客户端 IP: {request.remote_addr}")
    print(f"📋 Content-Type: {request.content_type}")
    
    # 打印请求头（部分）
    print(f"\n📨 请求头:")
    for key in ['User-Agent', 'Authorization', 'Origin', 'Referer']:
        if key in request.headers:
            value = request.headers[key]
            # 隐藏 token 的部分内容
            if key == 'Authorization' and len(value) > 20:
                value = value[:20] + '...' + value[-8:]
            print(f"   {key}: {value}")
    
    try:
        # 获取请求数据
        data = request.get_json()
        print(f"\n📦 请求体数据:")
        print(f"   {data}")
        
        fortune_number = data.get('fortuneNumber', 1)
        print(f"\n🎲 解析签号: {fortune_number}")
        
        # 验证签号范围
        if not isinstance(fortune_number, int) or fortune_number < 1 or fortune_number > 100:
            error_msg = '签号必须在 1-100 之间'
            print(f"\n❌ 验证失败: {error_msg}")
            print("="*80 + "\n")
            
            response_data = {'error': error_msg}
            print(f"📤 [API 响应] 返回错误 400")
            print(f"   响应数据: {response_data}")
            print("="*80 + "\n")
            
            return jsonify(response_data), 400
        
        print(f"✅ 验证通过")
        print(f"\n⏳ 开始生成签文...")
        print("-"*80)
        
        # 生成签文
        gen_start = time.time()
        fortune_data = generate_fortune_with_ai(fortune_number)
        gen_time = time.time() - gen_start
        
        print("-"*80)
        print(f"✅ 签文生成完成，耗时: {gen_time:.2f} 秒")
        
        # 打印签文摘要
        print(f"\n📜 签文摘要:")
        print(f"   签型: {fortune_data.get('typeText', 'N/A')}")
        print(f"   签诗: {fortune_data.get('poem', 'N/A')[:30]}...")
        print(f"   解签长度: {len(fortune_data.get('interpretation', ''))} 字")
        print(f"   指引数量: {len(fortune_data.get('advice', []))} 条")
        
        # 准备响应
        response_data = {
            'success': True,
            'data': fortune_data
        }
        
        total_time = time.time() - start_time
        
        print(f"\n📤 [API 响应] 返回成功 200")
        print(f"   总耗时: {total_time:.2f} 秒")
        print(f"   响应数据大小: ~{len(str(response_data))} 字符")
        print("="*80 + "\n")
        
        return jsonify(response_data)
        
    except Exception as e:
        error_time = time.time() - start_time
        
        print(f"\n❌ [API 异常] 发生错误")
        print(f"   异常类型: {type(e).__name__}")
        print(f"   异常信息: {str(e)}")
        print(f"   发生时间: {error_time:.2f} 秒后")
        
        print(f"\n📚 完整堆栈跟踪:")
        import traceback
        traceback.print_exc()
        
        response_data = {
            'success': False,
            'error': str(e)
        }
        
        print(f"\n📤 [API 响应] 返回错误 500")
        print(f"   响应数据: {response_data}")
        print("="*80 + "\n")
        
        return jsonify(response_data), 500
