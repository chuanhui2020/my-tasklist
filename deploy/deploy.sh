#!/bin/bash

# 自动部署脚本
# 用于将任务管理系统部署到Ubuntu服务器
# 需要root用户权限运行（2C4G服务器优化）

set -e  # 遇到错误时退出

# 配置变量
APP_DIR="/opt/tasklist"
REPO_URL="https://github.com/your-username/my-tasklist.git"  # 替换为你的仓库地址
DOMAIN="your-domain.com"  # 替换为你的域名
DB_PASSWORD="your_strong_password"  # 替换为你的数据库密码

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查是否为root用户
check_user() {
    if [ "$EUID" -ne 0 ]; then
        log_error "此脚本需要使用root用户运行"
        log_info "请使用: sudo ./deploy.sh 或切换到root用户"
        exit 1
    fi
    log_info "使用root用户运行，继续部署..."
}

# 检查环境
check_environment() {
    log_step "检查部署环境..."
    
    # 检查必要的命令
    for cmd in git python3 node npm mysql nginx; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd 未安装，请先运行 install-environment.sh"
            exit 1
        fi
    done
    
    # 检查目录
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录 $APP_DIR 不存在"
        exit 1
    fi
    
    log_info "环境检查通过"
}

# 备份现有部署（如果存在）
backup_existing() {
    if [ -d "$APP_DIR/backend" ] || [ -d "$APP_DIR/frontend" ]; then
        log_step "备份现有部署..."
        
        BACKUP_DIR="/opt/backups/tasklist/deploy_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        if [ -d "$APP_DIR/backend" ]; then
            cp -r "$APP_DIR/backend" "$BACKUP_DIR/"
        fi
        
        if [ -d "$APP_DIR/frontend" ]; then
            cp -r "$APP_DIR/frontend" "$BACKUP_DIR/"
        fi
        
        log_info "备份完成: $BACKUP_DIR"
    fi
}

# 克隆或更新代码
deploy_code() {
    log_step "部署应用代码..."
    
    cd "$APP_DIR"
    
    # 如果是首次部署
    if [ ! -d ".git" ]; then
        log_info "首次部署，克隆代码仓库..."
        git clone "$REPO_URL" .
    else
        log_info "更新现有代码..."
        git fetch origin
        git reset --hard origin/main  # 强制更新到最新版本
    fi
    
    log_info "代码部署完成"
}

# 配置数据库
setup_database() {
    log_step "配置数据库..."
    
    # 检查数据库是否存在
    if ! mysql -u taskuser -p"$DB_PASSWORD" -e "USE tasklist_db;" 2>/dev/null; then
        log_info "创建数据库和用户..."
        
        mysql -u root -e "CREATE DATABASE IF NOT EXISTS tasklist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        mysql -u root -e "CREATE USER IF NOT EXISTS 'taskuser'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
        mysql -u root -e "GRANT ALL PRIVILEGES ON tasklist_db.* TO 'taskuser'@'localhost';"
        mysql -u root -e "FLUSH PRIVILEGES;"
        
        # 导入表结构
        mysql -u taskuser -p"$DB_PASSWORD" tasklist_db < "$APP_DIR/database.sql"
        
        log_info "数据库配置完成"
    else
        log_info "数据库已存在，跳过初始化"
    fi
}

# 部署后端
deploy_backend() {
    log_step "部署后端应用..."
    
    cd "$APP_DIR/backend"
    
    # 创建虚拟环境
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn
    
    # 创建必要的目录
    mkdir -p /var/log/tasklist
    mkdir -p /var/run/tasklist
    chmod 755 /var/log/tasklist
    chmod 755 /var/run/tasklist
    
    # 更新生产配置中的数据库密码
    sed -i "s/your_strong_password/$DB_PASSWORD/g" production_config.py
    
    log_info "后端部署完成"
}

# 部署前端
deploy_frontend() {
    log_step "部署前端应用..."
    
    cd "$APP_DIR/frontend"
    
    # 安装依赖
    npm install
    
    # 构建生产版本
    npm run build
    
    # 设置正确的权限
    chown -R www-data:www-data dist/
    
    log_info "前端部署完成"
}

# 配置Nginx
configure_nginx() {
    log_step "配置Nginx..."
    
    # 创建Nginx配置
    tee /etc/nginx/sites-available/tasklist > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 前端静态文件
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        
        # 超时设置
        proxy_connect_timeout 30;
        proxy_send_timeout 30;
        proxy_read_timeout 30;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    # 启用站点
    ln -sf /etc/nginx/sites-available/tasklist /etc/nginx/sites-enabled/
    
    # 删除默认站点
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试配置
    nginx -t
    
    log_info "Nginx配置完成"
}

