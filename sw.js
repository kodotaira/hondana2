/* 本棚 — オフラインでも本棚が開くようにする */
const VERSION = 'hondana-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 書誌データと書影は毎回ネットワークへ（キャッシュしない）
  if (/api\.openbd\.jp|googleapis\.com|rakuten\.co\.jp|ndlsearch\.ndl\.go\.jp/.test(url.hostname)) return;

  // バーコード読み取りのライブラリは一度取れたら使い回す
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(VERSION).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  // アプリ本体は「まずネットワーク、だめならキャッシュ」
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
