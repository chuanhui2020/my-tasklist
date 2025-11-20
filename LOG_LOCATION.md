# 📁 日志文件位置说明

## 当前状态

### ✅ 已创建日志系统
- 文件：`backend/logger_config.py`
- 功能：自动保存日志到文件 + 控制台显示

### 📂 日志保存位置

```
d:\projects\my-tasklist\backend\logs\
├── fortune_20251120.log    ← 今天的日志
├── fortune_20251121.log    ← 明天的日志
├── fortune_20251122.log    ← 后天的日志
...
```

**特点**：
- ✅ 按日期自动分文件
- ✅ 每个文件最大 10MB
- ✅ 超过大小自动轮转（保留 5 个备份）
- ✅ UTF-8 编码，支持中文

---

## 🔧 如何启用日志文件

### 方法 1：手动修改（简单）

在 `backend/routes/fortune_routes.py` 文件开头添加：

```python
from logger_config import fortune_logger as logger
```

然后将所有的 `print(...)` 替换为 `logger.info(...)`

例如：
```python
# 修改前
print(f"🎋 开始生成第 {fortune_number} 签")

# 修改后
logger.info(f"🎋 开始生成第 {fortune_number} 签")
```

### 方法 2：使用查找替换

1. 打开 `backend/routes/fortune_routes.py`
2. Ctrl+H 打开查找替换
3. 查找：`print(`
4. 替换为：`logger.info(`
5. 全部替换

---

## 📊 日志文件示例

### 文件内容格式
```
2025-11-20 19:30:15 - INFO - 
🎋 开始生成第 88 签
2025-11-20 19:30:15 - INFO - 📋 当前配置:
2025-11-20 19:30:15 - INFO -    AI_SERVICE = gemini
2025-11-20 19:30:15 - INFO -    GEMINI_API_KEY = 已配置 (abc12345)
2025-11-20 19:30:15 - INFO - 🎯 决策：使用 Gemini API
2025-11-20 19:30:15 - INFO - 
============================================================
2025-11-20 19:30:15 - INFO - 🤖 [Gemini AI] 开始调用 - 2025-11-20 19:30:15
2025-11-20 19:30:18 - INFO - 📥 响应状态码: 200
2025-11-20 19:30:18 - INFO - ✅ 调用成功！
2025-11-20 19:30:18 - INFO - ✨ 签文解析成功！
```

---

## 🎯 当前可用的方式

### 不修改代码（临时方案）

**保存到文件**：
```powershell
cd d:\projects\my-tasklist\backend
python app.py > logs\manual_$(Get-Date -Format 'yyyyMMdd_HHmmss').log 2>&1
```

**同时显示和保存**：
```powershell
python app.py | Tee-Object -FilePath logs\manual.log
```

### 修改代码（永久方案）

按照上面"方法 1"或"方法 2"修改 `fortune_routes.py`

---

## 📝 查看日志

### 实时查看
```powershell
# Windows PowerShell
Get-Content d:\projects\my-tasklist\backend\logs\fortune_20251120.log -Wait
```

### 查看最新 50 行
```powershell
Get-Content d:\projects\my-tasklist\backend\logs\fortune_20251120.log -Tail 50
```

### 搜索错误
```powershell
Select-String -Path d:\projects\my-tasklist\backend\logs\*.log -Pattern "ERROR"
```

### 搜索特定签号
```powershell
Select-String -Path d:\projects\my-tasklist\backend\logs\*.log -Pattern "第 88 签"
```

---

## 🔄 日志轮转说明

### 自动轮转规则
- 单个文件超过 10MB → 自动创建新文件
- 保留最近 5 个备份文件
- 旧文件命名：`fortune_20251120.log.1`, `.2`, `.3` ...

### 手动清理
```powershell
# 删除 7 天前的日志
Get-ChildItem d:\projects\my-tasklist\backend\logs\*.log | 
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | 
  Remove-Item
```

---

## 📊 日志分析

### 统计调用次数
```powershell
(Select-String -Path d:\projects\my-tasklist\backend\logs\*.log -Pattern "开始生成").Count
```

### 统计成功率
```powershell
$total = (Select-String -Pattern "开始生成" -Path logs\*.log).Count
$success = (Select-String -Pattern "签文解析成功" -Path logs\*.log).Count
Write-Host "成功率: $($success/$total*100)%"
```

### 查看错误日志
```powershell
Select-String -Path logs\*.log -Pattern "ERROR|❌" | 
  Select-Object -Last 10
```

---

## ⚙️ 日志配置

### 修改日志级别
编辑 `backend/logger_config.py`：

```python
# 只记录警告和错误
logger.setLevel(logging.WARNING)

# 记录所有信息（默认）
logger.setLevel(logging.INFO)

# 记录调试信息
logger.setLevel(logging.DEBUG)
```

### 修改文件大小限制
```python
file_handler = RotatingFileHandler(
    log_file,
    maxBytes=50*1024*1024,  # 改为 50MB
    backupCount=10,          # 保留 10 个备份
    encoding='utf-8'
)
```

---

## 🎯 快速开始

### 最简单的方式（推荐）

1. **启动后端时重定向输出**：
   ```powershell
   cd d:\projects\my-tasklist\backend
   
   # 创建 logs 目录
   mkdir logs -ErrorAction SilentlyContinue
   
   # 启动并保存日志
   python app.py | Tee-Object -FilePath logs\fortune.log
   ```

2. **查看日志**：
   ```powershell
   # 另开一个 PowerShell 窗口
   Get-Content logs\fortune.log -Wait
   ```

这样就可以同时在控制台看到日志，并自动保存到文件了！

---

## 📌 总结

| 方案 | 优点 | 缺点 |
|------|------|------|
| **控制台输出**（当前） | 简单，无需配置 | 不保存，关闭就丢失 |
| **手动重定向** | 简单，一行命令 | 每次启动都要记得 |
| **使用 logger**（推荐） | 自动保存，按日期分文件 | 需要修改代码 |

**建议**：
- 开发测试：使用控制台或手动重定向
- 生产环境：修改代码使用 logger 系统
