#!/bin/bash
# Outline 镜像构建脚本
# 修改源代码后，需要重新构建镜像才能生效

set -e

echo "=========================================="
echo "开始构建 Outline Docker 镜像"
echo "=========================================="

# 步骤 1: 构建基础镜像 (outline-base)
echo ""
echo "步骤 1/2: 构建基础镜像 outline-base:latest"
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
echo "步骤 2/2: 构建最终运行镜像 outline:latest"
echo ""

docker build \
  -f Dockerfile \
  -t outline:latest \
  --build-arg BASE_IMAGE=outline-base:latest \
  --build-arg APP_PATH=/opt/outline \
  .

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
