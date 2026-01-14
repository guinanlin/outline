# Dokploy SSL 证书问题排查指南

## 问题描述

通过 Dokploy 部署 Outline 后，访问 `https://outline.st.datangyuan.cn/` 时浏览器显示"证书不安全"或"您的连接不是私密连接"。

## 问题原因

证书问题通常出现在 **Dokploy 的反向代理层**，而不是 Outline 应用本身。在使用反向代理时，SSL 终止在反向代理层，Outline 应用本身不需要配置证书。

## 排查步骤

### 第一步：检查 Dokploy 域名配置

1. **登录 Dokploy 管理界面**
2. **找到你的 Outline 应用**
3. **检查 "Domains" 或 "域名" 配置**：
   - 确认已添加域名：`outline.st.datangyuan.cn`
   - 确认 SSL 证书已配置（Let's Encrypt 或自定义证书）
   - 确认反向代理指向：`outline:3300` 或 `http://outline:3300`

### 第二步：验证证书状态

#### 方法 1：使用命令行检查证书

```bash
# 检查证书信息
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# 检查证书是否有效
curl -vI https://outline.st.datangyuan.cn 2>&1 | grep -i "certificate\|SSL\|TLS"
```

#### 方法 2：使用在线工具

访问以下网站检查证书：
- https://www.ssllabs.com/ssltest/analyze.html?d=outline.st.datangyuan.cn
- https://crt.sh/?q=outline.st.datangyuan.cn

### 第三步：检查 DNS 解析

```bash
# 检查域名解析
dig outline.st.datangyuan.cn
nslookup outline.st.datangyuan.cn

# 确认解析到正确的 IP 地址
```

### 第四步：检查 Dokploy 反向代理配置

#### 4.1 确认反向代理设置

在 Dokploy 中，反向代理配置应该类似：

```
域名: outline.st.datangyuan.cn
目标: http://outline:3300
SSL: 启用（Let's Encrypt 或自定义证书）
```

#### 4.2 检查必要的 HTTP 头

确保反向代理正确转发以下头部：

- `X-Forwarded-Proto: https`（**必需**）
- `X-Forwarded-For: <客户端IP>`
- `Host: outline.st.datangyuan.cn`

### 第五步：检查 Outline 环境变量

确认 `dokploy-env.txt` 中的配置：

```bash
# URL 应该设置为外部访问地址（HTTPS）
URL=https://outline.st.datangyuan.cn

# 如果使用内部 IP，需要设置 OAUTH_CALLBACK_BASE_URL
# URL=http://192.168.1.255:3300
# OAUTH_CALLBACK_BASE_URL=https://outline.st.datangyuan.cn

# FORCE_HTTPS 应该设置为 false（因为 SSL 在反向代理层处理）
FORCE_HTTPS=false
```

**重要**：如果 `URL` 设置为内部地址（如 `http://192.168.1.255:3300`），必须设置 `OAUTH_CALLBACK_BASE_URL=https://outline.st.datangyuan.cn`。

## 解决方案

### 方案 1：在 Dokploy 中重新配置 SSL 证书

#### 1.1 使用 Let's Encrypt 自动证书（推荐）

1. 在 Dokploy 应用设置中找到 **"Domains"** 或 **"域名"** 部分
2. 删除现有域名配置（如果存在）
3. 重新添加域名：`outline.st.datangyuan.cn`
4. 选择 **"Let's Encrypt"** 作为 SSL 证书来源
5. 点击 **"申请证书"** 或 **"Generate Certificate"**
6. 等待证书申请完成（通常需要几分钟）
7. 确认证书状态为 **"Active"** 或 **"Valid"**

#### 1.2 使用自定义证书

如果你有自定义证书：

1. 在 Dokploy 应用设置中找到 **"SSL"** 或 **"证书"** 部分
2. 选择 **"Custom Certificate"** 或 **"自定义证书"**
3. 上传证书文件：
   - **Certificate (证书)**: 通常是 `.crt` 或 `.pem` 文件
   - **Private Key (私钥)**: 通常是 `.key` 文件
4. 保存配置
5. 重启应用或重新部署

### 方案 2：检查泛域名证书配置

如果你使用的是泛域名证书（如 `*.st.datangyuan.cn`）：

1. **确认证书包含子域名**：
   ```bash
   # 检查证书的 Subject Alternative Name (SAN)
   echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -text | grep -A 1 "Subject Alternative Name"
   ```

2. **确认证书未过期**：
   ```bash
   echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -dates
   ```

