// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('./ServiceWorker.js').then(function(registration) {
//     // Registration was successful
//     console.log('ServiceWorker registration successful with scope: ',    registration.scope);
//   }).catch(function(err) {
//     // registration failed :(
//     console.log('ServiceWorker registration failed: ', err);
//   });
// }


	var App = function() {

		this.container = document.body;

		var self = this;
		this.initIndexedDB(function() {

			self.getSavedImageNames(function(names) {
				names.forEach(function(name) {

					var d = document.createElement('div');
					d.className = 'item';
					var nameSpan = document.createElement('span');
					nameSpan.appendChild(document.createTextNode(name));
					d.appendChild(nameSpan);

					self.container.appendChild(d);
					self.getImageThumbnailURL(name, function(thumbURL) {
						d.style.backgroundImage = 'url(' + thumbURL + ')';
					});

				}); // names.forEach

			}); // getSavedImageNames

		}); // initIndexedDB


	};


	App.prototype.getImageThumbnailURL = function(name, callback) {
		callback( '/texture.png' );
	};

	App.prototype.initIndexedDB = function(callback) {
		// IndexedDB
		window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
			IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
			dbVersion = 4;

		/* 
			Note: The recommended way to do this is assigning it to window.indexedDB,
			to avoid potential issues in the global scope when web browsers start 
			removing prefixes in their implementations.
			You can assign it to a varible, like var indexedDB… but then you have 
			to make sure that the code is contained within a function.
		*/

		// Create/open database
		var request = indexedDB.open("drawmoreFiles", dbVersion);
		var self = this;

		var cb = callback;

		callback = function() {
			var callback = function(names) {
				if (names.length === 0 || (names.length === 1 && names[0] === 'drawingInProgress')) {
					populateNames(self.indexedDB, cb);
				} else {
					cb();
				}
			}
			// Open a transaction to the database
			var transaction = self.indexedDB.transaction(["imageNames"], 'readwrite');

			var names = [];

			// Retrieve the keys
			var request = transaction.objectStore("imageNames").openCursor();
			request.onsuccess = function (event) {
				var cursor = event.target.result;
				if (cursor) {
					names.push(cursor.key);
					cursor.continue();
				} else {
					callback(names);
				}
			};
		};

		var populateNames = function(dataBase, cb) {
			var callback = function(names) {
				names.forEach(function(n){ self.putToDB('imageNames', n, true); });
				cb();
			};

			// Open a transaction to the database
			var transaction = dataBase.transaction(["images"], 'readwrite');

			var names = [];

			// Retrieve the keys
			var request = transaction.objectStore("images").openCursor();
			request.onsuccess = function (event) {
				var cursor = event.target.result;
				if (cursor) {
					names.push(cursor.key);
					cursor.continue();
				} else {
					callback(names);
				}
			};

		};

		var createObjectStore = function (dataBase) {
			// Create an objectStore
			console.log("Creating objectStore");
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
		};

		request.onsuccess = function (event) {
			console.log("Success creating/accessing IndexedDB database");
			var db = self.indexedDB = request.result;

			db.onerror = function (event) {
				console.log("Error creating/accessing IndexedDB database");
			};
			
			// Interim solution for Google Chrome to create an objectStore. Will be deprecated
			if (db.setVersion) {
				if (db.version != dbVersion) {
					var setVersion = db.setVersion(dbVersion);
					setVersion.onsuccess = function () {
						createObjectStore(db);
						setTimeout(callback, 100);
					};
				}
				else {
					callback();
				}
			}
			else {
				callback();
			}
		}

		// For future use. Currently only in latest Firefox versions
		request.onupgradeneeded = function (event) {
			createObjectStore(event.target.result);
		};
	};

	App.prototype.saveImageToDB = function(name) {
		this.putToDB('images', name, this.serializeImage());
		this.putToDB('imageNames', name, true);
	};

	App.prototype.loadImageFromDB = function(name) {
		this.getFromDB('images', name, this.loadSerializedImage.bind(this));
	};

	App.prototype.deleteImageFromDB = function(name) {
		this.deleteFromDB('images', name);
		this.deleteFromDB('imageNames', name);
	};

	App.prototype.loadSerializedImage = function(buf) {
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
				if (w*h*4 !== snapshotLength-8) {
					throw("Corrupt snapshot when loading image");
				}
				var data = new Uint8Array(buf, u32Offset*4, w*h*4);
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
		this.drawArray = drawArray;
		this.snapshots = newSnapshots;
		this.timeTravel(drawEndIndex);
		this.needUpdate = true;
	};

	App.prototype.serializeImage = function() {
		var headerLength = 12;

		var dataString = JSON.stringify(this.drawArray);
		var dataStringByteLength = Math.ceil(dataString.length / 4) * 4;

		var snapshots = this.snapshots;
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
		u32[2] = this.drawEndIndex;
		for (var i=0; i<dataString.length; i++) {
			u8[i + headerLength] = dataString.charCodeAt(i);
		}
		var snapshotOffset = headerLength + dataStringByteLength;
		for (var i=0; i<snapshots.length; i++) {
			var snapshotU32Offset = snapshotOffset / 4;
			var s = snapshots[i];
			u32[snapshotU32Offset++] = s.index;
			u32[snapshotU32Offset++] = s.state.texture ? 8 + s.state.texture.data.byteLength : 0;
			snapshotOffset = snapshotU32Offset * 4;
			if (s.state.texture) {
				u32[snapshotU32Offset++] = s.state.texture.width;
				u32[snapshotU32Offset++] = s.state.texture.height;
				snapshotOffset = snapshotU32Offset * 4;
				var d = s.state.texture.data;
				for (var j=0; j<d.byteLength; j++) {
					u8[snapshotOffset++] = d[j];
				}
				snapshotOffset = Math.ceil(snapshotOffset / 4) * 4;
			}
		}
		return buf;
	};

	App.prototype.putToDB = function(objectStore, key, value) {
		// Open a transaction to the database
		var transaction = this.indexedDB.transaction([objectStore], 'readwrite');

		// Put the value into the database
		var put = transaction.objectStore(objectStore).put(value, key);
	};

	App.prototype.deleteFromDB = function(objectStore, key) {
		// Open a transaction to the database
		var transaction = this.indexedDB.transaction([objectStore], 'readwrite');

		// Put the value into the database
		var put = transaction.objectStore(objectStore).delete(key);
	};

	App.prototype.getFromDB = function(objectStore, key, callback) {
		// Open a transaction to the database
		var transaction = this.indexedDB.transaction([objectStore], 'readonly');

		// Retrieve the file that was just stored
		transaction.objectStore(objectStore).get(key).onsuccess = function (event) {
			callback(event.target.result);
		};
	};

	App.prototype.getKeyValuesFromDB = function(objectStore, callback) {
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
				callback(names);
			}
		};
	};

	App.prototype.getKeysFromDB = function(objectStore, callback) {
		this.getKeyValuesFromDB(objectStore, function(kvs) {
			callback(kvs.map(function(kv) { return kv.key; }));
		});
	};

	App.prototype.getValuesFromDB = function(objectStore, callback) {
		this.getKeyValuesFromDB(objectStore, function(kvs) {
			callback(kvs.map(function(kv) { return kv.value; }));
		});
	};

	App.prototype.getSavedImageNames = function(callback) {
		this.getKeysFromDB('imageNames', callback);
	};

	App.prototype.getBrushNamesFromDB = function(callback) {
		this.getKeysFromDB('brushes', callback);
	};

	App.prototype.getBrushesFromDB = function(callback) {
		this.getKeyValuesFromDB('brushes', function(kvs) {
			callback(kvs.map(function(kv) {
				kv.value.name = kv.key;
				return kv.value;
			}));
		});
	};

	new App();
