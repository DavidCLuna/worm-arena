// WormArena - servidor: HTTP estático + WebSocket + loop de simulación
const http = require('http');
const fs = require('fs');
const path = require('path');
const C = require('../shared/constants.js');
const Rooms = require('./rooms.js');
const setupNet = require('./net.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/client/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const rooms = new Rooms();
const net = setupNet(server, rooms);

// Loop de simulación a TICK_RATE Hz
const dt = 1 / C.TICK_RATE;
setInterval(() => {
  const now = Date.now();
  rooms.tick(dt, now);
  net.broadcast(now);
}, 1000 / C.TICK_RATE);

server.listen(PORT, () => {
  console.log(`\n  🐛 WormArena corriendo en http://localhost:${PORT}\n`);
});
