"use strict";

var AppDBMixin = {};

AppDBMixin.initFilePicker = function() {
	this.thumbnailQueue = [];
};

AppDBMixin.buildFilePicker = function(container) {
	var self = this;
	this.getSavedImageNames(function(names) {
		names.forEach(function(name) {

			var d = document.createElement('div');
			d.className = 'item';
			var nameSpan = document.createElement('span');
			nameSpan.appendChild(document.createTextNode(name));
			d.appendChild(nameSpan);

			d.onclick = function() {
				self.loadImageFromDB(name, function(image) {
					self.drawArray = image.drawArray;
					self.snapshots = image.snapshots;
					self.timeTravel(image.drawEndIndex);
					self.imageName = name;
				}, function(err) {
					console.log("Error loading image:", err);
				});
			};

			container.appendChild(d);
			self.getImageThumbnailURL(name, function(thumbURL) {
				d.style.backgroundImage = 'url(' + thumbURL + ')';
			});

		}); // names.forEach

	}); // getSavedImageNames

};


AppDBMixin.getImageThumbnailURL = function(name, callback, force) {
	this.thumbnailQueue.push({name: name, callback: callback, force: force});
	if (this.thumbnailQueue.length > 1) {
		return;
	}
	this.processThumbnailQueue();
};

AppDBMixin.applyThumbnailQueue = function(name, url) {
	for (var i=0; i<this.thumbnailQueue.length; i++) {
		var task = this.thumbnailQueue[i];
		if (task.name === name) {
			task.callback(url);
			this.thumbnailQueue.splice(i, 1);
			i--;
		}
	}
	this.processThumbnailQueue();
};

AppDBMixin.processThumbnailQueue = function() {
	if (this.thumbnailQueue.length === 0) {
		return;
	}

	var self = this;

	var currentTask = this.thumbnailQueue[0];
	var name = currentTask.name;

	this.getFromDB('thumbnails', name, function(thumbnail) {
		if (!thumbnail || currentTask.force) {
			self.loadImageFromDB(name, function(image) {
				var url;
				var lastSnap = image.snapshots[image.snapshots.length-1];
				console.log(image);
				if (lastSnap && lastSnap.state.texture) {
					var tex = lastSnap.state.texture;
					var c = document.createElement('canvas');
					c.width = tex.width;
					c.height = tex.height;
					
					console.log(tex.width, tex.height);

					var ctx = c.getContext('2d');
					var id = ctx.getImageData(0, 0, tex.width, tex.height);
					for (var y=0; y<tex.height; y++) {
						for (var x=0; x<tex.width; x++) {
							var j = (tex.width * (tex.height - 1 - y) + x) * 4;
							var i = (tex.width * y + x) * 4;
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
						}
					}
					ctx.putImageData(id, 0, 0);
					
					var imgC = document.createElement('canvas');
					var maxDim = 512;
					var f = 512 / Math.max(tex.width, tex.height);
					imgC.width = Math.ceil(tex.width * f);
					imgC.height = Math.ceil(tex.height * f);
					var imgCtx = imgC.getContext('2d');
					imgCtx.drawImage(c, 0, 0, imgC.width, imgC.height);
					url = imgC.toDataURL();
				} else {
					var c = document.createElement('canvas');
					c.width = c.height = 32;
					url = c.toDataURL();
				}
				self.putToDB('thumbnails', name, url);
				self.applyThumbnailQueue(name, url);

			}, function(error) {

				self.applyThumbnailQueue(name, '/texture.png');

			});
		} else {
			self.applyThumbnailQueue(name, thumbnail);
		}
	});

};

