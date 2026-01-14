#!/bin/bash
# 复制 mkcert CA 证书到指定位置，方便局域网设备安装

CA_CERT_PATH="$HOME/.local/share/mkcert/rootCA.pem"
OUTPUT_DIR="./ca-cert-for-install"

# 检查 CA 证书是否存在
if [ ! -f "$CA_CERT_PATH" ]; then
    echo "❌ 错误: 未找到 mkcert CA 证书"
    echo "   预期位置: $CA_CERT_PATH"
    echo ""
    echo "请确认 mkcert 已安装并已运行 'mkcert -install'"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 复制证书
cp "$CA_CERT_PATH" "$OUTPUT_DIR/rootCA.pem"
cp "$CA_CERT_PATH" "$OUTPUT_DIR/rootCA.crt"  # Windows 需要 .crt 扩展名

echo "✅ CA 证书已复制到: $OUTPUT_DIR/"
echo ""
echo "📋 证书信息:"
openssl x509 -in "$CA_CERT_PATH" -noout -subject -issuer -dates
echo ""
echo "📤 下一步操作:"
echo "1. 将 $OUTPUT_DIR/rootCA.crt 复制到局域网设备（Windows）"
echo "2. 在 Windows 设备上双击 rootCA.crt 安装证书"
echo "3. 选择 '本地计算机' → '受信任的根证书颁发机构'"
echo ""
echo "💡 提示: 可以通过以下方式传输文件:"
echo "   - SCP: scp $OUTPUT_DIR/rootCA.crt user@192.168.8.246:C:/Users/user/Downloads/"
echo "   - 共享文件夹"
echo "   - HTTP 服务: cd $OUTPUT_DIR && python3 -m http.server 8080"
