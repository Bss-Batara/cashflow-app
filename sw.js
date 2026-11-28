/**
 * CashFlow — service worker.
 * Strategi:
 * - Navigasi (HTML): network-first, fallback cache saat offline.
 * - Aset statis: cache-first + perbarui cache di latar belakang.
 * - Request lintas-origin (Google Apps Script): dilewati sama sekali,
 *   supaya data keuangan tidak pernah disajikan dari cache.
 */
const CACHE_NAME = 'cashflow-static-v2';

const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/login.css',
  'js/api.js',
  'js/store.js',
  'js/charts.js',
  'js/auth.js',
  'js/app.js',
  'js/export-xlsx.js',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // biarkan GAS lewat jaringan

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) {
        fetch(request)
          .then(response => {
            if (response && response.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
          })
          .catch(() => { /* offline: pakai cache */ });
        return hit;
      }
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
