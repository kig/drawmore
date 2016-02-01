"use strict";

var AppDBMixin = {};

AppDBMixin.initIndexedDB = function(callback, onerror) {
	// IndexedDB
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;

	var dbVersion = 5;

	if (!window.indexedDB) {
		onerror('No IndexedDB support.');
		return;
	}

	// Create/open database
	var request = indexedDB.open("drawmoreFiles", dbVersion);
	if (!request) {
		window.indexedDB = null;
		onerror('IndexedDB is broken.');
		return;
	}
	var self = this;

	console.log('Requested opening drawmoreFiles IndexedDB');

	var createObjectStore = function (dataBase) {
		// Create objectStores
		console.log("Creating objectStores");
		try {
			dataBase.createObjectStore("images");
		} catch(e) {}
		try {
			dataBase.createObjectStore("imageNames");
		} catch(e) {}
		try {
			dataBase.createObjectStore("brushes");
		} catch(e) {}
		try {
			dataBase.createObjectStore("palettes");
		} catch(e) {}
		try {
			dataBase.createObjectStore("thumbnails");
		} catch(e) {}
	};

	request.onerror = function(error) {
		console.log("Error creating/accessing IndexedDB", error);
		onerror(error);
	};

	request.onsuccess = function (event) {
		console.log("Success creating/accessing IndexedDB database");
		var db = self.indexedDB = request.result;

		db.onerror = function (event) {
			console.log("Error creating/accessing IndexedDB database", event);
		};
		
		// Interim solution for Google Chrome to create an objectStore. Will be deprecated
		if (db.setVersion) {
			if (db.version != dbVersion) {
				console.log('Version differs, upgrading');
				var setVersion = db.setVersion(dbVersion);
				setVersion.onsuccess = function () {
					console.log('setVersion.onsuccess')
					createObjectStore(db);
					setTimeout(callback, 100);
				};
			}
			else {
				console.log('Version up-to-date')
				callback();
			}
		}
		else {
			console.log('No versioning capability');
			createObjectStore(db);
			callback();
		}
	}

	// For future use. Currently only in latest Firefox versions
	request.onupgradeneeded = function (event) {
		console.log('onupgradeneeded');
		createObjectStore(event.target.result);
	};
};

AppDBMixin.getSaveImageBuffer = function() {
	this.recordSaveSnapshot();
	return this.serializeImage(this.drawArray, this.snapshots, this.drawEndIndex);
};

AppDBMixin.saveImageToDB = function(name, folder, callback) {
	var serialized = this.getSaveImageBuffer();
	var self = this;
	this.putToDB('images', name, serialized, function() {
		console.log("Created a serialized image", serialized.byteLength);
		self.moveImageToFolder(name, folder, function() {
			self.getImageThumbnailURL(name, function() {
				if (callback) {
					callback(serialized);
				}
			}, true);
		});
	});
};

AppDBMixin.loadImageFromDB = function(name, onSuccess, onError) {
	var self = this;
	this.getFromDB('images', name, function(buf) {
		console.log("Read in a serialized image", buf.byteLength);
		self.loadSerializedImage(buf).then(onSuccess).catch(onError);
	}, onError);
};

AppDBMixin.moveImageToFolder = function(name, folder, onSuccess, onError) {
	var self = this;
	this.getFromDB('imageNames', name, function(nameData) {
		if (!nameData || !nameData.folder || nameData.folder !== folder) {
			self.putToDB('imageNames', name, {folder: folder || 'Drawings', previousFolder: (nameData && nameData.folder) || 'Drawings'}, onSuccess, onError);
		}
	}, onError);
};

AppDBMixin.undoMoveImageToFolder = function(name, onSuccess, onError) {
	var self = this;
	this.getFromDB('imageNames', name, function(nameData) {
		self.putToDB('imageNames', name, {folder: nameData.previousFolder || 'Drawings', previousFolder: nameData.folder || 'Drawings'}, onSuccess, onError);
	}, onError);
};

