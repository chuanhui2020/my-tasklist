import os
from datetime import timedelta

class ProductionConfig:
    """生产环境配置"""
    
    # 基础配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'prod-secret-key-change-in-production'
    DEBUG = False
    TESTING = False
    
    # 数据库配置
    DB_USER = os.environ.get('DB_USER') or 'taskuser'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'your_strong_password'
    DB_HOST = os.environ.get('DB_HOST') or 'localhost'
    DB_NAME = os.environ.get('DB_NAME') or 'tasklist_db'
    
    SQLALCHEMY_DATABASE_URI = f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}?charset=utf8mb4'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_timeout': 20,
        'max_overflow': 0,
        'echo': False
    }
    
    # 会话配置
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    
    # JSON配置
    JSON_AS_ASCII = False
    JSON_SORT_KEYS = True
    
    # 其他配置
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB