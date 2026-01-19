import os

class Config:
    # Flask 密钥 - 从环境变量读取，生产环境必须设置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

    # 数据库连接 - 优先从环境变量读取，Docker 环境会自动配置
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+pymysql://root:123456@localhost/tasklist_db?charset=utf8mb4'

    # SQLAlchemy 配置
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,  # 连接池预检查，防止连接超时
        'pool_recycle': 3600,   # 连接回收时间（秒）
    }