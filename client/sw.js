const FALLBACK_IMAGE_URL = 'https://localhost:3100/images/fallback-grocery.png';

const fallbackImages = 'fallback-images';


self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(fallbackImages)
			.then(cache => {
				cache.add(FALLBACK_IMAGE_URL);
			})
	)
})

self.addEventListener('activate', (event) => {

})

function fetchImageOrFallback (fetchEvent) {
	return fetch(fetchEvent.request, {
		mode: 'no-cors'
	}).then(({ response }) => {
		if(!response.ok) {
			return caches.match(FALLBACK_IMAGE_URL, {cacheName: fallbackImages})
		} else {
			return response
		}
	}).catch(() => {
		return caches.match(FALLBACK_IMAGE_URL, {cacheName: fallbackImages})
	})
}

self.addEventListener('fetch', (event) => {

})
