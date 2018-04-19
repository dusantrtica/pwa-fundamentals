const counts = {
	installs: 0,
	activations: 0,
	fetches: 0
}

self.addEventListener('install', (event) => {
	console.log('instal', ++counts.installs)
})

self.addEventListener('activate', (event) => {
	console.log('activate ', ++counts.activations)
})

self.addEventListener('fetch', (event) => {
	console.log('fetch ', ++counts.fetches)
})
