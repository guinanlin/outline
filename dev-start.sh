#!/bin/bash
# Outline 开发环境启动脚本
# 自动切换到 Node.js v20 并启动开发服务器

set -e

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 切换到 Node.js v20
echo "🔧 切换到 Node.js v20..."
nvm use 20 --silent || {
  echo "❌ 无法切换到 Node.js v20，请先运行: nvm install 20"
  exit 1
}

echo "✅ Node.js 版本: $(node --version)"
echo "🚀 启动 Outline 开发服务器..."
echo ""

# 运行 make up
make up