AppDBMixin.emptyTrash = function(onSuccess, onError) {
	var self = this;
	this.getKeyValuesFromDB('imageNames', function(kvs) {
		var toDelete = kvs.filter(function(kv) {
			var value = kv.value;
			return (typeof value === 'object' && value.folder === 'Trash');
		}).map(function(kv) { return kv.key; });
		self.deleteImagesFromDB(toDelete, onSuccess, onError);
	}, onError);
};

AppDBMixin.moveImageToTrash = function(name, onSuccess, onError) {
	this.moveImageToFolder(name, 'Trash', onSuccess, onError);
};

AppDBMixin.recoverImageFromTrash = function(name, onSuccess, onError) {
	var self = this;
	this.getFromDB('imageNames', name, function(nameData) {
		if (nameData.folder === 'Trash') {
			self.undoMoveImageToFolder(name, onSuccess, onError);
		}
	}, onError);
};

AppDBMixin.deleteImagesFromDB = function(names, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction(['imageNames', 'images', 'thumbnails'], 'readwrite');

	transaction.oncomplete = onSuccess;
	transaction.onerror = onError;

	var imageNames = transaction.objectStore('imageNames');
	var images = transaction.objectStore('images');
	var thumbnails = transaction.objectStore('thumbnails');
	var objectStores = [imageNames, images, thumbnails];

	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		for (var j = 0; j < objectStores.length; j++) {
			var objectStore = objectStores[j];
			objectStore.delete(name);
		}
	}
	
	return transaction;
};

AppDBMixin.deleteImageFromDB = function(name, onSuccess, onError) {
	return this.deleteImagesFromDB([name], onSuccess, onError);
	// var self = this;
	// this.deleteFromDB('imageNames', name, function() {
	// 	self.deleteFromDB('images', name, function() {
	// 		self.deleteFromDB('thumbnails', name, onSuccess, onError);
	// 	}, onError);
	// }, onError);
};

AppDBMixin.putToDB = function(objectStore, key, value, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction([objectStore], 'readwrite');

	// Put the value into the database
	var put = transaction.objectStore(objectStore).put(value, key);
	transaction.oncomplete = onSuccess;
	transaction.onerror = onError;
};

AppDBMixin.deleteFromDB = function(objectStore, key, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction([objectStore], 'readwrite');

	// Put the value into the database
	var put = transaction.objectStore(objectStore).delete(key);
	put.onsuccess = onSuccess;
	put.onerror = onError;
};

AppDBMixin.getFromDB = function(objectStore, key, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction([objectStore], 'readonly');

	// Retrieve the file that was just stored
	var get = transaction.objectStore(objectStore).get(key);
	get.onsuccess = function (event) {
		onSuccess(event.target.result);
	};
	get.onerror = onError;
};

AppDBMixin.getKeyValuesFromDB = function(objectStore, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction([objectStore], 'readonly');

	var names = [];

	// Retrieve the keys
	var request = transaction.objectStore(objectStore).openCursor();
	request.onsuccess = function (event) {
		var cursor = event.target.result;
		if (cursor) {
			names.push({key: cursor.key, value: cursor.value});
			cursor.continue();
		} else {
			onSuccess(names);
		}
	};
	request.onerror = onError;
};

AppDBMixin.getKeysFromDB = function(objectStore, onSuccess, onError) {
	this.getKeyValuesFromDB(objectStore, function(kvs) {
		onSuccess(kvs.map(function(kv) { return kv.key; }));
	}, onError);
};

AppDBMixin.getValuesFromDB = function(objectStore, onSuccess, onError) {
	this.getKeyValuesFromDB(objectStore, function(kvs) {
		onSuccess(kvs.map(function(kv) { return kv.value; }));
	}, onError);
};

AppDBMixin.getSavedImageNames = function(onSuccess, onError) {
	this.getKeyValuesFromDB('imageNames', onSuccess, onError);
};

AppDBMixin.getBrushNamesFromDB = function(onSuccess, onError) {
	this.getKeysFromDB('brushes', onSuccess, onError);
};

AppDBMixin.getBrushesFromDB = function(onSuccess, onError) {
	this.getKeyValuesFromDB('brushes', function(kvs) {
		onSuccess(kvs.map(function(kv) {
			kv.value.name = kv.key;
			return kv.value;
		}));
	}, onError);
};

