import json
import os
from datetime import datetime


LOG_DIR = os.environ.get('AI_LOG_DIR', os.path.join(os.path.dirname(__file__), 'logs'))


def log_ai_transaction(service, model, request_data, response_data, status_code, duration):
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)

    log_file = os.path.join(LOG_DIR, f"ai_requests_{datetime.now().strftime('%Y-%m-%d')}.log")
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
        print(f"❌ 写入AI日志文件失败: {e}")
