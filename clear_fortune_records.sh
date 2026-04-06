#!/bin/bash
# 清除占卜历史记录脚本

# 从 .env 文件读取配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "=== 清除占卜历史记录 ==="

# 先查看当前记录数
echo "当前记录数："
docker compose exec db mysql -u root -p"${MYSQL_ROOT_PASSWORD:-123456}" tasklist_db -e "SELECT COUNT(*) AS total FROM fortune_records;" 2>/dev/null

read -p "确认删除所有占卜记录？(y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消"
    exit 0
fi

docker compose exec db mysql -u root -p"${MYSQL_ROOT_PASSWORD:-123456}" tasklist_db -e "DELETE FROM fortune_records;" 2>/dev/null

echo "删除完成，剩余记录数："
docker compose exec db mysql -u root -p"${MYSQL_ROOT_PASSWORD:-123456}" tasklist_db -e "SELECT COUNT(*) AS total FROM fortune_records;" 2>/dev/null
