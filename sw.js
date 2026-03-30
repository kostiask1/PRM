const CACHE_NAME = 'prm-api-cache-v1';
const EXTERNAL_APIS = [
  'https://www.dnd5eapi.co/api',
  'https://api.open5e.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isExternalApi = EXTERNAL_APIS.some(api => url.startsWith(api));

  if (isExternalApi && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchedResponse = fetch(event.request).then((networkResponse) => {
            // Оновлюємо кеш новою відповіддю
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Якщо мережа недоступна, повертаємо те, що в кеші
            return cachedResponse;
          });

          // Повертаємо кешовану відповідь негайно, або чекаємо на запит
          return cachedResponse || fetchedResponse;
        });
      })
    );
  }
});