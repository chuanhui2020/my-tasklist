# 🇨🇳 国产 AI 免费使用指南

由于 Google Gemini 在国内无法访问，强烈建议使用国产大模型。

## 🚀 推荐方案：硅基流动 (SiliconFlow)

聚合了 DeepSeek、通义千问等模型，**永久免费**且兼容 OpenAI 格式。

### 步骤 1：注册并获取 Key
1. 访问 [https://cloud.siliconflow.cn/](https://cloud.siliconflow.cn/)
2. 注册账号（手机号注册）
3. 点击左侧 "API 密钥" -> "新建 API 密钥"
4. 复制生成的 Key（以 `sk-` 开头）

### 步骤 2：修改配置
编辑 `backend/.env` 文件：

```ini
# 启用兼容模式
AI_SERVICE=compatible

# 填入刚才复制的 Key
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 硅基流动的 Base URL
AI_BASE_URL=https://api.siliconflow.cn

# 选择免费模型 (推荐 DeepSeek V2.5 或 Qwen 2.5)
AI_MODEL=deepseek-ai/DeepSeek-V2.5
# 或者
# AI_MODEL=Qwen/Qwen2.5-7B-Instruct
```

### 步骤 3：重启后端
```bash
# 停止旧进程
pkill -f "python.*app.py"

# 重新启动
cd ~/home/my-tasklist/backend
python -u app.py
```

---

## 🤖 其他国产模型配置

### 1. 深度求索 (DeepSeek)
- **注册**: [https://platform.deepseek.com/](https://platform.deepseek.com/)
- **配置**:
  ```ini
  AI_SERVICE=compatible
  AI_API_KEY=sk-xxxxxx
  AI_BASE_URL=https://api.deepseek.com
  AI_MODEL=deepseek-chat
  ```

### 2. 智谱 AI (ChatGLM)
- **注册**: [https://bigmodel.cn/](https://bigmodel.cn/)
- **配置**:
  ```ini
  AI_SERVICE=compatible
  AI_API_KEY=xxxxxx.xxxxxx
  AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
  AI_MODEL=glm-4-flash
  ```

---

## ⚡ 临时方案（无需注册）

如果您现在不想注册，可以使用**本地模式**（不调用 AI，直接返回结果）：

编辑 `backend/.env`：
```ini
AI_SERVICE=local
```

然后重启后端即可。
