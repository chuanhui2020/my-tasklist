#!/bin/bash

# 数据库备份脚本
# 用于定期备份任务管理系统的数据库

set -e

# 配置
BACKUP_DIR="/opt/backups/tasklist"
DB_NAME="tasklist_db"
DB_USER="taskuser"
DB_PASSWORD="your_strong_password"  # 替换为实际密码
RETENTION_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/tasklist_db_$TIMESTAMP.sql"

# 执行备份
echo "开始数据库备份..."
mysqldump -u "$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --add-drop-table \
    --add-locks \
    --create-options \
    --disable-keys \
    --extended-insert \
    --lock-tables=false \
    "$DB_NAME" > "$BACKUP_FILE"

# 压缩备份文件
gzip "$BACKUP_FILE"

echo "数据库备份完成: ${BACKUP_FILE}.gz"

# 清理旧备份
echo "清理 $RETENTION_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "tasklist_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 显示备份状态
echo "当前备份文件："
ls -lh "$BACKUP_DIR"/tasklist_db_*.sql.gz 2>/dev/null || echo "没有找到备份文件"

echo "备份脚本执行完成"