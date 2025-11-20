# AI 签文生成配置指南

## 概述

求签功能已集成 AI 生成签文，支持多种 AI 服务。即使不配置 API Key，系统也会使用内置的备用签文数据。

## 支持的 AI 服务

### 1. OpenAI (推荐)
- 模型：GPT-3.5-turbo 或 GPT-4
- 需要：OpenAI API Key

### 2. Google Gemini
- 模型：Gemini Pro
- 需要：Google AI API Key

### 3. 备用模式（无需配置）
- 使用预设的 10 组精选签文
- 根据签号确定性生成，同一签号结果一致

## 配置方法

### 方式一：环境变量（推荐）

在后端项目根目录创建 `.env` 文件：

```bash
# 选择 AI 服务：openai, gemini, 或留空使用备用模式
AI_SERVICE=openai

# OpenAI 配置
OPENAI_API_KEY=sk-your-openai-api-key-here

# 或者使用 Gemini
# AI_SERVICE=gemini
# GEMINI_API_KEY=your-gemini-api-key-here
```

### 方式二：系统环境变量

Windows:
```powershell
$env:AI_SERVICE="openai"
$env:OPENAI_API_KEY="sk-your-api-key"
```

Linux/Mac:
```bash
export AI_SERVICE=openai
export OPENAI_API_KEY=sk-your-api-key
```

## 获取 API Key

### OpenAI API Key
1. 访问 https://platform.openai.com/api-keys
2. 登录您的 OpenAI 账号
3. 点击 "Create new secret key"
4. 复制生成的 API Key

**注意**：
- ChatGPT Plus 订阅 ≠ API 访问权限
- API 需要单独付费，按使用量计费
- 首次使用可能有免费额度

### Google Gemini API Key
1. 访问 https://makersuite.google.com/app/apikey
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制生成的 API Key

**优势**：
- 免费额度更多
- 响应速度快
- 支持中文效果好

## 使用说明

### 无需配置
如果不配置任何 API Key，系统会自动使用备用签文数据，包含：
- 10 首精选签诗
- 10 条详细解签
- 5 组运势指引
- 根据签号（1-100）确定性生成

### 配置 AI 后
- 每次抽签都会调用 AI 实时生成独特的签文
- 签诗、解签、指引都是 AI 原创
- 更加个性化和多样化
- 每支签的内容都不同

## 成本估算

### OpenAI GPT-3.5-turbo
- 每次生成约 500-800 tokens
- 成本约 $0.001-0.002 每次
- 1000 次抽签约 $1-2

### Google Gemini Pro
- 免费额度：每分钟 60 次请求
- 超出后按量计费
- 成本比 OpenAI 更低

## 故障处理

系统具有完善的容错机制：

1. **API 调用失败** → 自动使用备用签文
2. **网络超时** → 30秒超时后返回备用数据
3. **API Key 无效** → 提示错误并使用备用数据
4. **JSON 解析失败** → 使用备用签文

用户体验不受影响，始终能获得签文。

## 测试

启动后端服务后，可以测试 API：

```bash
curl -X POST http://localhost:5000/api/fortune/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"fortuneNumber": 1}'
```

## 建议

### 开发环境
- 使用备用模式，无需配置
- 快速开发和测试

### 生产环境
- 配置 Gemini API（免费额度大）
- 或配置 OpenAI API（质量更稳定）
- 设置合理的请求限流

### 个人使用
- 如果抽签频率低，使用备用模式即可
- 如果想要更多样化的签文，配置 Gemini（免费）

## 安全提示

- 不要将 API Key 提交到 Git 仓库
- `.env` 文件已在 `.gitignore` 中
- 定期轮换 API Key
- 监控 API 使用量，避免滥用
