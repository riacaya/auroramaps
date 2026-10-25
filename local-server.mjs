#!/usr/bin/env node
/**
 * local-server.mjs — server statis + proxy lokal AuroraMaps (untuk PC/localhost).
 *
 * Jalankan:
 *   node local-server.mjs              → http://127.0.0.1:8321
 *   PORT=9000 node local-server.mjs    → ganti port
 *
 * Kenapa perlu proxy:
 *   WAF bhumi.atrbpn.go.id & gistaru-app.atrbpn.go.id hanya menerima request
 *   dengan Referer: https://bhumi.atrbpn.go.id/ (403 "Akses ditolak" tanpa itu).
 *   Browser TIDAK bisa mengubah Referer (selalu origin halaman) → tile/GFI harus
 *   lewat proxy server-side. Di PC lokal, proxy Cloudflare Worker TIDAK bisa
 *   dipakai untuk rute /gistaru (server gistaru tidak terjangkau dari jaringan
 *   cloud → 522), jadi proxy lokal inilah yang dipakai saat app dibuka dari
 *   http://127.0.0.1:8321 (lihat AtrbpnLayers._resolveBhumiBase).
 *
 * Rute:
 *   /bhumi-proxy/gistaru/<path>  → https://gistaru-app.atrbpn.go.id/<path>
 *   /bhumi-proxy/<path>          → https://bhumi.atrbpn.go.id/<path>
 *   selain itu                   → file statis dari root proyek
 *
 * Referer/Origin selalu diganti ke https://bhumi.atrbpn.go.id/ , CORS dibuka
 * (*), preflight OPTIONS dijawab 204, dan GET/HEAD/POST diteruskan apa adanya
 * (termasuk body JSON untuk /expapi/getPersil dll).
 * Hanya memakai modul bawaan Node — tanpa dependensi.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Anggap PORT kosong/0/invalid sebagai 8321 (0 = port acak, tidak diinginkan).
const PORT = Number(process.env.PORT) || 8321;
const HOST = process.env.HOST || '127.0.0.1';

const BHUMI_ORIGIN = 'https://bhumi.atrbpn.go.id';
const GISTARU_BASE = 'https://gistaru-app.atrbpn.go.id';
const PROXY_PREFIX = '/bhumi-proxy';
const GISTARU_PREFIX = PROXY_PREFIX + '/gistaru';
const UPSTREAM_TIMEOUT = 45000; // tile gistaru bisa 3-15 dtk dari PC

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
};

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

// ── DNS tahan-gagal ───────────────────────────────────────────────────
// Resolver lokal (router 192.168.0.1 / ISP) SERING gagal resolve
// *.atrbpn.go.id — ENOTFOUND/EAI_AGAIN walau via 8.8.8.8 resolvable.
// Akibatnya tiap tile gistaru langsung 502 dan layer RTR kosong/RTRW pindah
// ke sumber cadangan. Solusi: cache IP per-host (TTL 10 menit), bila resolver
// lokal gagal jatuh ke resolver publik, dan bila semuanya gagal pakai IP lama
// (stale) supaya tile tetap tampil selama DNS pulih.
const DNS_TTL_MS = 10 * 60 * 1000;
const FALLBACK_DNS = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];
const dnsCache = new Map(); // hostname → { ip, at }
const fallbackResolver = new dns.Resolver({ timeout: 3000, tries: 1 });
fallbackResolver.setServers(FALLBACK_DNS);

// Ambil IP pertama dari hasil dns.lookup: all:true → array (string ATAU
// objek {address, family} tergantung versi Node) — tetap sederhana di sini.
const firstIp = (addr) => {
  const a = Array.isArray(addr) ? addr[0] : addr;
  return (a && typeof a === 'object') ? a.address : a;
};

function cachedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  // Node (autoSelectFamily, bawaan ≥20) memanggil lookup dengan all:true dan
  // mengharapkan BALASAN ARRAY [{address, family}] — membalas string bikin
  // semua request gagal "Invalid IP address: undefined" (bug teruji 22 Okt).
  const all = !!(options && options.all);
  const done = (ip) => {
    if (all) callback(null, [{ address: ip, family: 4 }]);
    else callback(null, ip, 4);
  };
  const hit = dnsCache.get(hostname);
  if (hit && hit.ip && Date.now() - hit.at < DNS_TTL_MS) return done(hit.ip);
  // Cache/pin IPv4 hanya untuk permintaan keluarga inet biasa (0/unspecified/4).
  const canPin = !options || !options.family || options.family === 0 || options.family === 4;
  dns.lookup(hostname, options, (err, address, family) => {
    if (!err && firstIp(address)) {
      if (!canPin) return callback(null, address, family);
      const ip = firstIp(address);
      dnsCache.set(hostname, { ip, at: Date.now() });
      return done(ip);
    }
    if (!canPin) return callback(err || new Error('resolve gagal'));
    fallbackResolver.resolve4(hostname, (err2, addrs) => {
      if (!err2 && addrs && addrs.length) {
        dnsCache.set(hostname, { ip: addrs[0], at: Date.now() });
        log(`DNS lokal gagal (${(err && err.code) || (err && err.message)}) untuk ${hostname} → fallback ${FALLBACK_DNS[0]} = ${addrs[0]}`);
        return done(addrs[0]);
      }
      // Semua resolver gagal → pakai IP lama bila ada (stale-while-recover).
      if (hit && hit.ip) {
        log(`DNS gagal total untuk ${hostname}, pakai IP lama ${hit.ip}`);
        return done(hit.ip);
      }
      callback(err || err2);
    });
  });
}

// ── Proxy ────────────────────────────────────────────────────────────────
function proxy(req, res, upstreamOrigin, upstreamPath, attempt = 0) {
  let target;
  try {
    target = new URL(upstreamPath, upstreamOrigin);
  } catch (e) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('URL tidak valid: ' + upstreamPath);
  }

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }
  headers.host = target.host;
  // WAF: WAJIB Referer/Origin bhumi (tanpa ini 403 "Akses ditolak").
  headers.referer = BHUMI_ORIGIN + '/';
  headers.origin = BHUMI_ORIGIN;
  // WAF bhumi juga menolak UA non-browser (mis. "curl/8.x" → 403 146 B).
  // Klien browser diteruskan apa adanya; klien tanpa UA / non-browser
  // (curl, skrip uji) memakai UA Chrome supaya tidak salah dianggap bot.
  const ua = req.headers['user-agent'] || '';
  const browserUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
  headers['user-agent'] = /^Mozilla\//i.test(ua) ? ua : browserUa;
  // Minta balasan tanpa kompresi supaya tidak ada salah baca content-encoding.
  delete headers['accept-encoding'];

  const started = Date.now();
  const up = https.request(target, {
    method: req.method,
    headers,
    timeout: UPSTREAM_TIMEOUT,
    lookup: cachedLookup, // tahan-gagal-resolve (lihat DNS_CACHE di atas)
  }, (upRes) => {
    const out = {};
    for (const [k, v] of Object.entries(upRes.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) out[k] = v;
    }
    res.writeHead(upRes.statusCode, { ...out, ...CORS });
    upRes.pipe(res);
    log(`${req.method} ${target.host}${target.pathname} → ${upRes.statusCode} ${Date.now() - started}ms`);
  });

  up.on('timeout', () => up.destroy(new Error('timeout ' + UPSTREAM_TIMEOUT + 'ms')));
  up.on('error', (err) => {
    if (res.headersSent) return res.destroy();
    // Gagal resolve (sering terjadi karena DNS lokal labil) → buang cache,
    // coba sekali lagi; GET/HEAD tanpa body aman untuk diulang.
    const dnsFail = err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN');
    if (dnsFail && attempt === 0 && (req.method === 'GET' || req.method === 'HEAD')) {
      dnsCache.delete(target.hostname);
      log(`${req.method} ${target.host}${target.pathname} → DNS ${err.code}, ulangi sekali`);
      return setTimeout(() => proxy(req, res, upstreamOrigin, upstreamPath, attempt + 1), 800);
    }
    res.writeHead(502, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Proxy gagal: ' + err.message);
    log(`${req.method} ${target.host}${target.pathname} → ERROR ${err.message}`);
  });

  // GET/HEAD tanpa body: langsung tutup permintaan (pipe tetap dipakai untuk
  // POST supaya body JSON ikut diteruskan).
  if (req.method === 'GET' || req.method === 'HEAD') up.end();
  else req.pipe(up);
}

// ── File statis ──────────────────────────────────────────────────────────
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.normalize(path.join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403');
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 ' + rel);
    }
    const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(abs).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const rest = () => {
    if (pathname === PROXY_PREFIX || pathname === PROXY_PREFIX + '/') {
      res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('AuroraMaps local proxy OK\n/bhumi-proxy/*      → bhumi.atrbpn.go.id\n/bhumi-proxy/gistaru/* → gistaru-app.atrbpn.go.id\n');
    }
    if (pathname === GISTARU_PREFIX || pathname.startsWith(GISTARU_PREFIX + '/')) {
      const p = pathname.slice(GISTARU_PREFIX.length) || '/';
      const qs = req.url.slice(req.url.indexOf('?')); // sisakan query apa adanya
      return proxy(req, res, GISTARU_BASE, p + (qs[0] === '?' ? qs : ''));
    }
    if (pathname === PROXY_PREFIX || pathname.startsWith(PROXY_PREFIX + '/')) {
      const p = pathname.slice(PROXY_PREFIX.length) || '/';
      const qs = req.url.slice(req.url.indexOf('?'));
      return proxy(req, res, BHUMI_ORIGIN, p + (qs[0] === '?' ? qs : ''));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('405');
    }
    serveStatic(req, res, pathname);
  };

  rest();
});

server.listen(PORT, HOST, () => {
  log(`AuroraMaps local server → http://${HOST}:${PORT}/`);
  log(`proxy bhumi   → ${PROXY_PREFIX}/*`);
  log(`proxy gistaru → ${GISTARU_PREFIX}/*`);
});
