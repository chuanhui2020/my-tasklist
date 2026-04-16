#!/usr/bin/env python3
"""
MySQL → D1 数据导出脚本
在服务器上运行，导出所有表数据为 JSON，供 D1 导入使用。

用法:
  pip install pymysql
  python export_data.py > data.json

或者通过 docker compose exec:
  docker compose exec backend python -c "$(cat scripts/export_data.py)"
"""

import json
import os
import sys
from datetime import date, datetime

import pymysql


def json_serial(obj):
    if isinstance(obj, datetime):
        return obj.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(obj, date):
        return obj.strftime('%Y-%m-%d')
    raise TypeError(f"Type {type(obj)} not serializable")


def main():
    conn = pymysql.connect(
        host=os.getenv('DB_HOST', '127.0.0.1'),
        port=int(os.getenv('DB_PORT', '3307')),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'tasklist_db'),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
    )

    tables = ['users', 'tasks', 'bmi_profiles', 'fortune_records',
              'secure_notes', 'weight_records', 'countdowns', 'weekly_menus']

    data = {}
    with conn.cursor() as cursor:
        for table in tables:
            cursor.execute(f'SELECT * FROM `{table}`')
            rows = cursor.fetchall()
            data[table] = rows

    conn.close()

    print(json.dumps(data, default=json_serial, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
