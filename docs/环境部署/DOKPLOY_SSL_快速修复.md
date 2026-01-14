# Dokploy SSL 证书快速修复指南

## 🔍 问题诊断结果

通过检查，发现当前使用的是 **Traefik 默认自签名证书**（"TRAEFIK DEFAULT CERT"），这就是浏览器显示"证书不安全"的原因。

**证书信息**：
- 颁发者：TRAEFIK DEFAULT CERT（自签名）
- 有效期：2026-01-11 至 2027-01-11
- 状态：❌ 浏览器不信任（自签名证书）

## ✅ 解决方案

### 方案 1：使用 Let's Encrypt 自动证书（推荐）

这是最简单且免费的方法，证书会自动续期。

#### 步骤 1：登录 Dokploy 管理界面

1. 打开 Dokploy 管理界面
2. 找到你的 Outline 应用

#### 步骤 2：配置域名和 SSL

1. 在应用设置中找到 **"Domains"** 或 **"域名"** 部分
2. 如果已有域名配置，先删除旧的配置
3. 点击 **"Add Domain"** 或 **"添加域名"**
4. 输入域名：`outline.st.datangyuan.cn`
5. 在 SSL 证书选项中选择 **"Let's Encrypt"**
6. 点击 **"Generate Certificate"** 或 **"申请证书"**
7. 等待证书申请完成（通常需要 1-5 分钟）

#### 步骤 3：验证证书

证书申请成功后，执行以下命令验证：

```bash
# 检查证书信息（应该显示 Let's Encrypt）
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -issuer

# 应该显示类似：
# issuer=C = US, O = Let's Encrypt, CN = R3
```

#### 步骤 4：重启应用（如果需要）

某些 Dokploy 版本需要重启应用才能应用新证书：
1. 在 Dokploy 中找到应用
2. 点击 **"Restart"** 或 **"重启"**

### 方案 2：使用自定义证书（如果你已有证书）

如果你有泛域名证书（`*.st.datangyuan.cn`）或其他证书：

#### 步骤 1：准备证书文件

确保你有以下文件：
- **证书文件**（`.crt` 或 `.pem`）：包含完整证书链
- **私钥文件**（`.key`）：证书的私钥

#### 步骤 2：在 Dokploy 中上传证书

1. 在应用设置中找到 **"SSL"** 或 **"证书"** 部分
2. 选择 **"Custom Certificate"** 或 **"自定义证书"**
3. 上传证书文件：
   - **Certificate**: 选择你的 `.crt` 或 `.pem` 文件
   - **Private Key**: 选择你的 `.key` 文件
4. 点击 **"Save"** 或 **"保存"**

#### 步骤 3：验证证书

```bash
# 检查证书信息
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -subject -issuer
```

### 方案 3：检查 Dokploy 的 Traefik 配置

如果 Dokploy 使用 Traefik 作为反向代理，可能需要检查 Traefik 的配置：

#### 检查 Traefik 证书解析器

1. 在 Dokploy 中找到 **"Settings"** 或 **"设置"**
2. 查找 **"Traefik"** 或 **"反向代理"** 配置
3. 确认已配置 Let's Encrypt 证书解析器

#### 手动配置 Traefik（高级用户）

如果需要手动配置，可以在 Dokploy 的 Traefik 配置中添加：

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com  # 替换为你的邮箱
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

然后在应用的标签中添加：

```yaml
labels:
  - "traefik.http.routers.outline.rule=Host(`outline.st.datangyuan.cn`)"
  - "traefik.http.routers.outline.entrypoints=websecure"
  - "traefik.http.routers.outline.tls.certresolver=letsencrypt"
  - "traefik.http.services.outline.loadbalancer.server.port=3300"
```

## 🔧 常见问题排查

### Q1: Let's Encrypt 证书申请失败

**可能原因**：
- DNS 解析不正确
- 80 端口不可访问（Let's Encrypt 需要 HTTP-01 验证）
- 域名已申请过证书但配置错误

**解决方法**：
1. 检查 DNS 解析：
   ```bash
   dig outline.st.datangyuan.cn
   # 应该返回正确的 IP 地址
   ```

2. 检查 80 端口是否可访问：
   ```bash
   curl -I http://outline.st.datangyuan.cn
   # 应该返回 HTTP 响应（可能是重定向到 HTTPS）
   ```

