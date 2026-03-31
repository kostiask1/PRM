const CACHE_NAME = 'prm-api-cache-v1';
const EXTERNAL_APIS = [
  'https://www.dnd5eapi.co/api',
  'https://api.open5e.com'
];

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

// Допоміжна функція для очищення заголовків при створенні "синтетичних" відповідей
function getCleanHeaders(originalHeaders) {
  const cleanHeaders = new Headers();
  const safeHeaders = ['content-type', 'cache-control', 'expires'];
  safeHeaders.forEach(h => {
    if (originalHeaders.has(h)) cleanHeaders.append(h, originalHeaders.get(h));
  });
  cleanHeaders.append('sw-fetched-on', Date.now().toString());
  return cleanHeaders;
}

self.addEventListener('install', () => {
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
            const isFresh = fetchedAt && (Date.now() - parseInt(fetchedAt) < ONE_WEEK);

            // Якщо це "заглушка" зі списку (немає опису), а ми хочемо деталі - ігноруємо кеш
            const isStub = await cachedResponse.clone().json().then(data => !data.desc).catch(() => true);

            if (isFresh && !url.includes('/api/2014/spells/')) {
              return cachedResponse;
            }
            // Для конкретних заклинань повертаємо кеш лише якщо це не порожня заглушка
            if (isFresh && url.includes('/api/2014/spells/') && !isStub) {
              return cachedResponse;
            }
          }

          return fetch(event.request).then((networkResponse) => {
            if (!networkResponse.ok) return networkResponse;

            const headers = getCleanHeaders(networkResponse.headers);
            const responseToCache = new Response(networkResponse.clone().body, {
              status: networkResponse.status,
              headers: headers
            });

            cache.put(event.request, responseToCache);

            // Розбиття списку заклинань
            if (url.includes('api.open5e.com/spells') && !url.split('/').pop().includes('-')) {
              networkResponse.clone().json().then(data => {
                if (data.results) {
                  data.results.forEach(spell => {
                    const spellUrl = `https://www.dnd5eapi.co/api/2014/spells/${spell.slug}`;
                    // Важливо: для заглушок не копіюємо всі заголовки мережі
                    const stubHeaders = new Headers();
                    stubHeaders.append('content-type', 'application/json');
                    stubHeaders.append('sw-fetched-on', Date.now().toString());
                    cache.put(spellUrl, new Response(JSON.stringify(spell), { headers: stubHeaders }));
                  });
                }
              }).catch(() => { });
            }

            return networkResponse;
          }).catch(() => cachedResponse || Response.error());
        });
      })
    );
  }
});