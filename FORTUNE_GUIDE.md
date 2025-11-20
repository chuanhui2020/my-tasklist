# 🎋 AI 签文功能使用指南

## ✅ 已完成的集成

### 后端 API
- ✅ 创建了 `/api/fortune/generate` 端点
- ✅ 支持 OpenAI GPT-3.5/4
- ✅ 支持 Google Gemini Pro
- ✅ 内置 10 组精选备用签文
- ✅ 完善的错误处理和容错机制

### 前端界面
- ✅ 精美的中国传统风格 UI
- ✅ SVG 绘制的签筒和签子
- ✅ 摇晃和掉落动画
- ✅ 签文展示（繁体中文）
- ✅ 已集成后端 AI API

## 🚀 快速开始

### 选项 1：直接使用（无需配置）

系统已内置备用签文，无需任何配置即可使用：

1. 启动后端服务
2. 访问前端页面
3. 点击"靈籤占卜"
4. 开始抽签

**特点**：
- 10 首精选签诗
- 根据签号确定性生成
- 同一签号结果一致
- 无需 API Key

### 选项 2：使用 AI 生成（推荐）

#### 使用 Google Gemini（免费）

1. 获取 API Key：
   - 访问 https://makersuite.google.com/app/apikey
   - 登录并创建 API Key

2. 配置环境变量：
   ```bash
   # Windows PowerShell
   cd d:\projects\my-tasklist\backend
   echo "AI_SERVICE=gemini" > .env
   echo "GEMINI_API_KEY=你的API密钥" >> .env
   ```

3. 安装依赖（如果还没安装）：
   ```bash
   pip install requests
   ```

4. 重启后端服务

#### 使用 OpenAI

1. 获取 API Key：
   - 访问 https://platform.openai.com/api-keys
   - 创建 API Key（需要付费账户）

2. 配置环境变量：
   ```bash
   # Windows PowerShell
   cd d:\projects\my-tasklist\backend
   echo "AI_SERVICE=openai" > .env
   echo "OPENAI_API_KEY=sk-你的API密钥" >> .env
   ```

3. 重启后端服务

## 📊 签文数据说明

### 备用模式（默认）
- **总签数**：100 签（1-100）
- **签诗库**：10 首精选诗文
- **解签库**：10 条详细解读
- **指引库**：5 组运势建议
- **生成方式**：根据签号确定性选择

### AI 模式
- **总签数**：100 签（1-100）
- **生成方式**：每次实时生成
- **内容**：完全原创，每支签都不同
- **包含**：
  - 签诗（四句七言）
  - 签型（上上籤/上籤/中籤/中下籤/下籤）
  - 解签（100-150字）
  - 指引（事业/财运/感情/健康）

## 🎨 功能特点

### 视觉效果
- 🎋 SVG 手绘签筒和签子
- 🌟 金色主题，传统氛围
- 💫 流畅的动画效果
- 📱 响应式设计

### 交互体验
1. 点击"誠心求籤"
2. 签筒摇晃 2 秒
3. 签子掉落（抛物线动画）
4. AI 生成签文（或使用备用数据）
5. 展示签文（放大动画）
6. 可重新抽签

### 签文内容
- 📜 繁体中文显示
- 🎨 楷体字体
- 📖 签诗、解签、指引
- 🏷️ 签型标签（彩色）

## 💡 使用建议

### 个人使用
- 抽签频率低 → 使用备用模式
- 想要多样化 → 配置 Gemini（免费）
- 追求质量 → 配置 OpenAI（付费）

### 开发测试
- 使用备用模式，快速测试
- 无需担心 API 配额

### 生产部署
- 配置 Gemini（免费额度大）
- 或配置 OpenAI（质量稳定）
- 设置请求限流

## 🔧 故障排查

### 问题：签文生成失败
**解决**：系统会自动使用备用签文，用户体验不受影响

### 问题：API Key 无效
**检查**：
1. API Key 是否正确
2. 是否有可用额度
3. 网络是否正常

**临时方案**：移除 `.env` 文件，使用备用模式

### 问题：生成速度慢
**原因**：AI API 调用需要时间（2-5秒）
**优化**：
- 使用 Gemini（速度更快）
- 或继续使用备用模式（即时响应）

## 📝 API 测试

测试签文生成 API：

```bash
# 需要先登录获取 token
curl -X POST http://localhost:5000/api/fortune/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fortuneNumber": 88}'
```

预期响应：
```json
{
  "success": true,
  "data": {
    "type": "great",
    "typeText": "上上籤",
    "poem": "春來花自開，福至心自寬...",
    "interpretation": "此籤示意運勢漸佳...",
    "advice": [...]
  }
}
```

## 🎯 下一步

1. **测试功能**：访问 `/fortune` 页面抽签
2. **选择模式**：决定是否配置 AI
3. **享受使用**：体验传统抽签的乐趣

## 📚 相关文档

- 详细配置指南：`AI_CONFIG.md`
- 后端 API：`backend/routes/fortune_routes.py`
- 前端组件：`frontend/src/views/Fortune.vue`

---

**注意**：ChatGPT Plus 订阅不包含 API 访问权限，需要单独申请 OpenAI API Key 或使用免费的 Gemini API。
