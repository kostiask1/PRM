const CACHE_NAME = "prm-api-cache-v1";
const CACHED_API_PATHS = ["/api/bestiary", "/api/spells"];

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

function getCleanHeaders(originalHeaders) {
	const cleanHeaders = new Headers();
	const safeHeaders = ["content-type", "cache-control", "expires"];
	safeHeaders.forEach((headerName) => {
		if (originalHeaders.has(headerName)) {
			cleanHeaders.append(headerName, originalHeaders.get(headerName));
		}
	});
	cleanHeaders.append("sw-fetched-on", Date.now().toString());
	return cleanHeaders;
}

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
	const url = event.request.url;
	const isTargetApi =
		CACHED_API_PATHS.some((path) => url.includes(path)) &&
		!url.includes("/favorites");

	if (isTargetApi && event.request.method === "GET") {
		event.respondWith(
			caches.open(CACHE_NAME).then((cache) => {
				return cache.match(event.request).then(async (cachedResponse) => {
					if (cachedResponse) {
						const fetchedAt = cachedResponse.headers.get("sw-fetched-on");
						const isFresh =
							fetchedAt && Date.now() - parseInt(fetchedAt, 10) < ONE_WEEK;

						const isStub = await cachedResponse
							.clone()
							.json()
							.then((data) => !data.desc)
							.catch(() => true);

						if (isFresh && !url.includes("/virtual/spells/")) {
							return cachedResponse;
						}

						if (isFresh && url.includes("/virtual/spells/") && !isStub) {
							return cachedResponse;
						}
					}

					return fetch(event.request)
						.then((networkResponse) => {
							if (!networkResponse.ok) return networkResponse;

							const headers = getCleanHeaders(networkResponse.headers);
							const responseToCache = new Response(networkResponse.clone().body, {
								status: networkResponse.status,
								headers,
							});

							cache.put(event.request, responseToCache);

							if (url.includes("/api/bestiary/") && !url.includes("/sources")) {
								networkResponse
									.clone()
									.json()
									.then((data) => {
										const monsters = Array.isArray(data)
											? data
											: data.results || [];
										if (monsters.length > 0) {
											monsters.forEach((monster) => {
												const identifier = monster.slug || monster.name;
												const monsterUrl = `${new URL(url).origin}/api/bestiary/virtual/${encodeURIComponent(identifier)}`;
												const stubHeaders = new Headers();
												stubHeaders.append(
													"content-type",
													"application/json",
												);
												stubHeaders.append(
													"sw-fetched-on",
													Date.now().toString(),
												);

												cache.put(
													monsterUrl,
													new Response(JSON.stringify(monster), {
														headers: stubHeaders,
													}),
												);
											});
										}
									})
									.catch(() => {});
							}

							if (
								url.includes("/api/spells/") &&
								!url.includes("/sources") &&
								!url.includes("/search")
							) {
								networkResponse
									.clone()
									.json()
									.then((data) => {
										const spells = Array.isArray(data)
											? data
											: data.spell || data.spells || data.results || [];
										if (spells.length > 0) {
											spells.forEach((spell) => {
												const slug = (spell.slug || spell.name)
													.toLowerCase()
													.replace(/[^\p{L}\p{N}]+/gu, "-")
													.replace(/^-+|-+$/g, "");
												const spellUrl = `${new URL(url).origin}/api/spells/virtual/${slug}`;
												const stubHeaders = new Headers();
												stubHeaders.append(
													"content-type",
													"application/json",
												);
												stubHeaders.append(
													"sw-fetched-on",
													Date.now().toString(),
												);

												cache.put(
													spellUrl,
													new Response(JSON.stringify(spell), {
														headers: stubHeaders,
													}),
												);
											});
										}
									})
									.catch(() => {});
							}

							return networkResponse;
						})
						.catch(() => cachedResponse || Response.error());
				});
			}),
		);
	}
});
