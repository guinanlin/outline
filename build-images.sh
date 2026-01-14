#!/bin/bash
# Outline 镜像构建脚本
# 修改源代码后，需要重新构建镜像才能生效

set -e

echo "=========================================="
echo "开始构建 Outline Docker 镜像"
echo "=========================================="

# 步骤 0: 生成 SSL 证书（如果未设置环境变量，使用默认值）
echo ""
echo "步骤 0/3: 生成 SSL 证书"
echo ""

# 检查是否设置了 LOCAL_NETWORK 环境变量
if [ -z "$LOCAL_NETWORK" ]; then
  echo "⚠️  LOCAL_NETWORK 未设置，使用默认值: 192.168.0.0/16"
  echo "   如需自定义，请设置: export LOCAL_NETWORK=192.168.0.0/16"
  export LOCAL_NETWORK=192.168.0.0/16
fi

echo "📡 使用网段: $LOCAL_NETWORK"
yarn install-local-ssl || {
  echo "⚠️  证书生成失败或已存在，继续构建..."
}

echo ""
echo "✓ SSL 证书准备完成"
echo ""

# 步骤 1: 构建基础镜像 (outline-base)
echo ""
echo "步骤 1/3: 构建基础镜像 outline-base:latest"
echo "这将会编译 TypeScript 源代码，可能需要 10-30 分钟..."
echo ""

docker build \
  -f Dockerfile.base \
  -t outline-base:latest \
  --build-arg APP_PATH=/opt/outline \
  .

echo ""
echo "✓ 基础镜像构建完成"
echo ""

# 步骤 2: 构建最终运行镜像 (outline)
echo ""
echo "步骤 2/3: 构建最终运行镜像 outline:latest"
echo ""

docker build \
  -f Dockerfile \
  -t outline:latest \
  --build-arg BASE_IMAGE=outline-base:latest \
  --build-arg APP_PATH=/opt/outline \
  .

echo ""
echo "步骤 3/3: 验证证书已包含在镜像中"
echo ""

# 验证证书文件是否存在
if [ -f "server/config/certs/public.cert" ] && [ -f "server/config/certs/private.key" ]; then
  echo "✓ 证书文件已生成:"
  echo "  - server/config/certs/public.cert"
  echo "  - server/config/certs/private.key"
  echo ""
  echo "📋 证书包含的网段:"
  openssl x509 -in server/config/certs/public.cert -noout -text 2>/dev/null | grep -A 10 "Subject Alternative Name" | grep -E "IP Address|DNS" | head -10 || echo "  (无法读取证书信息)"
else
  echo "⚠️  警告: 证书文件不存在，镜像中可能不包含证书"
fi

echo ""
echo "=========================================="
echo "✓ 镜像构建完成！"
echo "=========================================="
echo ""
echo "构建的镜像："
docker images | grep -E "outline|REPOSITORY" | head -3
echo ""
echo "下一步："
echo "1. 更新 docker-compose.dokploy.yml 中的环境变量（特别是 URL）"
echo "2. 重启容器以使用新镜像："
echo "   docker compose -f docker-compose.dokploy.yml down"
echo "   docker compose -f docker-compose.dokploy.yml up -d"
echo ""
echo "💡 提示: 证书已包含在镜像中，容器启动后即可使用"
echo ""
