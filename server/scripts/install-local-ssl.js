/* oxlint-disable @typescript-eslint/no-var-requires */

const exec = require("child_process").execSync;
const fs = require("fs");
const path = require("path");
const os = require("os");

const sslDir = path.join(__dirname, "..", "config", "certs");
const sslCert = path.join(sslDir, "public.cert");
const sslKey = path.join(sslDir, "private.key");

/**
 * 解析 CIDR 网段为 IP 地址列表
 * @param {string} cidr - CIDR 格式，如 "192.168.0.0/16"
 * @param {boolean} expandAll - 是否展开所有 IP（false 时只展开关键 IP）
 * @returns {string[]} IP 地址数组
 */
function parseCIDR(cidr, expandAll = false) {
  const [ip, prefixLength] = cidr.split("/");
  const prefix = parseInt(prefixLength, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix length: ${prefixLength}`);
  }

  // 解析 IP 地址为数字
  const ipParts = ip.split(".").map(Number);
  if (ipParts.length !== 4 || ipParts.some(part => isNaN(part) || part < 0 || part > 255)) {
    throw new Error(`Invalid IP address: ${ip}`);
  }

  const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
  const mask = 0xffffffff << (32 - prefix);
  const networkStart = ipNum & mask;
  const networkEnd = networkStart | (~mask);

  const ips = [];

  if (expandAll) {
    // 展开整个网段的所有 IP
    for (let i = networkStart; i <= networkEnd; i++) {
      const a = (i >>> 24) & 0xff;
      const b = (i >>> 16) & 0xff;
      const c = (i >>> 8) & 0xff;
      const d = i & 0xff;
      ips.push(`${a}.${b}.${c}.${d}`);
    }
  } else {
    // 智能展开：只包含关键 IP
    // 1. 网络地址（.0）
    const networkIP = networkStart;
    const a1 = (networkIP >>> 24) & 0xff;
    const b1 = (networkIP >>> 16) & 0xff;
    const c1 = (networkIP >>> 8) & 0xff;
    const d1 = networkIP & 0xff;
    ips.push(`${a1}.${b1}.${c1}.${d1}`);

    // 2. 网关地址（通常是 .1）
    if (prefix <= 24) {
      // 对于 /24 或更大的网段，添加 .1
      ips.push(`${a1}.${b1}.${c1}.1`);
    }

    // 3. 广播地址（.255）
    const broadcastIP = networkEnd;
    const a2 = (broadcastIP >>> 24) & 0xff;
    const b2 = (broadcastIP >>> 16) & 0xff;
    const c2 = (broadcastIP >>> 8) & 0xff;
    const d2 = broadcastIP & 0xff;
    ips.push(`${a2}.${b2}.${c2}.${d2}`);

    // 4. 对于 /16 网段，添加一些常见的子网
    if (prefix === 16) {
      // 添加几个常见的子网网关
      for (let subnet = 1; subnet <= 10; subnet++) {
        ips.push(`${a1}.${b1}.${subnet}.1`);
        ips.push(`${a1}.${b1}.${subnet}.255`);
      }
    }

    // 5. 对于 /8 网段，添加更多关键 IP
    if (prefix === 8) {
      // 添加一些常见的子网
      for (let subnet2 = 0; subnet2 <= 10; subnet2++) {
        for (let subnet3 = 0; subnet3 <= 10; subnet3++) {
          ips.push(`${a1}.${subnet2}.${subnet3}.1`);
          ips.push(`${a1}.${subnet2}.${subnet3}.255`);
        }
      }
    }
  }

  // 去重
  return [...new Set(ips)];
}

/**
 * 获取局域网 IP 地址列表
 * @returns {string[]} IP 地址数组
 */
function getLocalIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部（即 127.0.0.1）和 IPv6
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  return ips;
}

/**
 * 构建 mkcert 证书参数
 * @returns {string[]} 域名和 IP 列表
 */
function buildCertSubjects() {
  const subjects = [];

  // 1. 从环境变量获取域名（默认 local.outline.dev）
  const localDomain = process.env.LOCAL_DOMAIN || "local.outline.dev";
  subjects.push(localDomain);

  // 2. 通配符域名
  subjects.push("*.outline.dev");

  // 3. 常用本地域名
  subjects.push("localhost");

  // 4. 本地回环地址
  subjects.push("127.0.0.1");

  // 5. 处理 CIDR 网段或单个 IP
  const localNetwork = process.env.LOCAL_NETWORK || process.env.LOCAL_IP;
  const expandAll = process.env.EXPAND_NETWORK_ALL === "true";

  if (localNetwork) {
    const networks = localNetwork.split(",").map(n => n.trim());

    for (const network of networks) {
      if (network.includes("/")) {
        // CIDR 格式，如 192.168.0.0/16
        try {
          const ips = parseCIDR(network, expandAll);
          console.log(`📡 Parsed CIDR ${network}: ${ips.length} IPs`);
          ips.forEach(ip => {
            if (!subjects.includes(ip)) {
              subjects.push(ip);
            }
          });
        } catch (e) {
          console.warn(`⚠️  Invalid CIDR format: ${network}, skipping...`);
          console.warn(`   Error: ${e.message}`);
        }
      } else {
        // 单个 IP 地址
        if (!subjects.includes(network)) {
          subjects.push(network);
        }
      }
    }
  }

  // 6. 自动检测局域网 IP（如果环境变量未设置）
  if (!localNetwork) {
    const autoIPs = getLocalIPs();
    console.log(`🔍 Auto-detected local IPs: ${autoIPs.join(", ")}`);
    autoIPs.forEach(ip => {
      if (!subjects.includes(ip)) {
        subjects.push(ip);
      }
    });
  }

  return subjects;
}

// 确保证书目录存在
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
}

// 检查是否需要重新生成证书
const forceRegenerate = process.env.FORCE_REGENERATE_CERT === "true";
const certExists = fs.existsSync(sslKey) && fs.existsSync(sslCert);

if (!certExists || forceRegenerate) {
  try {
    const subjects = buildCertSubjects();

    // 检查证书大小（mkcert 对证书大小有限制）
    if (subjects.length > 100) {
      console.warn(`⚠️  Warning: Certificate will contain ${subjects.length} subjects.`);
      console.warn(`   Large certificates may cause issues. Consider using EXPAND_NETWORK_ALL=false`);
    }

    // 构建 mkcert 命令
    // mkcert 支持同时指定多个域名和 IP，用空格分隔
    const subjectsStr = subjects.map(s => `"${s}"`).join(" ");
    const command = `mkcert -cert-file ${sslDir}/public.cert -key-file ${sslDir}/private.key ${subjectsStr} && mkcert -install`;

    console.log("🔒 Generating SSL certificate with the following subjects:");
    console.log(`   Total: ${subjects.length} subjects`);
    if (subjects.length <= 20) {
      subjects.forEach(subject => {
        console.log(`   - ${subject}`);
      });
    } else {
      // 只显示前 10 个和后 10 个
      subjects.slice(0, 10).forEach(subject => {
        console.log(`   - ${subject}`);
      });
      console.log(`   ... (${subjects.length - 20} more) ...`);
      subjects.slice(-10).forEach(subject => {
        console.log(`   - ${subject}`);
      });
    }
    console.log("");

    exec(command, { stdio: "inherit" });

    console.log("");
    console.log("✅ Local SSL certificate created successfully");
    console.log(`📁 Certificate location: ${sslCert}`);
    console.log(`📁 Private key location: ${sslKey}`);

    if (forceRegenerate) {
      console.log("");
      console.log("⚠️  Certificate was force regenerated. You may need to:");
      console.log("   1. Clear browser HSTS cache (chrome://net-internals/#hsts)");
      console.log("   2. Restart the Outline server");
    }
  } catch (e) {
    console.error("❌ SSL certificates could not be generated.");
    console.error("   Ensure mkcert is installed and in your PATH");
    console.error("   Install: https://github.com/FiloSottile/mkcert#installation");
    console.error("");
    console.error("Error details:");
    console.error(e.message);
    process.exit(1);
  }
} else {
  console.log("✅ SSL certificates already exist");
  console.log(`📁 Certificate: ${sslCert}`);
  console.log(`📁 Private key: ${sslKey}`);
  console.log("");
  console.log("💡 To regenerate, set FORCE_REGENERATE_CERT=true and run again");
  console.log("💡 To include network ranges, set LOCAL_NETWORK=192.168.0.0/16");
}
