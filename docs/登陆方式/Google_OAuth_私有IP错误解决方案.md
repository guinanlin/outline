# Google OAuth 私有 IP 错误解决方案

## 错误信息

```
device_id and device_name are required for private IP: http://192.168.1.255:3300/auth/google.callback
错误 400： invalid_request
```

## 问题原因

Google OAuth **不允许使用私有 IP 地址**（如 `192.168.x.x`、`10.x.x.x`、`172.16.x.x`）作为 OAuth 回调 URL。

当 Outline 的 `URL` 环境变量设置为私有 IP 地址时（例如：`http://192.168.1.255:3300`），Google OAuth 插件会使用这个私有 IP 生成回调 URL，导致 Google 拒绝该请求。

## 解决方案

### 方案 1：使用 OAUTH_CALLBACK_BASE_URL（推荐）

如果你的 Outline 通过反向代理（如 Nginx、frpc）对外提供服务，应该：

1. **设置 `OAUTH_CALLBACK_BASE_URL` 环境变量**

   在 `dokploy-env.txt` 中配置：

   ```bash
   # 内部访问地址（可以是私有 IP）
   URL=http://192.168.1.255:3300
   
   # OAuth 回调 URL 使用公网域名
   OAUTH_CALLBACK_BASE_URL=https://outline.st.datangyuan.cn
   ```

2. **在 Google Cloud Console 中配置回调 URL**

   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 进入你的项目 → **APIs & Services** → **Credentials**
   - 找到你的 OAuth 2.0 客户端 ID
   - 在 **Authorized redirect URIs** 中添加：
     ```
     https://outline.st.datangyuan.cn/auth/google.callback
     ```
   - **重要**：必须使用 `OAUTH_CALLBACK_BASE_URL` 中配置的域名，而不是 `URL` 中的私有 IP

3. **重启服务**

   修改代码后需要重新构建镜像或重启容器。

### 方案 2：直接使用公网域名（如果可能）

如果你的服务器可以直接通过公网域名访问，可以直接设置：

```bash
URL=https://outline.st.datangyuan.cn
```

然后在 Google Cloud Console 中配置回调 URL：
```
https://outline.st.datangyuan.cn/auth/google.callback
```

## 代码修复说明

已修复 `plugins/google/server/auth/google.ts` 文件，使其支持 `OAUTH_CALLBACK_BASE_URL`：

**修复前：**
```typescript
callbackURL: `${env.URL}/auth/${config.id}.callback`,
```

**修复后：**
```typescript
callbackURL: `${serverEnv.OAUTH_CALLBACK_BASE_URL || env.URL}/auth/${config.id}.callback`,
```

这样，如果设置了 `OAUTH_CALLBACK_BASE_URL`，就会优先使用它；否则回退到 `env.URL`。

## 验证步骤

1. **检查环境变量**

   确保 `OAUTH_CALLBACK_BASE_URL` 已正确设置：
   ```bash
   # 在容器中检查
   echo $OAUTH_CALLBACK_BASE_URL
   ```

2. **检查 Google Cloud Console 配置**

   确保回调 URL 与 `OAUTH_CALLBACK_BASE_URL` 匹配：
   - 如果 `OAUTH_CALLBACK_BASE_URL=https://outline.st.datangyuan.cn`
   - 则回调 URL 应为：`https://outline.st.datangyuan.cn/auth/google.callback`

3. **测试 OAuth 登录**

   尝试使用 Google 账号登录，应该不再出现私有 IP 错误。

## 其他 OAuth 提供商的注意事项

- **Slack**：已支持 `OAUTH_CALLBACK_BASE_URL`（通过 `SlackUtils.callbackUrl()`）
- **Azure AD**：目前使用 `env.URL`，可能需要类似修复
- **Discord**：目前使用 `env.URL`，可能需要类似修复
- **OIDC**：目前使用 `env.URL`，可能需要类似修复

## 相关文档

- [登录方式说明](./登录方式说明.md)
- [环境部署文档](../环境部署/DEPLOYMENT.md)
