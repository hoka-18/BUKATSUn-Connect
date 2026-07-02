// 📅 キャッシュの名前（アプリを更新したときに変更するバージョン。v1からv2に変更）
const CACHE_NAME = 'bukatsun-cache-v2';

// オフラインでもアプリの画面を開けるように、端末に一時保存（キャッシュ）するファイル
const ASSETS_TO_CACHE = [
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Service Worker のインストール時にファイルを保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('PWA: 必要なファイルを端末にキャッシュ中...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 古くなった古いキャッシュを自動削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('PWA: 古いキャッシュをクリーンアップしました:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// アプリ起動時の読み込み処理（ネットワークが遅くてもキャッシュから爆速で開く）
self.addEventListener('fetch', (event) => {
  // ⚠️ Firebaseのリアルタイム通信（Firestore）はキャッシュせず、常に最新情報を取得する
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // 保存されたデータがあればそれを表示
      }
      return fetch(event.request); // なければネットから取得
    })
  );
});