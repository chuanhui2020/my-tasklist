# 🔍 签文 API 调试指南

## 问题：总是返回"请求失败"且没有日志

### 可能的原因

1. **后端没有启动**
2. **路由配置错误**
3. **CORS 问题**
4. **认证问题**
5. **网络请求失败**

---

## 🛠️ 调试步骤

### 步骤 1：检查后端是否启动

```powershell
# 查看后端进程
Get-Process python -ErrorAction SilentlyContinue

# 如果没有，启动后端
cd d:\projects\my-tasklist\backend
python app.py
```

**预期输出**：
```
* Running on http://0.0.0.0:5000
```

---

### 步骤 2：测试后端 API（不通过前端）

```powershell
# 先获取 token（登录）
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'

$token = $loginResponse.token
Write-Host "Token: $token"

# 测试签文 API
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/fortune/generate" `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"fortuneNumber":88}'

Write-Host "响应: $($response | ConvertTo-Json -Depth 10)"
```

---

### 步骤 3：查看后端日志

启动后端后，每次请求都应该看到：

```
============================================================
🎯 [API] 收到签文生成请求
============================================================
📦 请求数据: {'fortuneNumber': 88}
🎲 签号: 88
✅ 验证通过，开始生成签文...

🎋 开始生成第 88 签
📋 当前配置:
   AI_SERVICE = gemini
   ...
```

**如果看不到这些日志**：
- ❌ 请求没有到达后端
- 可能是前端配置问题

---

### 步骤 4：检查前端配置

打开浏览器开发者工具（F12）→ Network 标签页

点击"求签"按钮，查看：

1. **请求 URL**：应该是 `http://localhost:5000/api/fortune/generate`
2. **请求方法**：POST
3. **状态码**：
   - 200 = 成功
   - 401 = 未登录
   - 404 = 路由不存在
   - 500 = 服务器错误

4. **请求头**：应该包含 `Authorization: Bearer xxx`

5. **请求体**：
   ```json
   {"fortuneNumber": 88}
   ```

6. **响应**：查看具体错误信息

---

## 🔧 常见问题修复

### 问题 1：404 Not Found

**原因**：路由不存在

**检查**：
```python
# backend/app.py 应该有：
app.register_blueprint(fortune_bp, url_prefix='/api/fortune')
```

**修复**：确保 `fortune_routes.py` 被正确导入和注册

---

### 问题 2：401 Unauthorized

**原因**：需要登录

**修复**：在 `fortune_routes.py` 中添加认证装饰器（如果需要）

或者，移除认证要求：
```python
# 当前路由不需要认证，应该可以直接访问
```

---

### 问题 3：500 Internal Server Error

**原因**：后端代码错误

**查看**：后端控制台的完整错误堆栈

**常见错误**：
- `ModuleNotFoundError: No module named 'logger_config'`
  - 解决：删除 `from logger_config import ...` 这行

- `ImportError: cannot import name 'fortune_bp'`
  - 解决：检查 `fortune_routes.py` 语法错误

---

### 问题 4：CORS 错误

**浏览器控制台显示**：
```
Access to XMLHttpRequest at 'http://localhost:5000/api/fortune/generate' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**修复**：
```python
# backend/app.py
CORS(app)  # 应该已经有了
```

---

## 🧪 快速测试脚本

### 测试 1：后端是否运行
```powershell
curl http://localhost:5000/api/auth/login `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'
```

### 测试 2：签文 API（无需登录）
```powershell
curl http://localhost:5000/api/fortune/generate `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"fortuneNumber":88}'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "type": "medium",
    "typeText": "中籤",
    "poem": "...",
    "interpretation": "...",
    "advice": [...]
  }
}
```

---

## 📋 检查清单

- [ ] 后端已启动（`python app.py`）
- [ ] 能看到 "Running on http://0.0.0.0:5000"
- [ ] `fortune_routes.py` 没有语法错误
- [ ] `app.py` 正确注册了 `fortune_bp`
- [ ] 前端已登录
- [ ] 浏览器 Network 标签能看到请求
- [ ] 后端控制台能看到日志

---

## 🎯 最可能的问题

基于"没有任何日志"，最可能是：

### 1. 后端没有启动
```powershell
# 重新启动
cd d:\projects\my-tasklist\backend
python app.py
```

### 2. 导入错误导致后端启动失败
```python
# 检查 fortune_routes.py 第 5 行
from logger_config import fortune_logger as logger

# 如果报错，临时注释掉：
# from logger_config import fortune_logger as logger
```

### 3. 前端请求地址错误
```javascript
// frontend/src/api/index.js
// 应该是：
generateFortune(fortuneNumber) {
  return api.post('/fortune/generate', { fortuneNumber })
}
```

---

## 💡 临时解决方案

如果还是不行，可以先移除 logger 导入：

```python
# fortune_routes.py 第 5 行
# 注释掉：
# from logger_config import fortune_logger as logger

# 所有 logger.info(...) 改回 print(...)
```

然后重启后端，应该就能看到日志了。

---

## 📞 需要帮助？

请提供以下信息：

1. 后端启动时的完整输出
2. 浏览器 F12 → Network 中的请求详情
3. 后端控制台是否有任何输出
4. 是否看到 "🎯 [API] 收到签文生成请求"

这样我可以更准确地定位问题！
