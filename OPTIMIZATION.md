# 任务列表优化计划

## 关键

### 1. 添加分页
- `task_routes.py` 的 `GET /tasks` 用 `.all()` 返回全部任务，需要加 limit/offset
- 前端 TaskList.vue 对应加载更多或分页组件

### 2. 添加复合索引
- `(user_id, status)` — 状态筛选
- `(user_id, due_date)` — 日期排序
- 在 `app.py` lifespan 中添加索引创建逻辑

### 3. 增删改后局部更新
- 当前每次操作后调用 `loadTasks()` 全量刷新
- 改为直接更新本地 tasks 数组（创建时 push、删除时 splice、更新时替换对应项）

## 中等

### 4. 虚拟滚动
- 任务多时只渲染可视区域内的 TaskCard
- 可用 `vue-virtual-scroller` 或自行实现

### 5. 请求防抖/取消
- 快速切换筛选条件时取消旧请求
- 用 axios CancelToken 或 AbortController

### 6. 缓存优化
- taskCache 加 TTL 过期时间
- 处理多标签页并发更新场景
