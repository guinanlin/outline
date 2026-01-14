在 Outline 容器中运行数据库迁移，用于初始化数据库表结构。

## 执行前准备

1. **确保数据库配置正确**
   - 检查环境变量中的 `DB_PASSWORD` 已设置为真实密码（不是占位符）
   - 确保 PostgreSQL 容器正常运行
   - 确保 Outline 容器可以连接到数据库

## 执行方式

### 方式 1：本地执行（推荐，更快速）

在本地终端使用 `docker exec` 命令直接执行：

对于 Docker 容器中的 PostgreSQL（默认不支持 SSL）：
```bash
docker exec -e NODE_ENV=production-ssl-disabled outline npx sequelize db:migrate
```

对于支持 SSL 的数据库（生产环境推荐）：
```bash
docker exec -e NODE_ENV=production outline npx sequelize db:migrate
```

### 方式 2：在 Dokploy Terminal 中执行

1. 打开 Dokploy 应用的 **Terminal** 或 **终端** 功能
2. 选择 `outline` 容器
3. 容器的工作目录默认是 `/opt/outline`（应用根目录）
4. 执行迁移命令：

对于 Docker 容器中的 PostgreSQL（默认不支持 SSL）：
```bash
NODE_ENV=production-ssl-disabled npx sequelize db:migrate
```

对于支持 SSL 的数据库（生产环境推荐）：
```bash
NODE_ENV=production npx sequelize db:migrate
```

**注意**：如果遇到 Yarn 版本错误，使用 `npx sequelize` 命令代替。

## 预期输出

迁移成功时会看到类似输出：

**如果数据库已是最新状态**：
```
[MISSING_ENV_FILE] missing .env file (/opt/outline/.env)
...
Loaded configuration file "server/config/database.js".
Using environment "production-ssl-disabled".
No migrations were executed, database schema was already up to date.
```

**如果是首次迁移或执行了新迁移**：
```
[MISSING_ENV_FILE] missing .env file (/opt/outline/.env)
...
Loaded configuration file "server/config/database.js".
Using environment "production-ssl-disabled".
[timestamp] [name] migrated
```

**关于 `.env 文件缺失警告**：
- 这是正常的，可以忽略
- 环境变量通过 Docker 容器环境传递，不需要 `.env` 文件
- 不影响迁移执行

## 注意事项

- **首次部署必须执行此步骤**：数据库迁移会创建必要的表结构
- **迁移是幂等的**：可以安全地重复执行，不会造成数据丢失
- **如果迁移失败**：检查数据库连接配置和密码是否正确
- **SSL 配置**：
  - Docker Compose 中的 PostgreSQL 通常不支持 SSL，使用 `production-ssl-disabled` 环境
  - 外部生产环境的数据库通常支持 SSL，使用 `production` 环境
  - 查看 `PGSSLMODE` 环境变量：`disable` 使用 `production-ssl-disabled`，`require` 使用 `production`
- **命令执行方式**：推荐使用方式 1（本地执行），更快速便捷