3. **在 Dokploy 中配置泛域名证书**：
   - 如果 Dokploy 支持，选择 **"Wildcard Certificate"** 或 **"泛域名证书"**
   - 上传证书和私钥
   - 确认证书应用到正确的域名

### 方案 3：手动配置 Nginx（如果 Dokploy 不支持）

如果 Dokploy 不支持自动 SSL 配置，可以手动配置 Nginx：

```nginx
server {
    listen 80;
    server_name outline.st.datangyuan.cn;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name outline.st.datangyuan.cn;
    
    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;  # 替换为实际证书路径
    ssl_certificate_key /path/to/key.pem;  # 替换为实际私钥路径
    
    # SSL 配置（推荐）
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://outline:3300;
        proxy_http_version 1.1;
        
        # 必要的代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # 重要！
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 方案 4：临时禁用 HTTPS（仅用于诊断）

**警告**：此方案仅用于诊断，不应在生产环境使用。

1. 在 `dokploy-env.txt` 中设置：
   ```bash
   URL=http://outline.st.datangyuan.cn
   FORCE_HTTPS=false
   ```

2. 在 Dokploy 中禁用 SSL，使用 HTTP 访问

3. 如果 HTTP 可以正常访问，说明问题确实在 SSL 证书配置

4. **诊断完成后，立即恢复 HTTPS 配置**

## 常见问题

### Q1: 证书显示"不安全"，但证书本身是有效的

**可能原因**：
- 证书链不完整（缺少中间证书）
- 浏览器缓存了旧的证书信息
- 证书的 Subject Alternative Name (SAN) 不包含该域名

**解决方法**：
1. 清除浏览器缓存和 SSL 状态
2. 在 Dokploy 中重新申请证书
3. 确认证书包含完整的证书链

### Q2: Let's Encrypt 证书申请失败

**可能原因**：
- DNS 解析不正确
- 80 端口被占用（Let's Encrypt 需要验证）
- 域名已申请过证书但未正确配置

**解决方法**：
1. 检查 DNS 解析：`dig outline.st.datangyuan.cn`
2. 确认 80 端口可访问（用于 ACME 验证）
3. 等待一段时间后重试（Let's Encrypt 有速率限制）
4. 检查 Dokploy 日志中的错误信息

### Q3: 泛域名证书不工作

**可能原因**：
- 证书不包含该子域名
- 证书配置错误
- 证书已过期

**解决方法**：
1. 检查证书的 SAN 字段是否包含 `*.st.datangyuan.cn` 或 `outline.st.datangyuan.cn`
2. 确认证书未过期
3. 在 Dokploy 中重新配置证书

### Q4: 证书在部分浏览器中显示不安全

**可能原因**：
- 证书链不完整
- 使用了自签名证书
- 浏览器不信任证书颁发机构

**解决方法**：
1. 使用 Let's Encrypt 等受信任的 CA 颁发的证书
2. 确保证书链完整
3. 检查证书的信任链：`openssl s_client -connect outline.st.datangyuan.cn:443 -showcerts`

## 验证步骤

完成配置后，执行以下验证：

### 1. 检查证书有效性

```bash
# 检查证书信息
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -text | head -20

# 检查证书有效期
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -dates
```

### 2. 测试 HTTPS 访问

```bash
# 测试 HTTPS 连接
curl -I https://outline.st.datangyuan.cn

# 测试健康检查端点
curl https://outline.st.datangyuan.cn/_health
```

### 3. 检查浏览器中的证书

1. 在浏览器中访问 `https://outline.st.datangyuan.cn`
2. 点击地址栏的锁图标
3. 查看证书信息：
   - 证书颁发机构
   - 有效期
   - 证书链

### 4. 使用在线工具验证

访问以下网站验证证书：
- https://www.ssllabs.com/ssltest/analyze.html?d=outline.st.datangyuan.cn
- https://crt.sh/?q=outline.st.datangyuan.cn

## 最佳实践

1. **使用 Let's Encrypt 自动证书**：免费、自动续期、受信任
2. **定期检查证书状态**：设置监控提醒证书即将过期
3. **保持 Dokploy 更新**：新版本可能修复证书相关问题
4. **配置证书自动续期**：Let's Encrypt 证书每 90 天需要续期
5. **使用完整的证书链**：确保中间证书正确配置

## 相关文档

- [Dokploy 部署指南](./DOKPLOY_DEPLOYMENT.md)
- [Dokploy 快速开始](./DOKPLOY_QUICK_START.md)
- [环境变量配置说明](../登陆方式/登录方式说明.md)
