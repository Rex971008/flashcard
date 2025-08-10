// 版本號每次修改都會觸發 Service Worker 的更新 cycle
const CACHE_VERSION = 'v5-stable';
const APP_SHELL_CACHE_NAME = `flashcard-app-shell-${CACHE_VERSION}`;
const DYNAMIC_CONTENT_CACHE_NAME = `flashcard-dynamic-content-${CACHE_VERSION}`;
const CHROMA_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js';

// App Shell：應用程式的核心靜態資源
const APP_SHELL_URLS = [
  './flashcard.html',
  './', // 處理根目錄請求
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

// --- Service Worker 生命週期事件 ---

// 1. 安裝事件：預先快取 App Shell 和所有預設單字包
self.addEventListener('install', event => {
  console.log('[SW] Install Event Fired');
  event.waitUntil(
    (async () => {
      try {
        // 獲取單字包列表
        const response = await fetch('./cardholder/index.json');
        if (!response.ok) {
            throw new Error('Failed to fetch cardholder index.');
        }
        const deckFiles = await response.json();
        const deckUrls = deckFiles.map(file => `./cardholder/${file}`);
        
        // 將所有需要快取的 URL 合併
        const urlsToCache = [...APP_SHELL_URLS, './cardholder/index.json', CHROMA_CDN_URL, ...deckUrls];
        console.log('[SW] Caching the following URLs:', urlsToCache);

        const cache = await caches.open(APP_SHELL_CACHE_NAME);
        await cache.addAll(urlsToCache);
        console.log('[SW] App Shell and decks cached successfully.');
      } catch (error) {
        console.error('[SW] Caching failed during install:', error);
      }
    })()
  );
});

// 2. 啟用事件：清理舊版本的快取
self.addEventListener('activate', event => {
  console.log('[SW] Activate Event Fired');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 如果快取名稱不包含在當前的白名單中，就刪除它
          if (cacheName !== APP_SHELL_CACHE_NAME && cacheName !== DYNAMIC_CONTENT_CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // 立即控制所有客戶端，確保更新立即生效
        return self.clients.claim();
    })
  );
});

// 3. 攔截請求事件：實現 Stale-While-Revalidate 策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 對於 CDN 資源或我們的 API/單字包資源，採用 Stale-While-Revalidate
  if (url.href === CHROMA_CDN_URL || url.pathname.startsWith('/cardholder/')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CONTENT_CACHE_NAME));
  } 
  // 對於 App Shell 內的其他資源，也採用 Stale-While-Revalidate
  else if (APP_SHELL_URLS.some(path => url.pathname.endsWith(path.replace('./', '')))) {
    event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE_NAME));
  }
  // 對於其他非關鍵請求（例如用戶上傳的圖片），直接走網路
  else {
    return;
  }
});


// --- 快取策略函式 ---

/**
 * Stale-While-Revalidate 策略實作
 * @param {Request} request - 原始請求
 * @param {string} cacheName - 要使用的快取名稱
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponsePromise = await cache.match(request);

  // 在背景發起網路請求
  const networkResponsePromise = fetch(request).then(response => {
    // 如果請求成功，將新回應存入快取
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => {
    // 網路請求失敗時，靜默處理
    console.warn(`[SW] Network request for ${request.url} failed.`, err);
  });
  
  // 優先返回快取的回應，如果快取沒有，則等待網路回應
  return cachedResponsePromise || networkResponsePromise;
}