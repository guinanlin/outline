# 使用 .pem 文件在 Windows 安装 CA 证书

## 重要说明

`.pem` 文件可以直接在 Windows 上安装，**不需要重命名为 .crt**。Windows 证书管理器支持多种格式，包括 `.pem`、`.crt`、`.cer` 等。

## 方法 1：直接使用 .pem 文件安装（推荐）

### 步骤 1：复制文件到 Windows

将 `rootCA.pem` 文件复制到 Windows 设备，例如：
```
C:\Users\jianc\Downloads\rootCA.pem
```

### 步骤 2：打开证书管理器

1. **按 `Win + R` 打开运行对话框**
2. **输入：`certmgr.msc`**
3. **按回车**（可能需要管理员权限）

### 步骤 3：导入证书

1. **在左侧树形结构中**
   - 展开 **"证书 - 本地计算机"**
   - 展开 **"受信任的根证书颁发机构"**
   - 右键点击 **"证书"** 文件夹
   - 选择 **"所有任务"** → **"导入"**

2. **证书导入向导**
   - 点击 **"下一步"**

3. **选择文件**
   - 点击 **"浏览"**
   - **重要**：在文件类型下拉菜单中选择 **"所有文件 (*.*)"**
   - 找到并选择 `rootCA.pem` 文件
   - 点击 **"打开"**
   - 点击 **"下一步"**

4. **证书存储**
   - 选择 **"将所有证书放入下列存储"**
   - 存储位置应该显示：**"受信任的根证书颁发机构"**
   - 如果不是，点击 **"浏览"** 选择正确的存储
   - 点击 **"下一步"**

5. **完成**
   - 点击 **"完成"**
   - 确认安全警告
   - 看到 "导入成功" 提示

## 方法 2：重命名为 .crt 后安装（如果方法1不工作）

如果 Windows 不识别 `.pem` 文件，可以重命名：

### 步骤 1：重命名文件

在 Windows 上：
1. 找到 `rootCA.pem` 文件
2. 右键点击 → **"重命名"**
3. 将扩展名改为 `.crt`：`rootCA.crt`
4. 如果提示"更改扩展名可能导致文件不可用"，点击 **"是"**

### 步骤 2：双击安装

1. **双击 `rootCA.crt` 文件**
2. 按照之前的步骤安装

## 方法 3：通过命令行安装（推荐，最简单）

### 使用 certutil（支持 .pem 文件）

1. **以管理员身份打开命令提示符（CMD）**
   - 按 `Win + X`
   - 选择 **"Windows PowerShell (管理员)"** 或 **"命令提示符 (管理员)"**

2. **执行安装命令**
   ```cmd
   certutil -addstore -f "Root" C:\Users\jianc\Downloads\rootCA.pem
   ```

3. **验证安装**
   ```cmd
   certutil -store "Root" | findstr "mkcert"
   ```

### 使用 PowerShell（也支持 .pem 文件）

1. **以管理员身份打开 PowerShell**

2. **执行安装命令**
   ```powershell
   Import-Certificate -FilePath "C:\Users\jianc\Downloads\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root
   ```

3. **验证安装**
   ```powershell
   Get-ChildItem -Path Cert:\LocalMachine\Root | Where-Object {$_.Subject -like "*mkcert*"}
   ```

## 快速安装命令（推荐）

**最简单的方法：使用命令行**

1. 将 `rootCA.pem` 复制到 Windows，例如：`C:\Users\jianc\Downloads\rootCA.pem`

2. 以管理员身份打开命令提示符，执行：
   ```cmd
   certutil -addstore -f "Root" C:\Users\jianc\Downloads\rootCA.pem
   ```

3. 看到 "CertUtil: -addstore 命令成功完成" 就表示安装成功

## 验证安装

### 方法 1：通过证书管理器

1. 打开 `certmgr.msc`
2. 展开 **"受信任的根证书颁发机构"** → **"证书"**
3. 查找 **"mkcert ctyun@dty02"** 或 **"mkcert development CA"**

### 方法 2：通过命令行

```cmd
certutil -store "Root" | findstr "mkcert"
```

应该能看到类似输出：
```
mkcert ctyun@dty02
```

## 文件传输方法

### 方法 1：使用 SCP（如果 Windows 支持）

```bash
# 在 Linux 宿主机上执行
scp /home/ctyun/.local/share/mkcert/rootCA.pem jianc@192.168.8.246:C:/Users/jianc/Downloads/rootCA.pem
```

### 方法 2：通过共享文件夹

1. 在 Linux 上创建共享文件夹
2. 将 `rootCA.pem` 复制到共享文件夹
3. 在 Windows 上通过网络共享访问并下载

### 方法 3：通过 HTTP 服务（临时）

```bash
# 在 Linux 宿主机上执行
cd /home/ctyun/.local/share/mkcert
python3 -m http.server 8080

# 在 Windows 浏览器访问：http://宿主机IP:8080/rootCA.pem
# 下载后记得停止服务（Ctrl+C）
```

### 方法 4：使用 U 盘或其他存储设备

直接复制文件到 U 盘，然后在 Windows 上复制到本地

## 常见问题

### Q1: Windows 不识别 .pem 文件

**解决方案：**
- 使用命令行安装（方法 3），certutil 支持 .pem 文件
- 或重命名为 .crt 后安装

### Q2: 双击 .pem 文件没有反应

**解决方案：**
- 使用证书管理器（certmgr.msc）导入
- 或使用命令行安装

### Q3: 安装后 Chrome 仍然显示不安全

**解决方案：**
1. 清除 Chrome HSTS 缓存：`chrome://net-internals/#hsts`
2. 完全关闭并重新打开 Chrome
3. 使用隐私模式测试

## 总结

- ✅ `.pem` 文件可以直接使用，不需要重命名
- ✅ 推荐使用命令行安装：`certutil -addstore -f "Root" 文件路径`
- ✅ 安装到系统级别后，所有浏览器都会信任