# 创建系统服务
create_systemd_service() {
    log_step "创建系统服务..."
    
    # 创建后端服务
    tee /etc/systemd/system/tasklist-backend.service > /dev/null << EOF
[Unit]
Description=Task List Backend
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=exec
User=root
Group=root
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin
Environment=FLASK_ENV=production
Environment=DB_PASSWORD=$DB_PASSWORD
ExecStart=$APP_DIR/backend/venv/bin/gunicorn --config gunicorn.conf.py app:app
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=3
KillMode=mixed
TimeoutStopSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    # 重新加载systemd
    systemctl daemon-reload
    
    log_info "系统服务创建完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    # 停止现有服务（如果在运行）
    systemctl stop tasklist-backend 2>/dev/null || true
    
    # 启动后端服务
    systemctl enable tasklist-backend
    systemctl start tasklist-backend
    
    # 重启Nginx
    systemctl reload nginx
    
    # 等待服务启动
    sleep 3
    
    # 检查服务状态
    if systemctl is-active --quiet tasklist-backend; then
        log_info "后端服务启动成功"
    else
        log_error "后端服务启动失败"
        journalctl -u tasklist-backend --no-pager -n 20
        exit 1
    fi
    
    if systemctl is-active --quiet nginx; then
        log_info "Nginx服务运行正常"
    else
        log_error "Nginx服务异常"
        exit 1
    fi
}

# 运行部署后测试
run_tests() {
    log_step "运行部署测试..."
    
    # 测试后端API
    if curl -f -s "http://localhost:5000/api/tasks" > /dev/null; then
        log_info "✅ 后端API测试通过"
    else
        log_warn "❌ 后端API测试失败"
    fi
    
    # 测试前端
    if curl -f -s "http://localhost/health" > /dev/null; then
        log_info "✅ 前端健康检查通过"
    else
        log_warn "❌ 前端健康检查失败"
    fi
    
    # 测试数据库连接
    if mysql -u taskuser -p"$DB_PASSWORD" -e "SELECT 1;" tasklist_db > /dev/null 2>&1; then
        log_info "✅ 数据库连接正常"
    else
        log_warn "❌ 数据库连接失败"
    fi
}

# 显示部署摘要
show_summary() {
    echo ""
    echo "========================================"
    echo "🎉 部署完成！"
    echo "========================================"
    echo ""
    echo "服务状态："
    echo "  🔄 后端服务: $(systemctl is-active tasklist-backend 2>/dev/null || echo '未知')"
    echo "  🔄 Nginx: $(systemctl is-active nginx 2>/dev/null || echo '未知')"
    echo "  🔄 MySQL: $(systemctl is-active mysql 2>/dev/null || echo '未知')"
    echo ""
    echo "访问地址："
    echo "  🌐 HTTP: http://$DOMAIN"
    echo "  📱 移动端: http://$DOMAIN（响应式设计）"
    echo ""
    echo "管理命令："
    echo "  📊 查看后端日志: journalctl -u tasklist-backend -f"
    echo "  🔄 重启后端: systemctl restart tasklist-backend"
    echo "  🔄 重启Nginx: systemctl reload nginx"
    echo "  📈 查看状态: systemctl status tasklist-backend"
    echo ""
    echo "配置SSL证书："
    echo "  🔒 certbot --nginx -d $DOMAIN"
    echo ""
    echo "数据库管理："
    echo "  💾 备份: mysqldump -u taskuser -p tasklist_db > backup.sql"
    echo "  🔧 连接: mysql -u taskuser -p tasklist_db"
    echo ""
    log_info "部署成功完成！"
}

# 主函数
main() {
    echo "个人任务管理系统 - 自动部署脚本"
    echo "目标服务器: Ubuntu 22.04 LTS (2C4G)"
    echo ""
    
    log_warn "请确保已经："
    echo "  1. 运行了 install-environment.sh"
    echo "  2. 配置了MySQL安全设置"
    echo "  3. 更新了脚本中的配置变量（域名、数据库密码等）"
    echo ""
    
    read -p "是否继续部署？(y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "部署已取消"
        exit 0
    fi
    
    # 执行部署步骤
    check_user
    check_environment
    backup_existing
    deploy_code
    setup_database
    deploy_backend
    deploy_frontend
    configure_nginx
    create_systemd_service
    start_services
    run_tests
    
    # 显示摘要
    show_summary
}

# 运行主函数
main "$@"