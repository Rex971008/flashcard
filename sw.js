// 版本號已更新為 v4，確保所有使用者都能獲得最新版本
const CACHE_NAME = 'flashcard-cache-v4'; 
const URLS_TO_CACHE = [
  './flashcard.html', // 明确缓存主文件
  './', // 缓存根目录以处理'/'请求
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png',
  './cardholder/index.json' // 将索引文件加入缓存
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