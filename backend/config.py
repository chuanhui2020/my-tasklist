import os


class Settings:
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DATABASE_URL: str = os.environ.get(
        'DATABASE_URL',
        'mysql+pymysql://root:123456@localhost/tasklist_db?charset=utf8mb4',
    )
    AUTH_TOKEN_MAX_AGE: int = int(os.environ.get('AUTH_TOKEN_MAX_AGE', 60 * 60 * 24))


settings = Settings()
