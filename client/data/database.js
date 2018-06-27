import idb from 'idb';

const cartDb = () => {
	return idb.open('cart-store', 1, upgradeDb => {
		switch(upgradeDb.oldVersion) {
		case 0: upgradeDb.createObjectStore('cart', {keyPath: 'id'});
		}
	})
}

export const putItemToCart = (item) => {
	return cartDb().then(db => {
		const tx = db.transaction('cart', 'readwrite');
		tx.objectStore('cart').put({...item, unsynced: true});
		return tx.complete;
	})
}

export const deleteItem = (id) => {
	return cartDb().then(db => {
		const tx = db.transaction('cart', 'readwrite');
		tx.objectStore('cart').delete(id);
		return tx.complete;
	})
}

export const clearCart = () => {
	return cartDb().then(db => {
		const tx = db.transaction('cart', 'readwrite');
		tx.objectStore('cart').clear();
		return tx.complete;
	})
}

export const getItem = (id) => {
	return cartDb().then(db => {
		return db.transaction('cart').objectStore('cart').get(id);
	})
}

export const getAllCartItems = () => {
	return cartDb().then(db => {
		return db.transaction('cart').objectStore('cart').getAllKeys().then(keys => {
			return Promise.all(keys.map(id => getItem(id).then(content => ({
				id,
				...content
			}))))
		})
	})
}
