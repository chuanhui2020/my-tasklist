# 服务器资源监控指南（1C2G）

## 🎯 快速监控命令

### 最简单：Docker 自带监控

```bash
# 实时查看所有容器资源
docker stats

# 查看一次后退出
docker stats --no-stream

# 只看 tasklist 相关容器
docker stats tasklist-db tasklist-backend tasklist-frontend
```

---

## 📊 详细监控方法

### 1. 使用 Docker Stats（推荐）

```bash
# 实时监控（Ctrl+C 退出）
docker stats

# 自定义格式（更简洁）
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 输出示例：
# NAME                CPU %   MEM USAGE / LIMIT   MEM %
# tasklist-db         2.5%    350MiB / 512MiB     68.36%
# tasklist-backend    5.0%    180MiB / 384MiB     46.88%
# tasklist-frontend   0.1%    15MiB / 128MiB      11.72%
```

### 2. 使用系统监控工具

#### htop（推荐，交互式）

```bash
# 安装（Ubuntu/Debian）
sudo apt update && sudo apt install htop -y

# 运行
htop

# 快捷键：
# F6  - 排序方式（选择 CPU% 或 MEM%）
# F9  - 杀进程
# /   - 搜索进程（输入 docker 或 mysql）
# q   - 退出
```

#### top（系统自带）

```bash
top

# 快捷键：
# Shift + M  - 按内存排序
# Shift + P  - 按 CPU 排序
# c          - 显示完整命令
# q          - 退出
```

### 3. 查看系统整体资源

```bash
# 内存使用
free -h

# 输出：
#               total   used    free    shared  buff/cache  available
# Mem:          2.0Gi   1.5Gi   200Mi   50Mi    300Mi       400Mi

# CPU 使用
uptime
# 输出：load average: 0.50, 0.40, 0.35  (1分钟/5分钟/15分钟平均负载)

# 磁盘使用
df -h

# Docker 磁盘占用
docker system df
```

---

## 🛠️ 使用监控脚本

我已经为你创建了 `monitor.sh` 脚本：

```bash
# 查看一次
./monitor.sh

# 每 5 秒刷新一次
watch -n 5 ./monitor.sh

# 每 10 秒刷新一次
watch -n 10 ./monitor.sh
```

---

## 📈 资源使用预期（1C2G 服务器）

### 正常情况下的资源占用

| 容器 | CPU | 内存 | 说明 |
|------|-----|------|------|
| **MySQL (db)** | 2-5% | 300-400MB | 数据库最占内存 |
| **Backend (Flask)** | 3-8% | 150-250MB | AI 功能调用时会飙升 |
| **Frontend (Nginx)** | 0.1-1% | 10-30MB | 静态文件服务，占用最小 |
| **系统预留** | - | ~300MB | 操作系统和 Docker 本身 |

**总计：** 约 1.2-1.5GB 内存，10-20% CPU（空闲时）

### 资源限制配置（已添加）

我已经在 `docker-compose.yml` 中添加了资源限制：

| 容器 | CPU 限制 | 内存限制 | 说明 |
|------|---------|---------|------|
| **db** | 50% (0.5核) | 512MB | 防止数据库占满内存 |
| **backend** | 30% (0.3核) | 384MB | 预留 AI 功能峰值 |
| **frontend** | 20% (0.2核) | 128MB | Nginx 占用很少 |

**总限制：** 1C 100% + 1024MB = 正好适合 1C2G 服务器

---

## ⚠️ 告警阈值

### 需要关注的指标

| 指标 | 正常 | 警告 | 危险 |
|------|------|------|------|
| **总内存使用** | <70% (1.4GB) | 70-85% | >85% |
| **CPU 平均负载** | <0.7 | 0.7-1.0 | >1.0 |
| **单容器内存** | 限制内的 | 达到限制 | OOM 杀死 |
| **磁盘使用** | <80% | 80-90% | >90% |

### 检查命令

```bash
# 快速检查是否有容器被杀死（OOM）
docker ps -a --filter status=exited

# 查看容器日志（如果有问题）
docker logs tasklist-backend --tail 100
docker logs tasklist-db --tail 100

# 查看系统内存压力
dmesg | grep -i "out of memory"
```

---

## 🔧 性能优化建议（1C2G）

### 1. 减少 MySQL 内存占用

