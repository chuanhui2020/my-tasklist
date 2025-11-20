#!/bin/bash

# 签文功能诊断脚本

echo "=========================================="
echo "🔍 签文功能完整诊断"
echo "=========================================="
echo ""

# 1. 检查后端进程
echo "1️⃣ 检查后端进程..."
BACKEND_PID=$(ps aux | grep "python.*app.py" | grep -v grep | awk '{print $2}')
if [ -z "$BACKEND_PID" ]; then
    echo "   ❌ 后端未运行！"
    echo "   请运行: cd /path/to/backend && python app.py"
else
    echo "   ✅ 后端正在运行 (PID: $BACKEND_PID)"
fi
echo ""

# 2. 检查端口
echo "2️⃣ 检查 5000 端口..."
PORT_CHECK=$(netstat -tlnp 2>/dev/null | grep :5000 || lsof -i :5000 2>/dev/null)
if [ -z "$PORT_CHECK" ]; then
    echo "   ❌ 5000 端口未监听！"
else
    echo "   ✅ 5000 端口正在监听"
    echo "   $PORT_CHECK"
fi
echo ""

# 3. 测试后端 API
echo "3️⃣ 测试后端 API..."
echo "   测试 URL: http://localhost:5000/api/fortune/generate"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  http://localhost:5000/api/fortune/generate \
  -H "Content-Type: application/json" \
  -d '{"fortuneNumber":88}' \
  2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ API 响应成功 (HTTP $HTTP_CODE)"
    echo "   响应数据: ${BODY:0:100}..."
elif [ "$HTTP_CODE" = "000" ] || [ -z "$HTTP_CODE" ]; then
    echo "   ❌ 无法连接到后端！"
    echo "   错误: $BODY"
else
    echo "   ⚠️  API 返回错误 (HTTP $HTTP_CODE)"
    echo "   响应: $BODY"
fi
echo ""

# 4. 检查日志文件
echo "4️⃣ 检查日志文件..."
LOG_FILES=$(find /root/home/my-tasklist/backend -name "*.log" -o -name "nohup.out" 2>/dev/null)
if [ -z "$LOG_FILES" ]; then
    echo "   ⚠️  未找到日志文件"
else
    echo "   ✅ 找到日志文件:"
    for log in $LOG_FILES; do
        echo "      - $log"
        echo "        最后 5 行:"
        tail -5 "$log" | sed 's/^/        /'
    done
fi
echo ""

# 5. 检查前端配置
echo "5️⃣ 前端配置检查..."
FRONTEND_CONFIG="/root/home/my-tasklist/frontend/src/api/index.js"
if [ -f "$FRONTEND_CONFIG" ]; then
    BASE_URL=$(grep "baseURL" "$FRONTEND_CONFIG" | head -1)
    TIMEOUT=$(grep "timeout" "$FRONTEND_CONFIG" | head -1)
    echo "   ✅ 前端配置:"
    echo "      $BASE_URL"
    echo "      $TIMEOUT"
else
    echo "   ⚠️  未找到前端配置文件"
fi
echo ""

# 6. 网络连通性
echo "6️⃣ 网络连通性..."
if command -v curl &> /dev/null; then
    echo "   测试本地连接..."
    curl -s -o /dev/null -w "   HTTP 状态码: %{http_code}\n" http://localhost:5000/ || echo "   ❌ 无法连接"
else
    echo "   ⚠️  curl 未安装"
fi
echo ""

# 7. 建议
echo "=========================================="
echo "💡 建议操作"
echo "=========================================="

if [ -z "$BACKEND_PID" ]; then
    echo "1. 启动后端:"
    echo "   cd /root/home/my-tasklist/backend"
    echo "   python app.py"
    echo ""
fi

if [ "$HTTP_CODE" != "200" ]; then
    echo "2. 查看后端日志:"
    echo "   tail -f /root/home/my-tasklist/backend/nohup.out"
    echo "   # 或"
    echo "   tail -f /root/home/my-tasklist/backend/app.log"
    echo ""
fi

echo "3. 手动测试 API:"
echo "   curl -X POST http://localhost:5000/api/fortune/generate \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"fortuneNumber\":88}'"
echo ""

echo "=========================================="
echo "✅ 诊断完成"
echo "=========================================="
