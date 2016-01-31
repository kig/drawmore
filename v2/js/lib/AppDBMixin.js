"use strict";

var AppDBMixin = {};

AppDBMixin.initFilePicker = function() {
	this.thumbnailQueue = [];
};

AppDBMixin.buildFilePicker = function(container) {
	var self = this;

	var pad = function(v) {
		if (v < 10) v = "0" + v.toString();
		return v;
	};
	var folders = {};

	this.getSavedImageNames(function(names) {
		names.sort(function(a,b) {
			if (/^\d+$/.test(a.key) && /^\d+$/.test(b.key)) {
				return b.key - a.key;
			}
			return a.key.localeCompare(b.key);
		});
		names.forEach(function(kv) {
			var name = kv.key;
			var metadata = typeof kv.value === 'object' ? kv.value : {folder: 'Drawings'};
			var folderDiv = folders[metadata.folder];
			if (!folderDiv) {
				folderDiv = folders[metadata.folder] = document.createElement('div');
				folderDiv.className = 'folder';
				folderDiv.classList.add(metadata.folder.replace(/\s/g, '-'));
				var header = document.createElement('h3');
				header.appendChild(document.createTextNode(metadata.folder));
				folderDiv.appendChild(header);
				container.appendChild(folderDiv);
			}

			var nameString = name;
			if (/^\d+$/.test(name) && Math.abs(Date.now() - name) < 30*360*86400*1000 ) { // Timestamp?
				var d = new Date(parseInt(name));
				nameString = ( ""
					+ [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join("-")
					+ " + " + pad(d.getHours()) + ":" + pad(d.getMinutes())
				);
			}

			var d = document.createElement('div');
			d.className = 'item';
			var nameSpan = document.createElement('span');
			nameSpan.appendChild(document.createTextNode(nameString));
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

			folderDiv.appendChild(d);
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

	if (new Uint32Array(buf, 0, 1)[0] === 1196314761) { // PNG compressed image
		return new Promise(function(resolve, reject) {
			pngDecompress(buf, function(buffer) {
				resolve(buffer);
			}, reject);
		}).then(this.loadSerializedImage.bind(this));
	}

	var u32 = new Uint32Array(buf);
	var version = u32[0];

	if (version !== 3 && version !== 4) {
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
		var len = Math.min(4096, data.length-i);
		dataString.push( String.fromCharCode.apply(null, new Uint8Array(buf, headerLength+i, len)) );
	}
	dataString = dataString.join("");
	var drawArray = JSON.parse(dataString);
	if (version >= 4) {
		drawArray = deltaUnpack(drawArray);
	}
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

AppDBMixin.loadSerializedImagePNG = function(compressed) {
	var pngData = new Uint8Array(compressed);
	return this.getImageDataForPNG(pngData, true).then(function(id) { 
		console.log('Hello there PNG', id.data.length);
		var u8 = new Uint8Array(id.data.length);
		u8.set(id.data);
		var imageDataSegment = -1;
		var dv = new DataView(compressed);
		var endIndex = compressed.byteLength;
		var len = 0;
		for (var i=8; i<compressed.byteLength;) {
			len = dv.getUint32(i, false);
			i += 4;
			var chunkType = [ dv.getUint8(i++), dv.getUint8(i++), dv.getUint8(i++), dv.getUint8(i++) ];
			i += len;
			var crc = dv.getUint32(i, false);
			i += 4;
			if (String.fromCharCode.apply(null, chunkType) === 'zTXt') {
				imageDataSegment = i - 4 - len;
				break;
			}
		}
		var defaultImage = {
			drawArray: [],
			snapshots: [{index: 0, state: {texture: {width: id.width, height: id.height, data: u8} }}],
			drawEndIndex: 0
		};
		if (imageDataSegment === -1) {
			return defaultImage;
		}
		var deflated = new Uint8Array(compressed, imageDataSegment+10, len-10);
		var body = pako.inflate(deflated);
		var str = bufferToString(body.buffer);
		var image = JSON.parse(str);
		image.drawArray = deltaUnpack(image.drawArray);
		image.snapshots[image.snapshots.length-1].state.texture = defaultImage.snapshots[0].state.texture;
		return image;
	});
};

AppDBMixin.serializeImagePNG = function(drawArray, snapshots, drawEndIndex) {
	if (snapshots.length > 2) {
		snapshots = [snapshots[0], snapshots[snapshots.length-1]];
	}

	if (!snapshots[1].state.texture) {
		return this.serializeImage(drawArray, snapshots, drawEndIndex);
	}

	var dataString = JSON.stringify({
		version: 6,
		drawArray: deltaPack(drawArray),
		drawEndIndex: drawEndIndex,
		snapshots: snapshots.map(function(ss) {
			var state = {};
			for (var i in ss.state) {
				if (i === 'texture') {
					state[i] = {
						width: ss.state.texture.width,
						height: ss.state.texture.height,
						data: 0
					};
				} else {
					state[i] = ss.state[i];
				}
			}
			return {
				index: ss.index,
				state: state
			}
		})
	});
	var dataBuffer = stringToBuffer(dataString);

	var tex = snapshots[1].state.texture;

	var canvas = document.createElement('canvas');
	canvas.width = tex.width;

	canvas.height = tex.height;
	var ctx = canvas.getContext('2d');
	var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
	var dst = id.data;
	var src = tex.data;
	for (var y=tex.height-1; y>=0; y--) {
		for (var x=0; x<tex.width; x++) {
			var off = (y * tex.width + x) * 4;
			var soff = ((tex.height-1-y) * tex.width + x) * 4;
			dst[off++] = src[soff++];
			dst[off++] = src[soff++];
			dst[off++] = src[soff++];
			dst[off++] = src[soff++];
		}
	}

	ctx.putImageData(id, 0, 0);
	
	var dataURL = canvas.toDataURL();
	var data = atob(dataURL.slice(dataURL.indexOf(",")+1));
	var compressed = stringToBuffer(data);
	var dv = new DataView(compressed);
	var endIndex = compressed.byteLength;
	for (var i=8; i<compressed.byteLength;) {
		var len = dv.getUint32(i, false);
		i += 4;
		var chunkType = [
			dv.getUint8(i++),
			dv.getUint8(i++),
			dv.getUint8(i++),
			dv.getUint8(i++)
		];
		i += len;
		var crc = dv.getUint32(i, false);
		i += 4;
		if (String.fromCharCode.apply(null, chunkType) === 'IEND') {
			endIndex = i-12-len;
		}
	}

	var zTXtChunk = new Uint32Array(2);
	var zTXtHeader = stringToBuffer("Drawmore\0\0");
	var zTXtBody = pako.deflate(new Uint8Array(dataBuffer));
	var dv = new DataView(zTXtChunk.buffer);
	dv.setUint32(0, zTXtHeader.byteLength + zTXtBody.byteLength, false);
	dv.setUint8(4, 0x7A);
	dv.setUint8(5, 0x54);
	dv.setUint8(6, 0x58);
	dv.setUint8(7, 0x74);

	console.log('serializeImagePNG', 'compressed snapshot byteLength', compressed.byteLength);
	console.log('serializeImagePNG', 'delta packed drawArray byteLength', dst.byteLength);
	console.log('serializeImagePNG', 'deflated drawArray byteLength', zTXtBody.byteLength);

	var chunkBuf = concatBuffers(zTXtChunk.buffer, zTXtHeader, zTXtBody.buffer);
	var chunk = new Uint8Array(chunkBuf, 4);

	var zTXtCRC = new Uint32Array(1);
	var dv = new DataView(zTXtCRC.buffer);
	dv.setUint32(0, crc32(chunk), false);

	var end = new Uint8Array(12);
	var dv = new DataView(end.buffer);
	end[4] = 73;
	end[5] = 69;
	end[6] = 78;
	end[7] = 68;
	var endU32 = new Uint32Array(end);
	dv.setUint32(0, 0, false);
	dv.setUint32(8, crc32(new Uint8Array(end.buffer, 4, 4)), false);

	var png = concatBuffers(compressed.slice(0, endIndex), chunkBuf, zTXtCRC.buffer, end.buffer);

	console.log('serializeImagePNG', 'compressed byteLength', png.byteLength);
	return png;
};

AppDBMixin.serializeImage = function(drawArray, snapshots, drawEndIndex) {
	var headerLength = 12;

	var dataString = JSON.stringify(deltaPack(drawArray));
	var dataStringByteLength = Math.ceil(dataString.length / 4) * 4;

	if (snapshots.length > 2) {
		snapshots = [snapshots[0], snapshots[snapshots.length-1]];
	}

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
	u32[0] = 4; // version
	u32[1] = dataString.length;
	u32[2] = drawEndIndex;
	for (var i=0; i<dataString.length; i++) {
		u8[i + headerLength] = dataString.charCodeAt(i);
	}
	var snapshotOffset = headerLength + dataStringByteLength;
	
	// Use PNG compression to make snapshots smaller?
	var compressTextures = false;

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
	return pngCompress(buf.slice(0, snapshotOffset));
};

AppDBMixin.getImageDataForPNG = function(pngData, flipY) {
	return new Promise(function(resolve, reject) {
		var img = new Image;
		img.onload = function() {
			window.URL.revokeObjectURL(this.src);
			var canvas = document.createElement('canvas');
			canvas.width = this.width;
			canvas.height = this.height;
			var ctx = canvas.getContext('2d');
			ctx.globalCompositeOperation = 'copy';
			if (flipY) {
				ctx.translate(0, canvas.height);
				ctx.scale(1, -1);
			}
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

