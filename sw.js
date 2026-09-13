/* グラトレ 仕入れ入力 — オフライン用 Service Worker（2026-09-13）
 * 画面のファイル（HTML / CSS / JS）だけを端末に保存し、電波がない場所でもアプリを開けるようにする。
 * 通信できるときは必ずネットの最新を使う（ネット優先。数秒で返ってこなければ保存分を出し、裏で最新に入れ替える）。
 * Apps Script（script.google.com）への通信や mock-data.js には一切触らない。
 * 困ったときは CACHE の名前を変えて push すれば、端末の保存分は入れ替わる。
 */
var CACHE = 'gtp-shell-v1';
var SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'app.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('gtp-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/mock-data\.js$/.test(url.pathname) || /sw\.js$/.test(url.pathname)) return;
  e.respondWith(networkFirst(req));
});

function networkFirst(req) {
  var isNav = req.mode === 'navigate';
  var net = fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { return store(c, req, copy); }).catch(function () { });
    }
    return res;
  });
  var slow = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, isNav ? 6000 : 8000); });
  return Promise.race([net.catch(function () { return null; }), slow]).then(function (res) {
    if (res) return res;
    return fromCache(req, isNav).then(function (cached) { return cached || net; });
  });
}

// 同じファイルの古い版（?v= 違い）は消してから保存する（端末に溜めない）
function store(c, req, res) {
  var path = new URL(req.url).pathname;
  return c.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { var u = new URL(k.url); return u.pathname === path && k.url !== req.url; }).map(function (k) { return c.delete(k); }));
  }).then(function () { return c.put(req, res); });
}

function fromCache(req, isNav) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (r) {
      if (r) return r;
      return c.match(req, { ignoreSearch: true }).then(function (r2) {
        if (r2 || !isNav) return r2;
        return c.match('./', { ignoreSearch: true }).then(function (r3) { return r3 || c.match('index.html', { ignoreSearch: true }); });
      });
    });
  });
}