3. 等待一段时间后重试（Let's Encrypt 有速率限制）

### Q2: 证书申请成功但浏览器仍显示不安全

**可能原因**：
- 浏览器缓存了旧的证书
- 证书链不完整

**解决方法**：
1. **清除浏览器缓存**：
   - Chrome/Edge: `Ctrl+Shift+Delete` → 清除"缓存的图片和文件"
   - Firefox: `Ctrl+Shift+Delete` → 清除"缓存"

2. **清除 SSL 状态**（Chrome）：
   - 设置 → 隐私和安全 → 清除浏览数据 → 高级
   - 选择"时间范围：全部时间"
   - 勾选"Cookie 和其他网站数据"
   - 点击"清除数据"

3. **使用无痕模式测试**：
   - 打开无痕/隐私模式窗口
   - 访问 `https://outline.st.datangyuan.cn`
   - 如果无痕模式正常，说明是缓存问题

### Q3: 泛域名证书不工作

**检查证书是否包含子域名**：

```bash
# 检查证书的 Subject Alternative Name
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -text | grep -A 1 "Subject Alternative Name"

# 应该显示包含 outline.st.datangyuan.cn 或 *.st.datangyuan.cn
```

如果证书不包含该子域名，需要：
1. 重新申请包含该子域名的证书
2. 或使用 Let's Encrypt 为特定子域名申请证书

## ✅ 验证步骤

完成配置后，执行以下验证：

### 1. 检查证书信息

```bash
# 检查证书颁发者（应该不是 "TRAEFIK DEFAULT CERT"）
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -issuer

# 检查证书有效期
echo | openssl s_client -servername outline.st.datangyuan.cn -connect outline.st.datangyuan.cn:443 2>/dev/null | openssl x509 -noout -dates
```

### 2. 测试 HTTPS 访问

```bash
# 测试 HTTPS 连接
curl -I https://outline.st.datangyuan.cn

# 应该返回 200 或 301/302 状态码，且没有 SSL 错误
```

### 3. 浏览器验证

1. 在浏览器中访问 `https://outline.st.datangyuan.cn`
2. 点击地址栏的锁图标 🔒
3. 查看证书信息：
   - ✅ 证书颁发机构应该是 "Let's Encrypt" 或其他受信任的 CA
   - ✅ 证书有效期应该在未来
   - ✅ 证书应该包含 `outline.st.datangyuan.cn`

### 4. 使用在线工具验证

访问以下网站验证证书：
- https://www.ssllabs.com/ssltest/analyze.html?d=outline.st.datangyuan.cn
- 应该显示 **A** 或 **A+** 评级

## 📝 配置检查清单

完成配置后，确认以下项目：

- [ ] DNS 解析正确指向服务器 IP
- [ ] Dokploy 中已添加域名 `outline.st.datangyuan.cn`
- [ ] SSL 证书已配置（Let's Encrypt 或自定义证书）
- [ ] 证书状态显示为 "Active" 或 "Valid"
- [ ] 反向代理指向 `outline:3300` 或 `http://outline:3300`
- [ ] 环境变量 `FORCE_HTTPS=false`（因为 SSL 在反向代理层处理）
- [ ] 浏览器中证书显示为受信任
- [ ] 在线 SSL 测试工具显示证书有效

## 🚀 下一步

证书配置成功后：

1. **测试应用功能**：
   - 访问 `https://outline.st.datangyuan.cn`
   - 测试登录功能
   - 测试 OAuth 登录（Google/Slack）

2. **设置证书自动续期**（如果使用 Let's Encrypt）：
   - Let's Encrypt 证书每 90 天需要续期
   - Dokploy 通常会自动处理续期
   - 确认 Dokploy 的证书续期功能已启用

3. **监控证书状态**：
   - 定期检查证书有效期
   - 设置证书过期提醒（如果 Dokploy 支持）

## 📚 相关文档

- [详细排查指南](./DOKPLOY_SSL_CERTIFICATE_TROUBLESHOOTING.md)
- [Dokploy 部署指南](./DOKPLOY_DEPLOYMENT.md)
- [Dokploy 快速开始](./DOKPLOY_QUICK_START.md)
