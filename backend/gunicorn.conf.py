# 服务器绑定
bind = "127.0.0.1:5000"

# 工作进程（2C4G服务器优化：2核心，建议3个worker进程）
workers = 3
worker_class = "sync"
worker_connections = 500  # 降低连接数以适应4G内存
max_requests = 800  # 降低请求数以减少内存使用
max_requests_jitter = 50

# 超时设置
timeout = 30
keepalive = 2

# 进程名
proc_name = "tasklist-backend"

# 用户和组（root用户运行）
user = "root"
group = "root"

# 日志
errorlog = "/var/log/tasklist/gunicorn-error.log"
accesslog = "/var/log/tasklist/gunicorn-access.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 进程文件
pidfile = "/var/run/tasklist/gunicorn.pid"

# 预加载应用
preload_app = True

# 临时目录（4G内存限制）
tmp_upload_dir = "/tmp"
worker_tmp_dir = "/dev/shm"  # 使用内存文件系统提高性能

# SSL配置（如果需要）
# keyfile = "/path/to/ssl/key.pem"
# certfile = "/path/to/ssl/cert.pem"

# 环境变量
raw_env = [
    "FLASK_ENV=production",
    "PYTHONUNBUFFERED=1",
]


# 重启信号
def on_starting(server):
    server.log.info("Starting Tasklist Backend Server")


def on_reload(server):
    server.log.info("Reloading Tasklist Backend Server")


def worker_int(worker):
    worker.log.info("Worker received INT or QUIT signal")


def pre_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def post_fork(server, worker):
    server.log.info("Worker spawned (pid: %s)", worker.pid)


def worker_abort(worker):
    worker.log.info("Worker received SIGABRT signal")
