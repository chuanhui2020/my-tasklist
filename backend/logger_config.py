import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler

def setup_logger():
    """配置日志系统"""
    
    # 创建 logs 目录
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # 日志文件路径
    log_file = os.path.join(log_dir, f'fortune_{datetime.now().strftime("%Y%m%d")}.log')
    
    # 创建 logger
    logger = logging.getLogger('fortune')
    logger.setLevel(logging.INFO)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    # 文件 handler（自动轮转，每个文件最大 10MB，保留 5 个文件）
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    
    # 控制台 handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # 日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# 创建全局 logger
fortune_logger = setup_logger()
