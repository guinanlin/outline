# Outline 域名配置说明

## 情况说明

当 `URL` 环境变量设置为 `http://outline.st.datangyuan.cn` 时，有两种访问方式：

### 方案 1：只通过 frpc 访问（推荐，不需要 hosts 配置）

**适用场景**：只在外部通过 frpc 访问，不在本地测试

**优点**：
- 不需要修改 hosts 文件
- 配置简单

**步骤**：
1. 设置环境变量：
   ```bash
   URL=http://outline.st.datangyuan.cn
   ```

2. 通过 frpc 访问：
   - 外部访问：`http://outline.st.datangyuan.cn`
   - frpc 会自动处理域名解析和转发
   - 不需要 hosts 配置

3. 本地不访问（或通过 IP 直接访问容器）

### 方案 2：本地也需要访问域名（需要 hosts 配置）

**适用场景**：想在本地浏览器中通过域名访问测试

**优点**：
- 可以在本地测试域名访问
- 与实际生产环境一致

**步骤**：

1. **配置 hosts 文件**（需要管理员权限）

   **Linux/macOS**：
   ```bash
   sudo nano /etc/hosts
   # 或
   sudo vim /etc/hosts
   ```

   **Windows**：
   - 以管理员身份打开记事本
   - 打开文件：`C:\Windows\System32\drivers\etc\hosts`

2. **添加域名映射**：

   ```bash
   # Outline 本地测试
   192.168.1.255  outline.st.datangyuan.cn
   ```

   **注意**：
   - `192.168.1.255` 是你的服务器 IP 地址
   - 如果 frpc 在本机运行，使用 `127.0.0.1` 或 `localhost`
   - 如果 frpc 在远程服务器，使用服务器的 IP 地址

3. **保存并测试**：

   ```bash
   # 测试域名解析
   ping outline.st.datangyuan.cn
   
   # 应该返回 192.168.1.255 的响应
   ```

4. **浏览器访问**：
   ```
   http://outline.st.datangyuan.cn:3300
   ```
   
   **注意**：
   - 如果 frpc 监听在 3300 端口，直接访问 `http://outline.st.datangyuan.cn`
   - 如果直接访问容器，需要加上端口 `:3300`

## 推荐配置

### 生产环境（通过 frpc 访问）

```bash
# dokploy-env.txt
URL=http://outline.st.datangyuan.cn
FORCE_HTTPS=false  # 如果 frpc 使用 HTTP
```

**不需要 hosts 配置**，frpc 会自动处理。

### 开发测试环境（本地访问）

```bash
# /etc/hosts (Linux/macOS) 或 C:\Windows\System32\drivers\etc\hosts (Windows)
192.168.1.255  outline.st.datangyuan.cn
```

```bash
# dokploy-env.txt
URL=http://outline.st.datangyuan.cn
FORCE_HTTPS=false
```

## 注意事项

1. **hosts 文件权限**：
   - Linux/macOS：需要 root 权限编辑
   - Windows：需要管理员权限编辑

2. **域名解析优先级**：
   - hosts 文件优先级高于 DNS
   - 如果 hosts 中配置了，会优先使用 hosts 中的映射

3. **多台机器访问**：
   - 每台需要本地访问的机器都需要配置 hosts
   - 或者使用内网 DNS 服务器统一管理

4. **frpc 配置**：
   - 确保 frpc 的 `customDomains` 配置正确
   - 确保 frpc 转发正确的 `Host` 头

## 验证配置

1. **检查域名解析**：
   ```bash
   ping outline.st.datangyuan.cn
   nslookup outline.st.datangyuan.cn
   ```

2. **检查容器环境变量**：
   ```bash
   docker exec outline env | grep URL
   ```

3. **测试 WebSocket 连接**：
   - 打开浏览器开发者工具
   - 查看 Network 标签
   - 检查 WebSocket 连接是否成功建立
