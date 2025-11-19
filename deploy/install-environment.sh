#!/bin/bash

# Ubuntu服务器环境自动安装脚本
# Ubuntu 22.04 LTS - 2C4G配置优化
# 需要root用户权限运行

set -e  # 遇到错误时退出

echo "🚀 开始安装Ubuntu服务器环境..."
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_user() {
    if [ "$EUID" -ne 0 ]; then
        log_error "此脚本需要使用root用户运行"
        log_info "请使用: sudo ./install-environment.sh 或切换到root用户"
        exit 1
    fi
    log_info "使用root用户运行，继续安装..."
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    apt update && apt upgrade -y
    log_info "系统更新完成"
}

# 安装基础工具
install_basics() {
    log_info "安装基础工具..."
    apt install -y \
        git \
        curl \
        wget \
        unzip \
        software-properties-common \
        build-essential \
        libssl-dev \
        libffi-dev \
        python3-dev \
        pkg-config \
        libmysqlclient-dev \
        htop \
        iotop \
        net-tools \
        vim
    log_info "基础工具安装完成"
}

# 安装Python
install_python() {
    log_info "安装Python 3和pip..."
    apt install -y python3 python3-pip python3-venv python3-full
    
    # 解决externally-managed-environment问题
    log_info "配置Python环境..."
    
    # 方法1: 移除外部管理标记（临时解决）
    if [ -f "/usr/lib/python3.12/EXTERNALLY-MANAGED" ]; then
        mv /usr/lib/python3.12/EXTERNALLY-MANAGED /usr/lib/python3.12/EXTERNALLY-MANAGED.bak
        log_info "已备份Python外部管理配置"
    fi
    
    # 升级pip
    python3 -m pip install --upgrade pip
    
    # 验证安装
    python3 --version
    pip3 --version
    
    log_info "Python安装完成"
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js 18.x..."
    
    # 添加NodeSource仓库
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    
    # 验证安装
    node --version
    npm --version
    
    log_info "Node.js安装完成"
}

# 安装MySQL
install_mysql() {
    log_info "安装MySQL..."
    
    # 设置非交互式安装
    export DEBIAN_FRONTEND=noninteractive
    debconf-set-selections <<< 'mysql-server mysql-server/root_password password ""'
    debconf-set-selections <<< 'mysql-server mysql-server/root_password_again password ""'
    
    apt install -y mysql-server
    
    # 启动服务
    systemctl start mysql
    systemctl enable mysql
    
    log_info "MySQL安装完成"
    log_warn "请稍后运行 'mysql_secure_installation' 来配置MySQL安全设置"
}

# 安装Nginx
install_nginx() {
    log_info "安装Nginx..."
    
    apt install -y nginx
    
    # 启动服务
    systemctl start nginx
    systemctl enable nginx
    
    # 检查状态
    if systemctl is-active --quiet nginx; then
        log_info "Nginx安装并启动成功"
    else
        log_error "Nginx启动失败"
    fi
}

# 安装SSL证书工具
install_certbot() {
    log_info "安装Certbot（SSL证书工具）..."
    apt install -y certbot python3-certbot-nginx
    log_info "Certbot安装完成"
}

# 配置防火墙
setup_firewall() {
    log_info "配置防火墙..."
    
    # 启用ufw
    ufw --force enable
    
    # 允许SSH
    ufw allow 22/tcp
    
    # 允许HTTP和HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # 显示状态
    ufw status
    
    log_info "防火墙配置完成"
}

# 创建应用目录
setup_app_directory() {
    log_info "创建应用目录..."
    
    mkdir -p /opt/tasklist
    chmod 755 /opt/tasklist
    
    # 创建日志目录
    mkdir -p /var/log/tasklist
    chmod 755 /var/log/tasklist
    
    # 创建备份目录
    mkdir -p /opt/backups/tasklist
    chmod 755 /opt/backups/tasklist
    
    # 创建运行时目录
    mkdir -p /var/run/tasklist
    chmod 755 /var/run/tasklist
    
    log_info "目录创建完成"
}

# 优化系统设置
optimize_system() {
    log_info "优化系统设置..."
    
    # 增加文件描述符限制
    echo "* soft nofile 65536" >> /etc/security/limits.conf
    echo "* hard nofile 65536" >> /etc/security/limits.conf
    
    # 优化网络参数（适配2C4G服务器）
    echo "net.core.somaxconn = 2048" >> /etc/sysctl.conf
    echo "net.core.netdev_max_backlog = 8192" >> /etc/sysctl.conf
    echo "net.ipv4.tcp_max_syn_backlog = 2048" >> /etc/sysctl.conf
    echo "vm.swappiness = 10" >> /etc/sysctl.conf
    echo "vm.dirty_ratio = 15" >> /etc/sysctl.conf
    echo "vm.dirty_background_ratio = 5" >> /etc/sysctl.conf
    
    # 应用sysctl设置
    sysctl -p
    
    log_info "系统优化完成"
}

# 显示安装摘要
show_summary() {
    echo ""
    echo "========================================"
    echo "🎉 环境安装完成！"
    echo "========================================"
    echo ""
    echo "已安装的软件："
    echo "  ✅ Python 3: $(python3 --version 2>/dev/null || echo '未找到')"
    echo "  ✅ Node.js: $(node --version 2>/dev/null || echo '未找到')"
    echo "  ✅ NPM: $(npm --version 2>/dev/null || echo '未找到')"
    echo "  ✅ MySQL: $(mysql --version 2>/dev/null | cut -d' ' -f6 | cut -d',' -f1 || echo '已安装')"
    echo "  ✅ Nginx: $(nginx -v 2>&1 | cut -d' ' -f3 | cut -d'/' -f2 || echo '已安装')"
    echo "  ✅ Certbot: $(certbot --version 2>/dev/null | cut -d' ' -f2 || echo '已安装')"
    echo ""
    echo "服务状态："
    echo "  🔄 MySQL: $(systemctl is-active mysql 2>/dev/null || echo '未知')"
    echo "  🔄 Nginx: $(systemctl is-active nginx 2>/dev/null || echo '未知')"
    echo ""
    echo "下一步操作："
    echo "  1. 配置MySQL: mysql_secure_installation"
    echo "  2. 运行部署脚本: ./deploy.sh"
    echo "  3. 配置域名和SSL证书"
    echo ""
    echo "系统信息："
    echo "  💾 内存: $(free -h | grep '^Mem:' | awk '{print $2}' || echo '未知')"
    echo "  🖥️  CPU: $(nproc || echo '未知') 核心"
    echo "  💽 磁盘: $(df -h / | tail -1 | awk '{print $2}' || echo '未知')"
    echo ""
    echo "目录信息："
    echo "  📁 应用目录: /opt/tasklist"
    echo "  📁 日志目录: /var/log/tasklist"
    echo "  📁 备份目录: /opt/backups/tasklist"
    echo ""
    log_info "安装完成！请检查上述信息并按照下一步操作进行。"
}

# 主函数
main() {
    echo "个人任务管理系统 - Ubuntu服务器环境安装脚本"
    echo "适用于: Ubuntu 22.04 LTS"
    echo ""
    
    read -p "是否继续安装？(y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "安装已取消"
        exit 0
    fi
    
    # 执行安装步骤
    check_user
    update_system
    install_basics
    install_python
    install_nodejs
    install_mysql
    install_nginx
    install_certbot
    setup_firewall
    setup_app_directory
    optimize_system
    
    # 显示摘要
    show_summary
}

# 运行主函数
main "$@"