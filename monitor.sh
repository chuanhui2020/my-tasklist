#!/bin/bash

# Docker 容器资源监控脚本

echo "=========================================="
echo "  服务器资源监控 - $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 1. 系统整体资源
echo "📊 系统资源使用情况："
echo "---"
free -h | grep -E "Mem|Swap" | awk '{print $1 "\t" $2 "\t" $3 "\t" $7}'
echo ""

# 2. CPU 使用率
echo "💻 CPU 使用率："
echo "---"
top -bn1 | grep "Cpu(s)" | awk '{print "使用: " $2 ", 空闲: " $8}'
echo ""

# 3. 磁盘使用
echo "💾 磁盘使用情况："
echo "---"
df -h / | tail -n 1 | awk '{print "总计: " $2 ", 已用: " $3 " (" $5 "), 可用: " $4}'
echo ""

# 4. Docker 容器资源
echo "🐳 Docker 容器资源："
echo "---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "NAME|tasklist"
echo ""

# 5. Docker 卷使用
echo "📁 Docker 卷使用："
echo "---"
docker system df -v | grep -E "VOLUME NAME|tasklist"
echo ""

echo "=========================================="
echo "提示："
echo "  - 运行 'docker stats' 查看实时监控"
echo "  - 运行 'htop' 查看详细进程信息"
echo "  - 运行 'free -h' 查看内存详情"
echo "=========================================="
