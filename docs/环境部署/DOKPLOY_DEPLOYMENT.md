# Outline 通过 Dokploy 部署指南

本文档详细说明如何使用 Dokploy 部署 Outline 应用。

## 目录

- [前置要求](#前置要求)
- [第一步：准备镜像](#第一步准备镜像)
- [第二步：在 Dokploy 中创建应用](#第二步在-dokploy-中创建应用)
- [第三步：配置 Docker Compose](#第三步配置-docker-compose)
- [第四步：配置环境变量](#第四步配置环境变量)
- [第五步：配置持久化存储](#第五步配置持久化存储)
- [第六步：配置域名和 SSL](#第六步配置域名和-ssl)
- [第七步：部署和初始化](#第七步部署和初始化)
- [常见问题](#常见问题)

## 前置要求

### 系统要求

- **Dokploy 已安装并运行**
- **Docker 镜像已构建完成**（`outline:latest` 和 `outline-base:latest`）
- **域名**（可选，用于 HTTPS）

### 必需信息

在开始之前，请准备好以下信息：

1. **密钥**（使用以下命令生成）：
   ```bash
   # 生成 SECRET_KEY（64 位十六进制）
   openssl rand -hex 32
   
   # 生成 UTILS_SECRET（32 位十六进制）
   openssl rand -hex 16
   ```

2. **数据库密码**（强密码，至少 16 个字符）

3. **访问 URL**（例如：`https://outline.yourdomain.com`）

4. **OAuth 配置**（Google 或 Slack）

## 第一步：准备镜像

### 1.1 确保镜像已构建

```bash
# 检查镜像是否存在
docker images | grep outline

# 应该看到：
# outline:latest
# outline-base:latest
```

### 1.2 将镜像推送到 Dokploy 可访问的仓库（可选）

如果 Dokploy 运行在不同的服务器上，需要将镜像推送到 Docker Registry：

```bash
# 标记镜像
docker tag outline:latest your-registry.com/outline:latest

# 推送镜像
docker push your-registry.com/outline:latest
```

**注意**：如果 Dokploy 和构建镜像在同一台服务器上，可以跳过此步骤，直接使用本地镜像。

## 第二步：在 Dokploy 中创建应用

### 2.1 登录 Dokploy

1. 打开 Dokploy Web 界面
2. 使用管理员账号登录

### 2.2 创建新应用

1. 点击 **"Applications"** 或 **"应用"**
2. 点击 **"New Application"** 或 **"新建应用"**
3. 填写应用信息：
   - **Name**: `outline`（应用名称）
   - **Description**: `Outline Knowledge Base`（可选）
   - **Type**: 选择 **"Docker Compose"** 或 **"Compose"**

## 第三步：配置 Docker Compose

### 3.1 复制 Docker Compose 配置

在 Dokploy 的 Compose 编辑器中，粘贴以下配置：

```yaml
services:
  # Outline 应用
  outline:
    image: outline:latest  # 如果使用远程仓库，改为 your-registry.com/outline:latest
    container_name: outline
    restart: unless-stopped
    ports:
      - "3300:3300"
    environment:
      # 核心配置
      NODE_ENV: production
      SECRET_KEY: ${SECRET_KEY}
      UTILS_SECRET: ${UTILS_SECRET}
      URL: ${URL}
      
      # 数据库配置
      DATABASE_URL: ${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}}
      PGSSLMODE: ${PGSSLMODE:-disable}
      
      # Redis 配置
      REDIS_URL: redis://redis:6379
      
      # 文件存储
      FILE_STORAGE_LOCAL_ROOT_DIR: /var/lib/outline/data
      
      # 可选配置
      PORT: 3300
      FORCE_HTTPS: ${FORCE_HTTPS:-true}
      WEB_CONCURRENCY: ${WEB_CONCURRENCY:-4}
      
      # OAuth 配置（可选，可在管理界面配置）
      # GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      # GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      
    volumes:
      - outline-data:/var/lib/outline/data
    depends_on:
      - postgres
      - redis
    networks:
      - outline-network
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3300/_health"]
      interval: 1m
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: outline-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - outline-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: outline-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - outline-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  outline-data:
  postgres-data:
  redis-data:

networks:
  outline-network:
    driver: bridge
```

### 3.2 保存配置

点击 **"Save"** 或 **"保存"** 按钮保存 Compose 配置。

## 第四步：配置环境变量

### 4.1 打开环境变量配置

在 Dokploy 应用页面，找到 **"Environment Variables"** 或 **"环境变量"** 部分。

### 4.2 添加必需的环境变量

点击 **"Add Variable"** 或 **"添加变量"**，逐个添加以下变量：

#### 核心配置（必需）

```bash
# 密钥（使用之前生成的）
SECRET_KEY=your-64-character-hexadecimal-secret-key-here
UTILS_SECRET=your-32-character-secret-key-here

# 访问地址（必须包含协议）
URL=https://outline.yourdomain.com

# 如果使用 HTTP（仅测试）
# URL=http://your-server-ip:3300
```

#### 数据库配置（必需）

```bash
DB_USER=outline
DB_PASSWORD=your-secure-database-password-here
DB_NAME=outline
```

#### OAuth 认证配置（至少配置一个）

```bash
# Google OAuth（推荐）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# 或者使用 Slack OAuth
# SLACK_CLIENT_ID=your-slack-client-id
# SLACK_CLIENT_SECRET=your-slack-client-secret
```

#### 可选配置

```bash
# HTTPS 强制跳转（生产环境建议开启）
FORCE_HTTPS=true

# 进程并发数（建议设置为 CPU 核心数）
WEB_CONCURRENCY=4

# PostgreSQL SSL 模式（如果使用外部数据库）
# PGSSLMODE=require
```

### 4.3 环境变量配置示例

完整的 `.env` 文件示例：

```bash
# ===== 核心配置 =====
SECRET_KEY=abc123def456...（64位十六进制）
UTILS_SECRET=xyz789...（32位十六进制）
URL=https://outline.yourdomain.com

# ===== 数据库配置 =====
DB_USER=outline
DB_PASSWORD=SecurePassword123!
DB_NAME=outline

# ===== OAuth 配置 =====
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456

# ===== 可选配置 =====
FORCE_HTTPS=true
WEB_CONCURRENCY=4
```

## 第五步：配置持久化存储

### 5.1 检查卷配置

Dokploy 通常会自动识别 Docker Compose 中的 `volumes` 配置。确保以下卷已配置：

- `outline-data`: Outline 文件存储
- `postgres-data`: PostgreSQL 数据库数据
- `redis-data`: Redis 数据

### 5.2 验证存储路径

在 Dokploy 的存储或卷管理页面，确认这些卷已创建并映射到正确的路径。

## 第六步：配置域名和 SSL

### 6.1 配置反向代理（如果使用域名）

如果 Dokploy 支持反向代理配置：

1. 在应用设置中找到 **"Domains"** 或 **"域名"** 部分
2. 添加你的域名：`outline.yourdomain.com`
3. 配置 SSL 证书（Let's Encrypt 自动证书或自定义证书）
4. 设置反向代理到 `outline:3300`

### 6.2 手动配置 Nginx（如果 Dokploy 不支持）

如果需要手动配置 Nginx，添加以下配置：

```nginx
server {
    listen 80;
    server_name outline.yourdomain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name outline.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 第七步：部署和初始化

### 7.1 部署应用

1. 在 Dokploy 应用页面，点击 **"Deploy"** 或 **"部署"** 按钮
2. 等待所有容器启动（约 30-60 秒）
3. 检查容器状态，确保所有容器都是 **"Running"** 状态

### 7.2 运行数据库迁移

**首次部署必须执行此步骤**：

1. 在 Dokploy 中找到应用的 **"Terminal"** 或 **"终端"** 功能
2. 选择 `outline` 容器
3. 执行以下命令：

**重要说明**：
- 容器的工作目录默认是 `/opt/outline`（这是应用根目录）
- 直接执行命令即可，**不需要切换目录**
- 如果本地 PostgreSQL 不支持 SSL（默认情况），需要使用 `production-ssl-disabled` 环境

```bash
# 方法 1: 使用 npx sequelize（推荐，避免 Yarn 版本问题）
NODE_ENV=production-ssl-disabled npx sequelize db:migrate

# 方法 2: 使用 yarn（需要先启用 corepack）
# 如果遇到 Yarn 版本错误，先执行：
# corepack enable  （需要 root 权限，如果权限不足，使用: docker exec -u root outline corepack enable）
cd /opt/outline
NODE_ENV=production-ssl-disabled yarn db:migrate

# 验证当前目录（可选）
pwd
# 应该显示: /opt/outline
```

**关于 SSL 配置的说明**：
- 如果数据库支持 SSL（生产环境推荐），直接使用 `NODE_ENV=production`：
  ```bash
  npx sequelize db:migrate
  ```
- 如果数据库不支持 SSL（本地测试或 Docker 容器），使用 `NODE_ENV=production-ssl-disabled`：
  ```bash
  NODE_ENV=production-ssl-disabled npx sequelize db:migrate
  ```

如果迁移成功，会看到类似输出：
```
Loaded configuration file "server/config/database.js".
Using environment "production-ssl-disabled".
No migrations were executed, database schema was already up to date.
```
或
```
Loaded configuration file "server/config/database.js".
Using environment "production-ssl-disabled".
[timestamp] [name] migrated
```

### 7.3 验证部署

#### 检查健康状态

```bash
# 在 outline 容器终端中执行
wget -qO- http://localhost:3300/_health

# 应该返回: OK
```

#### 检查日志

在 Dokploy 中查看应用日志，确保没有错误：

1. 点击 **"Logs"** 或 **"日志"**
2. 选择 `outline` 容器
3. 检查是否有错误信息

#### 访问应用

在浏览器中访问配置的 URL：
- 如果配置了域名：`https://outline.yourdomain.com`
- 如果使用 IP：`http://your-server-ip:3300`

### 7.4 初始化管理员账号

首次访问时，Outline 会引导你完成初始化：

1. 选择认证方式（Google 或 Slack）
2. 使用 OAuth 登录
3. 创建第一个团队和工作区

## 常见问题

### 问题 1: 容器无法启动

**排查步骤**：

1. 检查环境变量是否正确配置
2. 查看容器日志：在 Dokploy 中查看 `outline` 容器的日志
3. 检查镜像是否存在：`docker images | grep outline`
4. 检查端口是否被占用

### 问题 2: 数据库连接失败

**症状**：日志中出现 `ECONNREFUSED` 或 `authentication failed`

**解决方案**：

1. 检查数据库容器是否运行：`docker ps | grep postgres`
2. 验证环境变量中的数据库配置：
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
3. 检查网络连接：确保 `outline` 容器可以访问 `postgres` 容器

### 问题 3: 健康检查失败

**症状**：容器状态显示为 `unhealthy`

**排查步骤**：

1. 检查应用是否正常启动：查看日志
2. 手动测试健康端点：
   ```bash
   docker exec outline wget -qO- http://localhost:3300/_health
   ```
3. 检查端口映射是否正确

### 问题 4: 无法访问应用

**排查步骤**：

1. 检查防火墙设置，确保端口 3300 已开放
2. 如果使用域名，检查 DNS 解析是否正确
3. 如果使用反向代理，检查代理配置
4. 检查 `URL` 环境变量是否正确

### 问题 5: 文件上传失败

**症状**：无法上传文件或图片

**解决方案**：

1. 检查 `outline-data` 卷是否正确挂载
2. 检查文件存储目录权限：
   ```bash
   docker exec outline ls -la /var/lib/outline/data
   ```
3. 确保目录有写权限

### 问题 6: OAuth 登录失败

**排查步骤**：

1. 检查 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 是否正确
2. 在 Google Cloud Console 中验证：
   - 重定向 URI 是否正确配置
   - OAuth 客户端密钥是否正确
3. 检查 `URL` 环境变量是否与 OAuth 配置中的重定向 URI 匹配

## 维护和更新

### 更新应用

1. **重新构建镜像**：
   ```bash
   # 构建新镜像
   docker build -f Dockerfile.base -t outline-base:latest .
   docker build -f Dockerfile -t outline:latest --build-arg BASE_IMAGE=outline-base:latest .
   ```

2. **在 Dokploy 中更新**：
   - 如果使用本地镜像，直接重新部署
   - 如果使用远程仓库，推送新镜像后重新部署

3. **运行数据库迁移**（如果有新迁移）：
   ```bash
   docker exec outline yarn db:migrate
   ```

### 备份数据

```bash
# 备份数据库
docker exec outline-postgres pg_dump -U outline outline > backup_$(date +%Y%m%d).sql

# 备份文件存储
docker run --rm -v outline_outline-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/outline-data-$(date +%Y%m%d).tar.gz -C /data .
```

### 查看日志

在 Dokploy 中：
1. 进入应用页面
2. 点击 **"Logs"** 或 **"日志"**
3. 选择要查看的容器

或使用命令行：
```bash
docker logs outline -f
docker logs outline-postgres -f
docker logs outline-redis -f
```

## 相关文档

- [生产环境部署指南](./DEPLOYMENT.md) - 详细的 Docker Compose 部署说明
- [架构文档](./ARCHITECTURE.md) - 了解项目架构
- [Dokploy 官方文档](https://dokploy.com/docs) - Dokploy 使用说明

---

**最后更新**: 2024年
