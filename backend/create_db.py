import pymysql

try:
    conn = pymysql.connect(host='localhost', user='root', password='123456')
    cursor = conn.cursor()
    cursor.execute("CREATE DATABASE IF NOT EXISTS tasklist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print("Database created successfully")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
