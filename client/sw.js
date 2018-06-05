import { precacheStaticAssets, removeUnusedCaches, ALL_CACHES, ALL_CACHES_LIST } from './sw/caches.js';

const FALLBACK_IMAGE_URL = 'https://localhost:3100/images/fallback-grocery.png';

const ASSET_MANIFEST_URL = 'https://localhost:3000/asset-manifest.json';

self.addEventListener('install', (event) => {
	event.waitUntil(
		Promise.all([
			// get the fallback image
			caches.open(ALL_CACHES.fallbackImages)
				.then(cache => {
					cache.add(FALLBACK_IMAGE_URL);
				}),
			// populate the precache stuff
			precacheStaticAssets()
		])
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(removeUnusedCaches(ALL_CACHES_LIST))
})

function fetchImageOrFallback (fetchEvent) {
	return fetch(fetchEvent.request, {
		mode: 'cors',
		credentials: 'omit' // to je za credentialed requests and wildcards
		// in case CORS wild cardd headers
	}).then((response) => {
		if(!response.ok) {
			return caches.match(FALLBACK_IMAGE_URL, {cacheName: ALL_CACHES.fallbackImages})
		} else {
			return response
		}
	}).catch(() => {
		return caches.match(FALLBACK_IMAGE_URL, {cacheName: ALL_CACHES.fallbackImages})
	})
}

self.addEventListener('fetch', (event) => {
	let acceptHeader = event.request.headers.get('accept');
	let requestUrl = new URL(event.request.url)

	event.respondWith(
		caches.match(event.request, {cacheName:ALL_CACHES.prefetch}).then((response) => {
			if (response) {
				return response;
			}

			if (acceptHeader.indexOf('image/*') > -1) {
				if (requestUrl.pathname.indexOf('/images/')=== 0) {
					// event.respondWith(
					return fetchImageOrFallback(event)
					// )
				}
			}

			return fetch(event.request)
		})
	)
})
