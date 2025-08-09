const CACHE_NAME = 'flashcard-cache-v2'; // 版本號v2，若未來更新HTML/CSS，請遞增此版本號
const URLS_TO_CACHE = [
  './', // 代表 index.html 或根目錄
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png'
];

// 安裝並快取檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// 攔截網路請求，優先從快取提供
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// 啟用時刪除舊快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});