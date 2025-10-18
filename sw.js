const CACHE_NAME = 'kpkp-timer-v1.2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/script.js',
  // 音声ファイルはユーザーが追加するため、動的キャッシュで対応
  // '/music/',
  // '/sounds/',
  // '/images/',
];

// インストール時
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('Cache installation failed:', error);
      })
  );
  // 新しいService Workerを即座にアクティブにする
  self.skipWaiting();
});

// アクティベート時
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // 古いキャッシュを削除
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 全てのクライアントを即座に制御下に置く
  self.clients.claim();
});

// フェッチ時のキャッシュ戦略
self.addEventListener('fetch', function(event) {
  // GETリクエストのみキャッシュ対象
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // キャッシュにあればそれを返す
        if (response) {
          console.log('Cache hit for:', event.request.url);
          return response;
        }

        // ネットワークから取得を試みる
        return fetch(event.request).then(function(response) {
          // レスポンスが有効でない場合はそのまま返す
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // レスポンスをクローンしてキャッシュに保存
          const responseToCache = response.clone();
          
          // 音声ファイルや画像ファイルは動的にキャッシュに追加
          const url = event.request.url;
          if (url.includes('/music/') || 
              url.includes('/sounds/') || 
              url.includes('/images/') ||
              url.endsWith('.mp3') ||
              url.endsWith('.wav') ||
              url.endsWith('.ogg') ||
              url.endsWith('.m4a') ||
              url.endsWith('.png') ||
              url.endsWith('.jpg') ||
              url.endsWith('.jpeg') ||
              url.endsWith('.gif') ||
              url.endsWith('.webp')) {
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                console.log('Caching media file:', url);
                cache.put(event.request, responseToCache);
              })
              .catch(function(error) {
                console.error('Failed to cache media file:', error);
              });
          }

          return response;
        }).catch(function(error) {
          console.error('Fetch failed:', error);
          
          // オフライン時のフォールバック
          // HTMLファイルの場合は、キャッシュされたindex.htmlを返す
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
          
          // その他のリソースの場合はエラーをそのまま返す
          throw error;
        });
      })
  );
});

// バックグラウンド同期（将来的な拡張用）
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    // 必要に応じてバックグラウンド処理を実装
  }
});

// プッシュ通知（タイマー完了通知用）
self.addEventListener('push', function(event) {
  console.log('Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'タイマーが完了しました',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'アプリを開く',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: '閉じる'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('KPKP-Timer', options)
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received.');

  event.notification.close();

  if (event.action === 'explore') {
    // アプリを開く
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // 何もしない（通知は既に閉じられている）
  } else {
    // デフォルトアクション: アプリを開く
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// メッセージ受信（アプリからService Workerへの通信）
self.addEventListener('message', function(event) {
  console.log('Message received in Service Worker:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({version: CACHE_NAME});
  }
});