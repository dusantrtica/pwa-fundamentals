import { precacheStaticAssets, removeUnusedCaches, ALL_CACHES, ALL_CACHES_LIST } from './sw/caches.js';

const FALLBACK_IMAGE_URL = 'https://localhost:3100/images/fallback-grocery.png';

const ASSET_MANIFEST_URL = 'https://localhost:3000/asset-manifest.json';

const INDEX_HTML_PATH = '/';
const INDEX_HTML_URL = new URL(INDEX_HTML_PATH, self.location).toString();

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

function fetchImageWithFallback (fetchEvent) {
	return caches.open(ALL_CACHES.fallback).then((cache) => {
		return fetch(fetchEvent.request, { mode: 'cors', credentials: 'omit'})
		.then((response) => {
			if(!response.ok) {
				return cache.match(FALLBACK_IMAGE_URL)
			} else {
				let clonedResponse = response.clone();
				// cache.put - optimalnije, cache.add ce da
				// mozda opali fetch opet
				cache.put(fetchEvent.request, clonedResponse);
				return response;
			}
		})
		.catch(() => {
			return cache.match(fetchEvent.request)
		})
	})
}

function fetchApiDataWithFallback (fetchEvent) {
	return caches.open(ALL_CACHES.fallback).then((cache) => {
		return fetch(fetchEvent.request).then(response => {
			// clone repsonse so we can return one and store one
			let clonedResponse = response.clone();
			// cache.put - optimalnije, cache.add ce da
			// mozda opali fetch opet
			cache.put(fetchEvent.request, clonedResponse);
			return response;
		})
		.catch(() => {
			return cache.match(fetchEvent.request);
		})
	})
}

self.addEventListener('fetch', (event) => {
	let acceptHeader = event.request.headers.get('accept');
	let requestUrl = new URL(event.request.url)

	let isGroceryImage = acceptHeader.indexOf('image/*') >= 0 && requestUrl.pathname.indexOf('/images/') === 0;
	let isFromApi = requestUrl.origin.indexOf('localhost:3100') >= 0;
	let isHTMLRequest = event.request.headers.get('accept').indexOf('text/html') !== -1;
	let isLocal = new URL(event.request.url).origin === location.origin;

	if (isHTMLRequest && isLocal) {
		event.respondWith(
			fetch(event.request)
			.catch(() => {
				return caches.match(INDEX_HTML_URL, {cacheName: ALL_CACHES.prefetch})				
			})
		)
	}

	event.respondWith(
		caches.match(event.request, {cacheName:ALL_CACHES.prefetch}).then((response) => {
			if (response) {
				return response;
			}

			if (isGroceryImage) {
				return fetchImageWithFallback(event);
				// return fetchImageOrFallback(event)
			} else if (isFromApi) {
				return fetchApiDataWithFallback(event);
			}

			return fetch(event.request)
		})
	)
})
