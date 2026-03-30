const CACHE_NAME = 'prm-api-cache-v1';
const EXTERNAL_APIS = [
  'https://www.dnd5eapi.co/api',
  'https://api.open5e.com'
];

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

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
        return cache.match(event.request).then(async (cachedResponse) => {
          if (cachedResponse) {
            const fetchedAt = cachedResponse.headers.get('sw-fetched-on');
            if (fetchedAt && (Date.now() - parseInt(fetchedAt) < ONE_WEEK)) {
              return cachedResponse;
            }
          }

          try {
            const networkResponse = await fetch(event.request);
            if (networkResponse.ok) {
              const headers = new Headers(networkResponse.headers);
              headers.append('sw-fetched-on', Date.now().toString());

              const responseToCache = new Response(networkResponse.clone().body, {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers: headers
              });

              cache.put(event.request, responseToCache);
              
              // Додаткова логіка: якщо ми отримали список заклинань, 
              // ми могли б парсити їх тут, але dnd5eapi не дає повних даних у списку.
            }
            return networkResponse;
          } catch (error) {
            return cachedResponse || Response.error();
          }
        });
      })
    );
  }
});