创建 `mysql.cnf`：

```ini
[mysqld]
# 1C2G 服务器优化配置
performance_schema = OFF
max_connections = 20                    # 减少最大连接数
innodb_buffer_pool_size = 256M         # 减少缓冲池
innodb_log_file_size = 32M             # 减少日志文件
innodb_log_buffer_size = 8M            # 减少日志缓冲
query_cache_size = 0                   # 关闭查询缓存（MySQL 8.0 已废弃）
table_open_cache = 200                 # 减少表缓存
```

在 `docker-compose.yml` 中挂载：

```yaml
services:
  db:
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql.cnf:/etc/mysql/conf.d/custom.cnf:ro  # 添加这行
```

### 2. 减少 Gunicorn Workers

编辑 `Dockerfile.backend`，修改启动命令：

```dockerfile
# 将 --workers 2 改为 --workers 1
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", ...]
```

### 3. 启用 Swap（应急）

如果内存经常不够：

```bash
# 创建 1GB swap 文件
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 查看 swap
free -h
```

---

## 📱 轻量级可视化工具

### 选项 1: ctop（推荐）

```bash
# 安装
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop

# 运行
ctop
```

**界面示例：**
```
ctop - 19:30:45 CST  3 containers

NAME               CID        CPU        MEM        NET RX/TX    IO R/W      PIDS
tasklist-db        abc123     2.5%       350M/512M  1.2K/500B    10M/5M      50
tasklist-backend   def456     5.0%       180M/384M  500K/200K    2M/1M       5
tasklist-frontend  ghi789     0.1%       15M/128M   100B/50B     100K/50K    2

[h] help  [s] sort  [f] filter  [q] quit
```

### 选项 2: lazydocker（功能最全）

```bash
# 安装
curl https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash

# 运行
lazydocker
```

---

## 🚨 故障排查

### 问题1：内存不足，容器被杀死

**症状：** 容器频繁重启，`docker ps` 显示容器刚启动

```bash
# 1. 查看被杀死的容器
docker ps -a --filter status=exited

# 2. 查看系统日志
dmesg | grep -i "killed process"
sudo journalctl -u docker --since "1 hour ago" | grep -i oom

# 3. 减少资源限制或添加 swap
```

### 问题2：CPU 100%

**症状：** 系统卡顿，`top` 显示 CPU 100%

```bash
# 1. 查看哪个容器占用高
docker stats --no-stream | sort -k3 -h

# 2. 查看容器内进程
docker top tasklist-backend

# 3. 查看日志是否有异常
docker logs tasklist-backend --tail 100
```

### 问题3：磁盘满

```bash
# 查看磁盘使用
df -h

# 清理 Docker 未使用资源
docker system prune -a --volumes

# 查看各容器磁盘占用
docker system df -v
```

---

## 📊 监控命令速查表

| 目的 | 命令 |
|------|------|
| **实时容器监控** | `docker stats` |
| **系统整体监控** | `htop` 或 `top` |
| **内存使用** | `free -h` |
| **磁盘使用** | `df -h` |
| **容器日志** | `docker logs <container>` |
| **容器进程** | `docker top <container>` |
| **清理资源** | `docker system prune -a` |
| **查看限制** | `docker inspect <container> \| grep -A 10 Resources` |

---

## 🎯 推荐监控方案（按优先级）

### 日常监控

1. ✅ **每天检查一次**
   ```bash
   ./monitor.sh
   ```

2. ✅ **遇到问题时**
   ```bash
   docker stats --no-stream
   docker logs tasklist-backend --tail 50
   ```

### 持续监控（可选）

3. ⭐ **使用 ctop**（最佳体验）
   ```bash
   ctop
   ```

4. 🔧 **定时检查脚本**（每小时检查）
   ```bash
   # 添加到 crontab
   0 * * * * /path/to/monitor.sh >> /var/log/tasklist-monitor.log
   ```

---

## 💡 优化后的预期

应用资源限制后：

- ✅ **内存使用稳定在 1.2-1.5GB**
- ✅ **CPU 空闲时 <20%**
- ✅ **不会出现 OOM（内存溢出）**
- ✅ **响应速度正常**

如果仍然内存不足，考虑：
1. 添加 Swap
2. 升级到 2C4G 服务器
3. 将数据库分离到单独服务器
