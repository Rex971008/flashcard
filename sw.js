// 版本號已更新為 v6，確保所有使用者都能獲得最新版本
const CACHE_NAME = 'flashcard-cache-v6'; 

// 應用程式的核心檔案 (App Shell)
const APP_SHELL_URLS = [
  './flashcard.html',
  './',
  './style.css',      // 請確認你的CSS檔名和路徑
  './script.js',      // 請確認你的JS檔名和路徑
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png',
  './cardholder/index.json' // 快取索引檔本身
];

// 安裝 Service Worker：快取 App Shell 和所有單字卡資料
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  // 使用 async/await 讓邏輯更清晰
  const precacheResources = async () => {
    // 1. 打開快取
    const cache = await caches.open(CACHE_NAME);
    
    // 2. 快取核心 App Shell
    console.log('[Service Worker] Caching App Shell...');
    await cache.addAll(APP_SHELL_URLS);

    // 3. 獲取單字卡列表並快取所有單字卡 JSON 檔案
    console.log('[Service Worker] Fetching and caching data files...');
    try {
      const response = await fetch('./cardholder/index.json');
      if (!response.ok) {
        throw new Error('Failed to fetch cardholder index.');
      }
      const dataFilenames = await response.json();
      
      // 將檔名轉換為完整的相對路徑
      const dataUrls = dataFilenames.map(filename => `./cardholder/${filename}`);
      
      console.log('[Service Worker] Caching all vocabulary packs:', dataUrls);
      await cache.addAll(dataUrls);
      
      console.log('[Service Worker] All resources cached successfully!');
    } catch (error) {
      console.error('[Service Worker] Failed to cache data files:', error);
      // 即使資料快取失敗，也讓 Service Worker 安裝成功，至少 App Shell 可以離線使用
    }
  };

  event.waitUntil(precacheResources());
  self.skipWaiting(); // 強制新的 Service Worker 立即啟用
});


// 啟用時刪除舊快取
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating new Service Worker...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Old caches cleaned. Claiming clients.');
      return self.clients.claim(); // 立即控制所有客戶端
    })
  );
});

// 攔截網路請求，優先從快取提供 (此部分邏輯保持不變，依然非常重要)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 快取命中，直接回傳
        if (response) {
          return response;
        }

        // 快取未命中，從網路獲取，並存入快取
        return fetch(event.request).then(
          networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            // 網路和快取都失敗
            console.error(`[Service Worker] Fetch failed for ${event.request.url}:`, error);
            // 對於 HTML 導航請求，回退到主頁面
            if (event.request.mode === 'navigate') {
                return caches.match('./flashcard.html');
            }
            // 其他請求返回一個錯誤
            return new Response(null, { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});