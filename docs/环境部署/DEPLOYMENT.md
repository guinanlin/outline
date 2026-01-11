# Outline 生产环境部署指南

本文档详细说明如何使用 Docker 在生产环境中部署 Outline。

## 目录

- [前置要求](#前置要求)
- [部署架构](#部署架构)
- [第一步：构建 Docker 镜像](#第一步构建-docker-镜像)
- [第二步：配置环境变量](#第二步配置环境变量)
- [第三步：部署服务](#第三步部署服务)
- [验证部署](#验证部署)
- [常见问题排查](#常见问题排查)
- [维护和更新](#维护和更新)

## 前置要求

### 系统要求

- **操作系统**: Linux (推荐 Ubuntu 20.04+ 或 CentOS 7+)
- **Docker**: 20.10+
- **Docker Compose**: 1.29+
- **内存**: 至少 8GB RAM (构建镜像时建议 16GB+)
- **磁盘空间**: 至少 20GB 可用空间
- **网络**: 能够访问外网下载依赖

### 必需软件

```bash
# 检查 Docker 版本
docker --version

# 检查 Docker Compose 版本
docker-compose --version

# 如果没有安装，请参考官方文档安装
```

### 端口要求

确保以下端口可用：

- `3300`: Outline 应用端口
- `5432`: PostgreSQL 数据库（仅内部使用）
- `6379`: Redis 缓存（仅内部使用）

## 部署架构

Outline 采用微服务架构，包含以下组件：

```
┌─────────────────┐
│   Outline App   │  (Web + WebSocket + Collaboration + Worker)
│   Port: 3300    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Postgres│ │ Redis │
│ :5432  │ │ :6379 │
└────────┘ └───────┘
```

## 第一步：构建 Docker 镜像

Outline 使用**多阶段构建**，需要分两步构建镜像。

### 步骤 1.1：构建基础镜像

基础镜像包含依赖安装、代码编译和构建过程。

```bash
# 在项目根目录执行
docker build \
  -f Dockerfile.base \
  -t outline-base:latest \
  --build-arg APP_PATH=/opt/outline \
  --build-arg CDN_URL=https://your-cdn-domain.com/static \
  .
```

**说明**:

- `-f Dockerfile.base`: 指定基础镜像 Dockerfile
- `-t outline-base:latest`: 镜像名称和标签
- `--build-arg APP_PATH=/opt/outline`: 应用路径（默认值）
- `--build-arg CDN_URL=...`: CDN URL（可选，如果不使用 CDN 可省略此参数）
- `.`: 构建上下文（当前目录）

**构建内容**:

- 安装系统依赖（cmake）
- 安装 Node.js 依赖（`yarn install`）
- 编译前端代码（Vite 构建）
- 编译后端代码（Babel 转译）
- 只保留生产依赖

**预计时间**: 10-30 分钟（取决于网络和机器性能）

**内存要求**: 建议至少 8GB 可用内存（构建过程需要大量内存）

### 步骤 1.2：构建最终运行镜像

最终镜像基于基础镜像，包含运行环境和配置。

```bash
# 在项目根目录执行
docker build \
  -f Dockerfile \
  -t outline:latest \
  --build-arg BASE_IMAGE=outline-base:latest \
  --build-arg APP_PATH=/opt/outline \
  .
```

**说明**:

- `-f Dockerfile`: 指定最终镜像 Dockerfile
- `-t outline:latest`: 最终镜像名称和标签
- `--build-arg BASE_IMAGE=outline-base:latest`: **必须与步骤 1.1 的镜像名称一致**
- `--build-arg APP_PATH=/opt/outline`: 应用路径（默认值）
- `.`: 构建上下文（当前目录）

**构建内容**:

- 从基础镜像复制构建产物
- 安装运行时工具（wget，用于健康检查）
- 创建非 root 用户（安全最佳实践）
- 设置文件存储目录权限
- 配置健康检查
- 设置启动命令

**预计时间**: 2-5 分钟

### 验证镜像构建

```bash
# 查看构建好的镜像
docker images | grep outline

# 应该看到两个镜像：
# outline:latest          (最终运行镜像，约 1GB)
# outline-base:latest     (基础构建镜像，约 2.3GB)
```

## 第二步：配置环境变量

### 2.1 创建 .env 文件

在项目根目录创建 `.env` 文件（与 `docker-compose.production.yml` 同级）：

```bash
# 创建 .env 文件
touch .env

# 编辑文件
vim .env  # 或使用其他编辑器
```

### 2.2 环境变量配置模板

```bash
# ===== 核心配置（必需）=====

# SECRET_KEY: 用于数据加密，一旦设置不要更改，否则用户无法登录
# 生成命令: openssl rand -hex 32
SECRET_KEY=your-64-character-hexadecimal-secret-key-here

# UTILS_SECRET: 用于 cron 任务触发
# 生成命令: openssl rand -hex 16
UTILS_SECRET=your-32-character-secret-key-here

# URL: Outline 访问地址，必须包含协议（https://）
URL=https://your-domain.com

# ===== 数据库配置（必需）=====

DB_USER=outline
DB_PASSWORD=your-secure-database-password-here
DB_NAME=outline

# ===== OAuth 认证配置（至少配置一个）=====

# Google OAuth（推荐）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 或者使用 Slack OAuth（可选）
# SLACK_CLIENT_ID=your-slack-client-id
# SLACK_CLIENT_SECRET=your-slack-client-secret

# ===== 可选配置 =====

# 邮件服务配置（用于发送通知邮件）
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM_EMAIL=noreply@your-domain.com

# CDN 配置（如果使用 CDN 加速静态资源）
# CDN_URL=https://cdn.your-domain.com/static

# 端口配置（默认 3300）
# PORT=3300

# HTTPS 强制跳转（生产环境建议开启）
# FORCE_HTTPS=true

# 进程并发数（建议设置为 CPU 核心数）
# WEB_CONCURRENCY=4
```

### 2.3 快速生成密钥

```bash
# 生成 SECRET_KEY（64 位十六进制）
openssl rand -hex 32

# 生成 UTILS_SECRET（32 位十六进制）
openssl rand -hex 16

# 将生成的密钥复制到 .env 文件中
```

### 2.4 最小配置示例

如果只想快速测试，最少需要以下配置：

```bash
SECRET_KEY=$(openssl rand -hex 32)
UTILS_SECRET=$(openssl rand -hex 16)
URL=https://outline.example.com
DB_USER=outline
DB_PASSWORD=SecurePassword123!
DB_NAME=outline
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## 第三步：部署服务

### 3.1 修改 docker-compose.production.yml

确保 `docker-compose.production.yml` 中的镜像名称使用本地构建的镜像：

```yaml
services:
  outline:
    image: outline:latest  # 使用本地构建的镜像
    # ... 其他配置
```

**重要**: 将 `image: outlinewiki/outline:latest` 改为 `image: outline:latest`

### 3.2 启动服务

```bash
# 在项目根目录执行

# 1. 启动所有服务（后台运行）
docker compose -f docker-compose.production.yml up -d

# 2. 查看服务状态
docker compose -f docker-compose.production.yml ps

# 应该看到 3 个服务都是 "Up" 状态：
# - outline (Outline 应用)
# - outline-postgres (PostgreSQL 数据库)
# - outline-redis (Redis 缓存)
```

### 3.3 等待服务就绪

```bash
# 等待数据库和 Redis 完全启动（约 10-30 秒）
sleep 30

# 检查数据库健康状态
docker-compose -f docker-compose.production.yml exec postgres pg_isready -U outline

# 检查 Redis 健康状态
docker-compose -f docker-compose.production.yml exec redis redis-cli ping
```

### 3.4 运行数据库迁移

**首次部署必须执行此步骤**：

```bash
# 运行数据库迁移
docker-compose -f docker-compose.production.yml exec outline yarn db:migrate

# 如果迁移成功，会看到类似输出：
# Loaded configuration file "config/database.js".
# Using environment "production".
# [timestamp] [name] migrated
```

**注意**:

- 数据库迁移会创建必要的表结构
- 如果迁移失败，检查数据库连接配置
- 迁移是幂等的，可以安全地重复执行

### 3.5 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.production.yml logs

# 查看 Outline 应用日志（实时）
docker-compose -f docker-compose.production.yml logs -f outline

# 查看最后 100 行日志
docker-compose -f docker-compose.production.yml logs --tail=100 outline
```

## 验证部署

### 健康检查

```bash
# 检查健康端点
curl http://localhost:3300/_health

# 应该返回: OK
```

### 验证服务状态

```bash
# 检查所有容器状态
docker-compose -f docker-compose.production.yml ps

# 检查容器资源使用
docker stats outline outline-postgres outline-redis

# 检查网络连接
docker network ls | grep outline
```

### 访问应用

在浏览器中访问配置的 URL（例如 `https://your-domain.com`）。

如果使用本地测试，访问 `http://localhost:3300`。

## 常见问题排查

### 问题 1: 容器启动失败

**症状**: 容器状态为 `Exited` 或 `Restarting`

**排查步骤**:

```bash
# 1. 查看详细错误日志
docker-compose -f docker-compose.production.yml logs outline

# 2. 检查环境变量是否正确配置
docker-compose -f docker-compose.production.yml exec outline env | grep -E "(SECRET|DATABASE|URL)"

# 3. 检查镜像是否存在
docker images | grep outline

# 4. 检查端口是否被占用
netstat -tulpn | grep 3300
```

**常见原因**:

- 环境变量缺失或格式错误
- 镜像名称不匹配
- 端口被占用
- 内存不足

### 问题 2: 数据库连接失败

**症状**: 日志中出现 `ECONNREFUSED` 或 `authentication failed`

**排查步骤**:

```bash
# 1. 检查数据库容器状态
docker-compose -f docker-compose.production.yml ps postgres

# 2. 查看数据库日志
docker-compose -f docker-compose.production.yml logs postgres

# 3. 手动测试数据库连接
docker-compose -f docker-compose.production.yml exec outline \
  node -e "require('./build/server/storage/database').sequelize.authenticate().then(() => console.log('OK')).catch(console.error)"

# 4. 检查 .env 中的数据库配置
cat .env | grep -E "(DB_|DATABASE_)"
```

**常见原因**:

- 数据库密码错误
- 数据库用户名错误
- 数据库容器未启动
- 网络连接问题

### 问题 3: Redis 连接失败

**症状**: 日志中出现 Redis 连接错误

**排查步骤**:

```bash
# 1. 检查 Redis 容器状态
docker-compose -f docker-compose.production.yml ps redis

# 2. 测试 Redis 连接
docker-compose -f docker-compose.production.yml exec redis redis-cli ping

# 3. 查看 Redis 日志
docker-compose -f docker-compose.production.yml logs redis
```

### 问题 4: 健康检查失败

**症状**: `curl http://localhost:3300/_health` 返回错误

**排查步骤**:

```bash
# 1. 检查容器是否运行
docker ps | grep outline

# 2. 进入容器检查
docker-compose -f docker-compose.production.yml exec outline sh

# 3. 在容器内手动测试健康端点
wget -qO- http://localhost:3300/_health

# 4. 检查应用日志
docker-compose -f docker-compose.production.yml logs outline | tail -50
```

### 问题 5: 内存不足

**症状**: 构建镜像时失败，错误信息包含 `ENOMEM` 或 `out of memory`

**解决方案**:

```bash
# 1. 增加 Docker 可用内存
# 编辑 /etc/docker/daemon.json
{
  "default-ulimits": {
    "memlock": {
      "hard": -1,
      "soft": -1
    }
  }
}

# 重启 Docker
sudo systemctl restart docker

# 2. 使用构建缓存（如果内存足够）
docker build --cache-from outline-base:latest ...

# 3. 减少并发构建
export NODE_OPTIONS="--max-old-space-size=8192"
```

## 维护和更新

### 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
# 步骤 1: 构建基础镜像
docker build -f Dockerfile.base -t outline-base:latest .

# 步骤 2: 构建最终镜像
docker build -f Dockerfile -t outline:latest --build-arg BASE_IMAGE=outline-base:latest .

# 3. 停止旧容器
docker-compose -f docker-compose.production.yml down

# 4. 启动新容器
docker-compose -f docker-compose.production.yml up -d

# 5. 运行数据库迁移（如果有新迁移）
docker-compose -f docker-compose.production.yml exec outline yarn db:migrate

# 6. 验证更新
curl http://localhost:3300/_health
```

### 重启服务

#### 重启所有服务

```bash
# 方式 1: 使用 restart 命令（推荐，快速重启）
docker compose -f docker-compose.production.yml restart

# 方式 2: 先停止再启动（完全重启，会重新创建容器）
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

#### 重启单个服务

```bash
# 重启 Outline 应用
docker compose -f docker-compose.production.yml restart outline

# 重启 PostgreSQL 数据库
docker compose -f docker-compose.production.yml restart postgres

# 重启 Redis 缓存
docker compose -f docker-compose.production.yml restart redis
```

#### 重启并查看日志

```bash
# 重启并实时查看日志
docker compose -f docker-compose.production.yml restart outline
docker compose -f docker-compose.production.yml logs -f outline
```

#### 优雅重启（零停机时间）

如果需要在不中断服务的情况下重启，可以使用滚动重启：

```bash
# 1. 启动新容器实例（使用不同的名称）
docker compose -f docker-compose.production.yml up -d --scale outline=2

# 2. 等待新实例就绪
sleep 10
curl http://localhost:3300/_health

# 3. 停止旧容器实例
docker compose -f docker-compose.production.yml up -d --scale outline=1
```

**注意**:

- `restart` 命令会快速重启容器，但不会重新创建容器
- `down` + `up` 会完全重新创建容器，适合配置变更后的重启
- 重启数据库和 Redis 可能会导致短暂的服务中断，建议在维护窗口期进行

### 备份数据

```bash
# 1. 备份数据库
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U outline outline > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 备份文件存储
docker run --rm -v outline_outline-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/outline-data-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 3. 备份 Redis（如果需要）
docker-compose -f docker-compose.production.yml exec redis \
  redis-cli BGSAVE
```

### 恢复数据

```bash
# 1. 恢复数据库
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U outline outline < backup_20240101_120000.sql

# 2. 恢复文件存储
docker run --rm -v outline_outline-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/outline-data-backup-20240101_120000.tar.gz -C /data
```

### 清理资源

```bash
# 清理未使用的镜像（谨慎使用）
docker image prune -a

# 清理未使用的卷（谨慎使用，会删除数据）
docker volume prune

# 清理构建缓存
docker builder prune
```

### 日志管理

```bash
# 查看最近 100 行日志
docker-compose -f docker-compose.production.yml logs --tail=100

# 导出日志到文件
docker-compose -f docker-compose.production.yml logs > outline-logs-$(date +%Y%m%d).log

# 清理旧日志（Docker Compose 会自动管理日志大小）
docker system prune --volumes
```

## 生产环境最佳实践

### 1. 安全建议

- ✅ 使用 HTTPS（配置 `FORCE_HTTPS=true`）
- ✅ 定期更新密钥和密码
- ✅ 使用强密码（数据库、Redis）
- ✅ 限制网络访问（使用防火墙）
- ✅ 定期备份数据
- ✅ 监控日志和安全事件

### 2. 性能优化

- 根据 CPU 核心数设置 `WEB_CONCURRENCY`
- 使用 CDN 加速静态资源（配置 `CDN_URL`）
- 配置数据库连接池
- 使用 Redis 缓存
- 定期清理日志和临时文件

### 3. 监控建议

- 监控容器资源使用（CPU、内存、磁盘）
- 监控数据库连接数
- 监控 API 响应时间
- 设置健康检查告警
- 定期检查日志错误

### 4. 扩展部署

如果需要更大的规模，可以考虑：

- **独立服务部署**: 将 Web、Worker、Collaboration 分离到不同容器
- **数据库主从**: 配置数据库读写分离
- **Redis 集群**: 使用 Redis Cluster
- **负载均衡**: 使用 Nginx 或 Traefik 作为反向代理
- **容器编排**: 使用 Kubernetes 或 Docker Swarm

详细的多服务部署方案请参考 [SERVICES.md](./SERVICES.md)。

## 相关文档

- [架构文档](./ARCHITECTURE.md) - 了解项目架构
- [服务文档](./SERVICES.md) - 了解后端服务结构
- [安全文档](./SECURITY.md) - 安全最佳实践

## 获取帮助

如果遇到问题，请：

1. 查看本文档的 [常见问题排查](#常见问题排查) 部分
2. 查看项目的 [GitHub Issues](https://github.com/outline/outline/issues)
3. 参考官方文档: https://docs.getoutline.com/s/hosting/

---

**最后更新**: 2024年
