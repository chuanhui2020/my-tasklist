# 个人任务管理系统

一个基于 Flask + Vue 3 + MySQL 的个人任务管理Web应用，支持任务的增删改查、状态管理、截止日期设置等功能。

## 技术栈

### 后端
- Python 3.8+
- Flask 2.3+
- Flask-SQLAlchemy (数据库ORM)
- Flask-CORS (跨域支持)
- PyMySQL (MySQL连接器)

### 前端
- Vue 3
- Vue Router 4
- Axios (HTTP客户端)
- Element Plus (UI组件库)
- Vite (构建工具)

### 数据库
- MySQL 8.0+

## 项目结构

```
my-tasklist/
├── backend/                 # 后端Flask应用
│   ├── app.py              # Flask应用入口
│   ├── config.py           # 配置文件
│   ├── models.py           # 数据库模型
│   ├── requirements.txt    # Python依赖
│   └── routes/
│       └── task_routes.py  # 任务路由
├── frontend/               # 前端Vue应用
│   ├── src/
│   │   ├── api/            # API调用封装
│   │   ├── components/     # Vue组件
│   │   ├── views/          # 页面组件
│   │   ├── App.vue         # 根组件
│   │   ├── main.js         # 应用入口
│   │   └── router.js       # 路由配置
│   ├── package.json        # 前端依赖
│   ├── vite.config.js      # Vite配置
│   └── index.html          # HTML模板
├── database.sql            # 数据库初始化脚本
└── README.md              # 项目说明
```

## 功能特性

### 任务管理
- ✅ 新建任务（标题必填，描述和截止日期可选）
- ✅ 查看任务列表（支持状态筛选和排序）
- ✅ 编辑任务信息
- ✅ 标记任务完成/未完成
- ✅ 删除任务

### 展示功能
- ✅ 按截止日期或创建时间排序
- ✅ 任务状态可视化区分
- ✅ 过期任务提醒
- ✅ 今日任务首页展示
- ✅ 响应式设计

### API接口
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取单个任务
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `PATCH /api/tasks/:id/status` - 更新任务状态
- `DELETE /api/tasks/:id` - 删除任务

## 安装部署

### 1. 数据库准备

创建MySQL数据库并执行初始化脚本：

```bash
mysql -u root -p
CREATE DATABASE tasklist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tasklist_db;
SOURCE database.sql;
```

### 2. 后端部署

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库连接（修改config.py中的数据库URL）
# 默认: mysql+pymysql://root:password@localhost/tasklist_db

# 启动Flask应用
python app.py
```

后端服务将在 `http://localhost:5000` 启动

### 3. 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端应用将在 `http://localhost:3000` 启动

### 4. 生产部署

#### 前端构建
```bash
cd frontend
npm run build
```

#### 后端生产配置
- 修改`config.py`中的SECRET_KEY
- 设置合适的数据库连接URL
- 使用WSGI服务器（如Gunicorn）部署

## 使用说明

### 首页
- 显示今日任务清单
- 按截止日期升序排列
- 快速操作：完成/编辑/删除任务

### 任务管理页面
- 支持按状态筛选（全部/待完成/已完成）
- 支持按日期排序（截止日期/创建时间）
- 卡片式展示，支持批量操作

### 任务操作
- **新建任务**: 点击"新建任务"按钮，填写表单
- **编辑任务**: 点击任务卡片中的"编辑"按钮
- **状态切换**: 点击"标记完成"/"标记未完成"按钮
- **删除任务**: 点击"删除"按钮，需确认操作

## 数据库设计

### tasks表结构
```sql
id          INT AUTO_INCREMENT PRIMARY KEY  # 任务ID
title       VARCHAR(255) NOT NULL           # 任务标题
description TEXT                            # 任务描述
status      ENUM('pending','done')          # 任务状态
due_date    DATE NULL                       # 截止日期
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP  # 创建时间
```

## 开发说明

### 后端开发
- 使用Flask-SQLAlchemy进行数据库操作
- API遵循RESTful设计原则
- 支持CORS跨域请求
- 包含完整的错误处理

### 前端开发
- 使用Vue 3 Composition API
- Element Plus提供UI组件
- Axios封装API调用
- 响应式设计适配移动端

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。