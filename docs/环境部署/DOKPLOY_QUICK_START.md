# Dokploy 快速部署指南

## 快速步骤

### 1. 准备密钥

```bash
# 生成 SECRET_KEY
openssl rand -hex 32

# 生成 UTILS_SECRET
openssl rand -hex 16
```

### 2. 在 Dokploy 中创建应用

1. 登录 Dokploy
2. 创建新应用，类型选择 **"Docker Compose"**
3. 应用名称：`outline`

### 3. 粘贴 Docker Compose 配置

```yaml
services:
  outline:
    image: outline:latest
    container_name: outline
    restart: unless-stopped
    ports:
      - "3300:3300"
    environment:
      NODE_ENV: production
      SECRET_KEY: ${SECRET_KEY}
      UTILS_SECRET: ${UTILS_SECRET}
      URL: ${URL}
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      FILE_STORAGE_LOCAL_ROOT_DIR: /var/lib/outline/data
      PORT: 3300
      FORCE_HTTPS: ${FORCE_HTTPS:-true}
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

  redis:
    image: redis:7-alpine
    container_name: outline-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - outline-network

volumes:
  outline-data:
  postgres-data:
  redis-data:

networks:
  outline-network:
    driver: bridge
```

### 4. 配置环境变量

在 Dokploy 的环境变量部分添加：

```bash
# 必需变量
SECRET_KEY=你的64位密钥
UTILS_SECRET=你的32位密钥
URL=https://outline.yourdomain.com
DB_USER=outline
DB_PASSWORD=你的数据库密码
DB_NAME=outline

# OAuth（至少配置一个）
GOOGLE_CLIENT_ID=你的Google客户端ID
GOOGLE_CLIENT_SECRET=你的Google客户端密钥

# 可选
FORCE_HTTPS=true
WEB_CONCURRENCY=4
```

### 5. 部署

1. 点击 **"Deploy"** 部署应用
2. 等待容器启动（约 30-60 秒）

### 6. 运行数据库迁移

在 Dokploy 的终端中，选择 `outline` 容器，执行：

```bash
# 如果数据库不支持 SSL（默认 Docker 容器）
NODE_ENV=production-ssl-disabled npx sequelize db:migrate

# 如果数据库支持 SSL（生产环境推荐）
npx sequelize db:migrate
```

**注意**：如果使用 `yarn db:migrate` 遇到 Yarn 版本错误，使用 `npx sequelize` 命令代替。

### 7. 访问应用

在浏览器中访问配置的 URL 完成初始化。

## 故障排除

### 问题：访问应用时显示 "Sorry, part of the application failed to load"

这个问题通常由以下原因引起：

#### 原因 1：URL 环境变量与实际访问地址不匹配

**症状**：
- 日志显示服务已启动
- 访问 `https://localhost:3300` 时出现加载错误
- 浏览器控制台可能显示资源加载失败（404 或 CORS 错误）

**解决方法**：

1. **确保 URL 环境变量与实际访问地址一致**

   如果你通过 `https://localhost:3300` 访问，确保环境变量设置为：
   ```bash
   URL=https://localhost:3300
   ```

   如果你通过域名访问（例如 `https://outline.st.datangyuan.cn`），确保：
   ```bash
   URL=https://outline.st.datangyuan.cn
   ```

2. **检查浏览器控制台错误**

   打开浏览器开发者工具（F12），查看：
   - **Console** 标签：查看是否有 JavaScript 错误
   - **Network** 标签：查看哪些资源加载失败（通常是 `/static/` 下的 JS/CSS 文件）

3. **验证静态资源是否存在**

   在容器终端中执行：
   ```bash
   # 检查构建产物是否存在
   ls -la /app/app/.vite/manifest.json
   ls -la /app/app/assets/
   
   # 如果文件不存在，说明构建有问题
   ```

#### 原因 2：构建产物缺失

**症状**：
- 服务器日志中可能显示：`Can not find ./build/app/.vite/manifest.json`
- 静态资源文件（JS/CSS）返回 404

**解决方法**：

1. **检查 Docker 镜像构建过程**

   确保在构建镜像时执行了前端构建：
   ```bash
   yarn vite:build
   ```

2. **验证构建产物**

   在构建镜像的 Dockerfile 中应该包含：
   ```dockerfile
   RUN yarn vite:build
   ```

#### 原因 3：CDN_URL 配置问题

如果设置了 `CDN_URL` 但配置不正确，会导致资源加载失败。

**解决方法**：

1. **如果不使用 CDN**，不要设置 `CDN_URL` 环境变量，留空即可

2. **如果使用 CDN**，确保：
   - `CDN_URL` 指向正确的 CDN 地址
   - CDN 配置的源服务器指向你的 Outline 服务器

#### 快速诊断步骤

1. **检查环境变量**：
   ```bash
   # 在容器终端中
   echo $URL
   echo $CDN_URL
   ```

2. **测试静态资源访问**：
   ```bash
   # 在容器终端中
   curl http://localhost:3300/static/manifest.webmanifest
   ```