AppDBMixin.initIndexedDB = function(callback) {
	// IndexedDB
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;

	var dbVersion = 5;

	// Create/open database
	var request = indexedDB.open("drawmoreFiles", dbVersion);
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


AppDBMixin.saveImageToDB = function(name, folder, callback) {
	this.recordSaveSnapshot();
	var serialized = this.serializeImage(this.drawArray, this.snapshots, this.drawEndIndex);
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

AppDBMixin.deleteImageFromDB = function(name, onSuccess, onError) {
	var self = this;
	this.deleteFromDB('imageNames', name, function() {
		self.deleteFromDB('images', name, onSuccess, onError);
	}, onError);
};

AppDBMixin.loadSerializedImage = function(buf) {
	if (!buf) {
		return;
	}

	var u32 = new Uint32Array(buf);
	var version = u32[0];
	if (version !== 3) {
		throw("Unknown image version");
	}
	var dataLength = u32[1];
	var drawEndIndex = u32[2];

	var headerLength = 12;

	var data = new Uint8Array(buf, headerLength, dataLength);
	var snapshotsByteIndex = headerLength + Math.ceil(dataLength/4)*4;
	var snapshots = new Uint8Array(buf, snapshotsByteIndex);
	var dataString = [];
	for (var i=0; i<data.length; i+=4096) {
		dataString.push( String.fromCharCode.apply(null, data.slice(i, i+4096)) );
	}
	dataString = dataString.join("");
	var drawArray = JSON.parse(dataString);
	if (!drawArray) {
		throw("No drawArray found in loaded image");
	} else if (drawArray.indexOf(null) !== -1) {
		throw("Corrupt drawArray");
	}

	if (drawEndIndex > drawArray.length) {
		throw("Corrupt drawEndIndex + drawArray");
	}

	var newSnapshots = [];

	var promises = [];

	var offset = 0;
	while (offset < snapshots.length) {
		var u32Offset = (snapshotsByteIndex + offset) / 4;
		var snapshotIndex = u32[u32Offset++];
		var snapshotLength = u32[u32Offset++];
		var snapshot = {index: snapshotIndex, state: {}};
		offset += 8;
		if (snapshotLength > 0) {
			var w = u32[u32Offset++];
			var h = u32[u32Offset++];
			var data;
			if (w*h*4 !== snapshotLength-8) {
				// Assume compressed image
				var pngData = new Uint8Array(buf, u32Offset*4, snapshotLength-8);
				data = this.getImageDataForPNG(pngData).then(function(id) { 
					console.log('Hello there PNG', id.data.length);
					var u8 = new Uint8Array(id.data.length);
					u8.set(id.data);
					return u8;
				});
			} else {
				data = new Uint8Array(buf, u32Offset*4, w*h*4);
			}
			promises.push(data);
			snapshot.state.texture = {
				width: w,
				height: h,
				data: data
			};
		}
		newSnapshots.push(snapshot);
		offset += snapshotLength;
		offset = Math.ceil(offset / 4) * 4;
	}
	if (!newSnapshots[0] || newSnapshots[0].index !== 0) {
		throw("Corrupt snapshot when loading image");
	}

	return Promise.all(promises).then(function(resolved){
		console.log('Resolved snapshot data', resolved.length);
		for (var i=0, j=0; i<newSnapshots.length; i++) {
			var ss = newSnapshots[i];
			if (ss.state.texture) {
				console.log('Setting snapshot state texture data', resolved[j].byteLength);
				ss.state.texture.data = resolved[j++];
			}
		}
		return {
			drawArray: drawArray,
			snapshots: newSnapshots,
			drawEndIndex: drawEndIndex
		};
	});
};

AppDBMixin.serializeImage = function(drawArray, snapshots, drawEndIndex) {
	var headerLength = 12;

	var dataString = JSON.stringify(drawArray);
	var dataStringByteLength = Math.ceil(dataString.length / 4) * 4;

	var snapshotByteLength = 0;
	for (var i=0; i<snapshots.length; i++) {
		snapshotByteLength += 8;
		if (snapshots[i].state.texture) {
			snapshotByteLength += 8 + snapshots[i].state.texture.data.byteLength;
		}
		snapshotByteLength = Math.ceil(snapshotByteLength / 4) * 4;
	}

	var buf = new ArrayBuffer(headerLength + dataStringByteLength + snapshotByteLength);
	var u32 = new Uint32Array(buf);
	var u8 = new Uint8Array(buf);
	u32[0] = 3; // version
	u32[1] = dataString.length;
	u32[2] = drawEndIndex;
	for (var i=0; i<dataString.length; i++) {
		u8[i + headerLength] = dataString.charCodeAt(i);
	}
	var snapshotOffset = headerLength + dataStringByteLength;
	var compressTextures = true;
	for (var i=0; i<snapshots.length; i++) {
		var snapshotU32Offset = snapshotOffset / 4;
		var s = snapshots[i];
		u32[snapshotU32Offset++] = s.index;
		
		var textureData;
		if (s.state.texture) {
			if (compressTextures) {
				textureData = this.getPNGForImageData(s.state.texture);
			} else {
				textureData = s.state.texture.data;
			}
		}
		var textureSize = textureData ? textureData.byteLength : 0;

		u32[snapshotU32Offset++] = s.state.texture ? 8 + textureSize : 0;
		snapshotOffset = snapshotU32Offset * 4;
		if (s.state.texture) {
			u32[snapshotU32Offset++] = s.state.texture.width;
			u32[snapshotU32Offset++] = s.state.texture.height;
			snapshotOffset = snapshotU32Offset * 4;
			for (var j=0; j<textureData.byteLength; j++) {
				u8[snapshotOffset++] = textureData[j];
			}
			snapshotOffset = Math.ceil(snapshotOffset / 4) * 4;
		}
	}
	return buf.slice(0, snapshotOffset);
};

AppDBMixin.getImageDataForPNG = function(pngData) {
	return new Promise(function(resolve, reject) {
		var img = new Image;
		img.onload = function() {
			window.URL.revokeObjectURL(this.src);
			var canvas = document.createElement('canvas');
			canvas.width = this.width;
			canvas.height = this.height;
			var ctx = canvas.getContext('2d');
			ctx.globalCompositeOperation = 'copy';
			ctx.drawImage(this, 0, 0);
			var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
			resolve( id );
		};
		img.onerror = reject;
		var blob = new Blob([pngData]);
		img.src = window.URL.createObjectURL(blob);
	});
};

AppDBMixin.getPNGForImageData = function(imageData) {
	var canvas = document.createElement('canvas');
	canvas.width = imageData.width;
	canvas.height = imageData.height;
	var ctx = canvas.getContext('2d');
	var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
	id.data.set(imageData.data);
	ctx.putImageData(id, 0, 0);

	var data = canvas.toDataURL();
	var binary = atob(data.slice(data.indexOf(',') + 1));
	var arr = new Uint8Array(binary.length);
	for (var i=0; i<binary.length; i++) {
		arr[i] = binary.charCodeAt(i) & 0xFF;
	}
	return arr;
};

AppDBMixin.putToDB = function(objectStore, key, value, onSuccess, onError) {
	// Open a transaction to the database
	var transaction = this.indexedDB.transaction([objectStore], 'readwrite');

	// Put the value into the database
	var put = transaction.objectStore(objectStore).put(value, key);
	put.onsuccess = onSuccess;
	put.onerror = onError;
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
	this.getKeysFromDB('imageNames', onSuccess, onError);
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

