/**
 * CashFlow - Zero-Dependency Local Web Server
 * Run with: node server.js
 * Automatically detects your Wi-Fi/LAN IP address so you can open on your HP/smartphone!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8'
};

function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function sendPlain(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/**
 * Validasi path: decode aman, tolak null byte, pastikan hasil resolve tetap
 * berada di dalam public directory (termasuk setelah symlink di-resolve).
 */
function resolvePublicPath(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch (error) {
    return null;
  }

  if (decoded.includes('\0')) return null;

  const candidate = path.resolve(PUBLIC_DIR, '.' + decoded);
  const relative = path.relative(PUBLIC_DIR, candidate);

  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;

  const segments = relative.split(path.sep).filter(Boolean);
  // Jangan sajikan source/config server maupun folder backend & backup.
  const blocked = new Set(['server.js', 'package.json', 'start.bat', '_backup', 'backend', 'test', '.github']);
  if (segments.some(segment => blocked.has(segment.toLowerCase()))) return null;
  if (segments.some(segment => segment.startsWith('.'))) return null;

  return candidate;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = parsedUrl.pathname;

  // API endpoint to get LAN IP for mobile
  if (reqPath === '/api/network-info') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      port: PORT,
      localIPs: getLocalIPAddresses()
    }));
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = resolvePublicPath(reqPath);
  if (!filePath) {
    sendPlain(res, 403, '403 Forbidden');
    return;
  }

  fs.realpath(filePath, (realErr, realPath) => {
    if (realErr) {
      sendPlain(res, 404, '404 File Not Found');
      return;
    }

    const realRelative = path.relative(PUBLIC_DIR, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      sendPlain(res, 403, '403 Forbidden');
      return;
    }

    fs.stat(realPath, (err, stats) => {
      if (err || !stats.isFile()) {
        sendPlain(res, 404, '404 File Not Found');
        return;
      }

      const ext = path.extname(realPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(realPath);
      stream.on('error', () => sendPlain(res, 500, '500 Internal Server Error'));
      stream.pipe(res);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPAddresses();
  console.log('\n=============================================================');
  console.log('   🚀 CashFlow Web App Berhasil Berjalan!');
  console.log('=============================================================');
  console.log(`   💻 Buka di Laptop / Desktop : http://localhost:${PORT}`);
  if (localIPs.length > 0) {
    localIPs.forEach(ip => {
      console.log(`   📱 Buka di HP (Wi-Fi sama)  : http://${ip}:${PORT}`);
    });
  } else {
    console.log(`   📱 Buka di HP               : Hubungkan laptop & HP ke Wi-Fi yang sama`);
  }
  console.log('=============================================================');
  console.log('   💡 Tips HP: Tekan menu browser lalu pilih "Tambahkan ke');
  console.log('      Layar Utama" (Add to Home Screen) untuk dijadikan aplikasi!');
  console.log('=============================================================\n');

  // Automatically open browser on Windows
  if (process.platform === 'win32' && !process.env.CI) {
    exec(`start http://localhost:${PORT}`, (err) => {
      if (err) console.log('Silakan buka browser manual di: http://localhost:' + PORT);
    });
  }
});
