const CACHE_NAME = 'prm-api-cache-v1';
const CACHED_API_PATHS = [
  '/api/bestiary',
  '/api/spells'
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
  const isTargetApi = CACHED_API_PATHS.some(path => url.includes(path));

  if (isTargetApi && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then(async (cachedResponse) => {
          if (cachedResponse) {
            const fetchedAt = cachedResponse.headers.get('sw-fetched-on');
            const isFresh = fetchedAt && (Date.now() - parseInt(fetchedAt) < ONE_WEEK);

            // Якщо це "заглушка" зі списку (немає опису), а ми хочемо деталі - ігноруємо кеш
            const isStub = await cachedResponse.clone().json().then(data => !data.desc).catch(() => true);

            if (isFresh && !url.includes('/virtual/spells/')) {
              return cachedResponse;
            }
            // Для конкретних заклинань повертаємо кеш лише якщо це не порожня заглушка
            if (isFresh && url.includes('/virtual/spells/') && !isStub) {
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

            // Кешування локального бестіарію
            if (url.includes('/api/bestiary/') && !url.includes('/sources')) {
              networkResponse.clone().json().then(data => {
                const monsters = Array.isArray(data) ? data : (data.results || []);
                if (monsters.length > 0) {
                  monsters.forEach(monster => {
                    // Використовуємо name як ідентифікатор для кешу окремих монстрів
                    const identifier = monster.slug || monster.name;
                    const monsterUrl = `${new URL(url).origin}/api/bestiary/virtual/${encodeURIComponent(identifier)}`;
                    const stubHeaders = new Headers();
                    stubHeaders.append('content-type', 'application/json');
                    stubHeaders.append('sw-fetched-on', Date.now().toString());
                    
                    cache.put(monsterUrl, new Response(JSON.stringify(monster), { headers: stubHeaders }));
                  });
                }
              }).catch(() => { });
            }

            // Кешування локальних заклинань
            if (url.includes('/api/spells/') && !url.includes('/sources') && !url.includes('/search')) {
              networkResponse.clone().json().then(data => {
                const spells = Array.isArray(data) ? data : (data.spell || data.spells || data.results || []);
                if (spells.length > 0) {
                  spells.forEach(spell => {
                    const slug = (spell.slug || spell.name).toLowerCase()
                      .replace(/[^\p{L}\p{N}]+/gu, "-")
                      .replace(/^-+|-+$/g, "");
                    const spellUrl = `${new URL(url).origin}/api/spells/virtual/${slug}`;
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