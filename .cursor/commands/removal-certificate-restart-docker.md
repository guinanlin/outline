清除 outline Docker 容器内的 SSL 证书文件并重启容器。

执行以下操作：
1. 删除容器内的证书文件：`/opt/outline/server/config/certs/private.key` 和 `/opt/outline/server/config/certs/public.cert`
2. 重启 outline 容器以使更改生效
3. 验证证书文件已删除且服务正常运行

命令示例：
```bash
# 删除证书文件
docker exec outline rm -f /opt/outline/server/config/certs/private.key /opt/outline/server/config/certs/public.cert

# 验证证书文件已删除
docker exec outline ls -la /opt/outline/server/config/certs/

# 重启容器
docker restart outline

# 等待服务启动并检查状态
sleep 5 && docker ps | grep outline

# 查看日志确认服务正常启动（应该显示监听 http 而不是 https）
docker logs outline --tail 10
```

一键执行所有操作：
```bash
# 删除证书并重启容器
docker exec outline rm -f /opt/outline/server/config/certs/private.key /opt/outline/server/config/certs/public.cert && \
docker restart outline && \
sleep 5 && \
docker ps | grep outline && \
docker logs outline --tail 5
```

注意事项：
- 删除证书后，服务将使用 HTTP 而不是 HTTPS
- 重启后，日志中应显示 "Listening on http://..." 而不是 "Listening on https://..."
- 如果容器名称不是 "outline"，请替换命令中的容器名称
