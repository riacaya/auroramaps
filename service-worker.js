const CACHE_NAME = 'auroramaps-shell-v3';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './assets/auroramaps-192.png', './assets/auroramaps-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html'))));
    return;
  }
  // Cache modul aplikasi dan ikon saja; dataset desa berukuran besar tetap di jaringan.
  if (url.pathname.includes('/src/') || /\/assets\/auroramaps-(192|512)\.png$/.test(url.pathname) || url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => await caches.match(request)));
  }
});
