import idb from 'idb';
import { precacheStaticAssets, removeUnusedCaches, ALL_CACHES, ALL_CACHES_LIST } from './sw/caches.js';
import {putItemToCart, getAllCartItems} from './data/database';
const FALLBACK_IMAGE_URL = 'https://localhost:3100/images/fallback-grocery.png';
const FALLBACK_IMAGE_URLS = [
	'https://localhost:3100/images/fallback-grocery.png',
	'https://localhost:3100/images/fallback-bakery.png',
	'https://localhost:3100/images/fallback-dairy.png',
	'https://localhost:3100/images/fallback-frozen.png',
	'https://localhost:3100/images/fallback-fruit.png',
	'https://localhost:3100/images/fallback-herbs.png',
	'https://localhost:3100/images/fallback-meat.png',
	'https://localhost:3100/images/fallback-vegetables.png',
]

const ASSET_MANIFEST_URL = 'https://localhost:3000/asset-manifest.json';

const INDEX_HTML_PATH = '/';
const INDEX_HTML_URL = new URL(INDEX_HTML_PATH, self.location).toString();

function groceryItemDb() {
	return idb.open('groceryitem-store', 1, upgradeDb => {
		switch(upgradeDb.oldVersion) {
			case 0:
			upgradeDb.createObjectStore('grocery-items', {keyPath: 'id'})
		}
	})
}

function downloadGroceyItems() {
	return groceryItemDb().then(db => {
		fetch('https://localhost:3100/api/grocery/items?limit=999999')
		.then(response => response.json())
		.then(({data: groceryItems}) => {
			let tx = db.transaction('grocery-items', 'readwrite');
			tx.objectStore('grocery-items').clear()
			tx.complete.then(() => {
				let txx = db.transaction('grocery-items', 'readwrite')
				groceryItems.forEach(groceryItem => {
					txx.objectStore('grocery-items').put(groceryItem);
				})
				return txx.complete;
			});
		})
	})
}

self.addEventListener('push', event => {
	let { data } = event;
	const text = data.text
	console.log('from push ', text);
	if (text === 'TERMINATE') {
		self.registration.unregister();
		console.log('Service worker terminated!');
		return;
	}
	let eventData = event.data.json();
	if('notification' in eventData) {
		let { notification } = eventData;
		self.registration.showNotification(
			notification.title,
			{
				body: notification.body,
				icon: 'https://localhost:3100/img/launche-icon-4x.png'
			}
		)
	}
})

self.addEventListener('install', (event) => {
	event.waitUntil(
		Promise.all([
			// get the fallback image
			caches.open(ALL_CACHES.fallbackImages)
				.then(cache => {
					cache.addAll(FALLBACK_IMAGE_URLS);
				}),
			// populate the precache stuff
			precacheStaticAssets(),
			// populate IndexedDb with grocery-items
			downloadGroceyItems()
		])
	)
})

self.addEventListener('activate', (event) => {
	self.registration.showNotification('hello!');
	event.waitUntil(removeUnusedCaches(ALL_CACHES_LIST))
})

self.addEventListener('sync', (event) => {
	debugger;
	console.log('attempting sync', event.tag);
	console.log('syncing', event.tag);

	event.waitUntil(
		getAllCartItems().then(cartItems => {
			console.log(cartItems);
			const unsynced = cartItems.filter(item => item.unsynced);
			return fetch('https://localhost:3100/api/cart/items', {
				method: 'PUT',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({data: unsynced})
			})
			.then(() => {
				return Promise.all(unsynced.map(unsyncedItem => {
					return putItemToCart({
						...unsyncedItem,
						unsynced: false
					})
				}))
			})
		})
	)
})

function fallbackImageForRequest(request) {
	let path = new URL(request.url).pathname;
	//  /iamges/123.png
	let itemId = parseInt(path.substr(path.lastIndexOf('/') + 1, path.lastIndexOf('.')), 10);
	return groceryItemDb().then(db => {
		return db
			.transaction('grocery-items')
			.objectStore('grocery-items')
			.get(itemId)
	}).then(groceryItem => {
		let { category } = groceryItem;
		return caches.match(`https://localhost:3100/images/fallback-${category.toLowerCase()}.png`)
	})
}

function fetchImageOrFallback (fetchEvent) {
	return fetch(fetchEvent.request, {
		mode: 'cors',
		credentials: 'omit' // to je za credentialed requests and wildcards
		// in case CORS wild cardd headers
	}).then((response) => {
		if(!response.ok) {
			return fallbackImageForRequest(fetchEvent.request);
		} else {
			return response
		}
	}).catch(() => {
		return fallbackImageForRequest(fetchEvent.request);
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
				// return fetchImageWithFallback(event);
				return fetchImageOrFallback(event)
			} else if (isFromApi) {
				return fetchApiDataWithFallback(event);
			}

			return fetch(event.request)
		})
	)
})