3. **检查浏览器控制台**：
   - 打开开发者工具（F12）
   - 查看 Network 标签中的失败请求
   - 查看 Console 标签中的错误信息

4. **查看服务器日志**：
   - 在 Dokploy 的日志查看器中
   - 查找与资源加载相关的错误或警告

### 其他常见问题

#### 数据库连接失败

如果看到数据库连接错误，检查：
- `DATABASE_URL` 是否正确
- 数据库容器是否正常运行：`docker ps | grep postgres`
- 网络连接：确保容器在同一网络中

#### SSL 证书问题

如果使用 HTTPS 但证书配置有问题：
- 临时禁用 HTTPS：设置 `FORCE_HTTPS=false`
- 确保反向代理（如 Nginx）正确配置 SSL 证书

### 问题：通过 frpc 代理转发无法访问

#### 原因 1：frpc 配置问题

**症状**：
- 本地 `https://localhost:3300` 可以正常访问
- 通过 `https://outline.st.datangyuan.cn` 访问失败
- frpc 日志可能显示连接错误

**解决方法**：

1. **修正 frpc 配置中的 localIP**

   ```ini
   [[proxies]]
   name = "outline.st.datangyuan.cn"
   type = "https"
   localIP = "127.0.0.1"  # 使用 127.0.0.1 而不是 localhost
   localPort = 3300
   customDomains = ["outline.st.datangyuan.cn"]
   ```

   **注意**：某些情况下，如果 frpc 和 Outline 在同一台机器上，`localhost` 可能无法解析。使用 `127.0.0.1` 更可靠。

2. **确保 frpc 转发正确的协议头**

   Outline 依赖 `X-Forwarded-Proto` 头来判断是否使用 HTTPS。确保 frpc 配置了正确的头部转发：

   ```ini
   [[proxies]]
   name = "outline.st.datangyuan.cn"
   type = "https"
   localIP = "127.0.0.1"
   localPort = 3300
   customDomains = ["outline.st.datangyuan.cn"]
   # 如果 frpc 支持，添加以下配置以确保协议头正确转发
   # headers = {"X-Forwarded-Proto": "https"}
   ```

3. **检查 Outline 环境变量**

   确保 `URL` 环境变量设置为通过 frpc 访问的域名：

   ```bash
   URL=https://outline.st.datangyuan.cn
   ```

   然后重启 Outline 容器。

#### 原因 2：FORCE_HTTPS 配置问题

如果 `FORCE_HTTPS=true`，Outline 会检查：
- 直接 HTTPS 连接，或
- `X-Forwarded-Proto: https` 头

**解决方法**：

1. **确保 frpc 正确转发协议头**

   如果 frpc 没有正确设置 `X-Forwarded-Proto: https`，Outline 可能会拒绝请求或重定向。

2. **临时测试：禁用 FORCE_HTTPS**

   如果问题仍然存在，可以临时禁用 HTTPS 强制跳转进行测试：

   ```bash
   FORCE_HTTPS=false
   ```

   **注意**：这只是用于诊断，生产环境应该保持 `FORCE_HTTPS=true`。

#### 原因 3：端口或网络问题

**解决方法**：

1. **验证本地服务可访问**

   ```bash
   # 测试本地服务是否正常
   curl -k https://127.0.0.1:3300/_health
   ```

2. **检查 frpc 连接**

   查看 frpc 日志，确认：
   - frpc 是否成功连接到本地服务
   - 是否有连接超时或拒绝连接的错误

3. **检查防火墙**

   确保本地防火墙允许 frpc 访问 `127.0.0.1:3300`

#### 原因 4：frpc 的 HTTPS 类型配置

如果使用 `type = "https"`，frpc 会在服务端处理 SSL 终止。确保：

1. **frps（服务端）正确配置了 SSL 证书**

2. **域名 DNS 正确解析到 frps 服务器**

3. **frpc 配置的域名与访问域名一致**

#### 推荐的 frpc 配置

```ini
[[proxies]]
name = "outline.st.datangyuan.cn"
type = "https"
localIP = "127.0.0.1"
localPort = 3300
customDomains = ["outline.st.datangyuan.cn"]

# 如果 frpc 版本支持，可以添加以下配置
# hostHeaderRewrite = "outline.st.datangyuan.cn"
```

#### 诊断步骤

1. **检查 frpc 日志**：
   ```bash
   # 查看 frpc 日志，查找错误信息
   tail -f /path/to/frpc.log
   ```

2. **测试本地连接**：
   ```bash
   curl -k https://127.0.0.1:3300/_health
   ```

3. **测试通过 frpc 访问**：
   ```bash
   curl -k https://outline.st.datangyuan.cn/_health
   ```

4. **检查浏览器控制台**：
   - 打开开发者工具（F12）
   - 查看 Network 标签中的请求和响应
   - 查看是否有 CORS 错误或协议错误

5. **验证环境变量**：
   ```bash
   # 在 Outline 容器中
   echo $URL
   echo $FORCE_HTTPS
   ```

## 完整文档

详细说明请参考：[DOKPLOY_DEPLOYMENT.md](./DOKPLOY_DEPLOYMENT.md)
