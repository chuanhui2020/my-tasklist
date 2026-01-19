# 项目文件清单

## 新增 Docker 配置文件

```
my-tasklist/
├── Dockerfile.backend          # 后端 Docker 镜像配置
├── Dockerfile.frontend         # 前端 Docker 镜像配置（多阶段构建）
├── docker-compose.yml          # Docker Compose 服务编排
├── nginx.conf                  # Nginx 反向代理配置
├── .dockerignore              # Docker 构建忽略文件
├── .env.example               # 环境变量模板
├── docker-start.sh            # 一键启动脚本
├── DOCKER_README.md           # Docker 快速参考
├── DOCKER_DEPLOY.md           # Docker 详细部署文档
└── DOCKER_MIGRATION.md        # 迁移完成总结
```

## 修改的文件

```
backend/config.py              # 移除硬编码，使用环境变量
frontend/vite.config.js        # 移除硬编码 IP，使用环境变量
CLAUDE.md                      # 新增 Docker 部署章节
```

## 项目结构（完整）

```
my-tasklist/
├── backend/                   # 后端 Flask 应用
│   ├── app.py
│   ├── config.py             # ✨ 已移除硬编码
│   ├── models.py
│   ├── auth_utils.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── routes/
│       ├── auth_routes.py
│       ├── task_routes.py
│       ├── fortune_routes.py
│       └── bmi_routes.py
│
├── frontend/                  # 前端 Vue 应用
│   ├── src/
│   │   ├── api/
│   │   ├── views/
│   │   ├── components/
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── router.js
│   ├── package.json
│   ├── vite.config.js        # ✨ 已移除硬编码
│   └── index.html
│
├── deploy/                    # 传统部署脚本（保留）
│   ├── deploy.sh
│   ├── nginx-tasklist.conf
│   └── ...
│
├── Dockerfile.backend         # ✨ 新增
├── Dockerfile.frontend        # ✨ 新增
├── docker-compose.yml         # ✨ 新增
├── nginx.conf                 # ✨ 新增
├── .dockerignore             # ✨ 新增
├── .env.example              # ✨ 新增
├── docker-start.sh           # ✨ 新增
│
├── DOCKER_README.md          # ✨ 新增
├── DOCKER_DEPLOY.md          # ✨ 新增
├── DOCKER_MIGRATION.md       # ✨ 新增
├── CLAUDE.md                 # ✨ 已更新
│
├── database.sql
├── README.md
├── start.sh                  # 传统启动脚本（保留）
└── stop.sh                   # 传统停止脚本（保留）
```
