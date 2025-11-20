from flask import Blueprint, jsonify, request
from functools import wraps
import os
import json

fortune_bp = Blueprint('fortune', __name__)

# 这里可以配置多种 AI 服务
AI_SERVICE = os.environ.get('AI_SERVICE', 'openai')  # 可选: openai, gemini, local
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

def generate_fortune_with_ai(fortune_number):
    """使用 AI 生成签文"""
    
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
            return generate_with_openai(prompt)
        elif AI_SERVICE == 'gemini' and GEMINI_API_KEY:
            return generate_with_gemini(prompt)
        else:
            # 如果没有配置 API，返回预设的签文
            return generate_fallback_fortune(fortune_number)
    except Exception as e:
        print(f"AI generation error: {e}")
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
    
    response = requests.post(url, json=data, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        content = result['candidates'][0]['content']['parts'][0]['text']
        
        # 尝试解析 JSON
        try:
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            return json.loads(content)
        except:
            return generate_fallback_fortune(1)
    else:
        raise Exception(f"Gemini API error: {response.status_code}")

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
    try:
        data = request.get_json()
        fortune_number = data.get('fortuneNumber', 1)
        
        # 验证签号范围
        if not isinstance(fortune_number, int) or fortune_number < 1 or fortune_number > 100:
            return jsonify({'error': '签号必须在 1-100 之间'}), 400
        
        # 生成签文
        fortune_data = generate_fortune_with_ai(fortune_number)
        
        return jsonify({
            'success': True,
            'data': fortune_data
        })
        
    except Exception as e:
        print(f"Error generating fortune: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
