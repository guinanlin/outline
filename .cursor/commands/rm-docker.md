删除所有与 outline 相关的 Docker 容器和 postgres data volume。

执行以下操作：
1. 使用 `docker ps -a | grep outline` 查找所有包含 "outline" 的容器
2. 删除找到的所有容器（包括运行中的容器），使用 `docker rm -f` 命令
3. 如果容器名称已知，直接删除：outline, outline-postgres, outline-mailhog, outline-redis
4. 删除 postgres data volume（需要先删除容器）

命令示例：
```bash
# 删除容器
docker rm -f outline outline-postgres outline-mailhog outline-redis

# 查找并删除 postgres data volume（通过容器 inspect 查找 volume 名称，或使用名称模式匹配）
docker volume ls | grep postgres-data | awk '{print $2}' | xargs -r docker volume rm
```

如果需要查找并删除所有相关容器，然后删除 volume，可以使用：
```bash
# 删除所有 outline 相关容器
docker ps -a | grep outline | awk '{print $1}' | xargs -r docker rm -f

# 删除所有 postgres-data volume（包含 outline 相关的）
docker volume ls | grep -E "(outline|oa-outline).*postgres-data" | awk '{print $2}' | xargs -r docker volume rm
```
