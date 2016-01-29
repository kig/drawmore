var pngCompress = function(buffer) {
	var canvas = document.createElement('canvas');
	canvas.width = Math.min(Math.ceil((buffer.byteLength+6) / 3), 16384);
	canvas.height = Math.ceil((buffer.byteLength+6) / (3*canvas.width));
	var ctx = canvas.getContext('2d');
	var id = ctx.getImageData(0, 0, canvas.width, canvas.height);
	var u32 = new Uint32Array(1);
	var u8 = new Uint8Array(u32.buffer);
	u32[0] = buffer.byteLength;
	var src = new Uint8Array(buffer);

	var i = 0, j = 0;
	id.data[i++] = u8[j++];
	id.data[i++] = u8[j++];
	id.data[i++] = u8[j++];
	id.data[i++] = 255;
	id.data[i++] = u8[j++];
	id.data[i++] = 0;
	id.data[i++] = 0;
	id.data[i++] = 255;
	console.log('pngCompress', 'uncompressed byteLength', u32, u8);

	for (var j=0; i<id.data.length;) {
		id.data[i++] = src[j++];
		id.data[i++] = src[j++];
		id.data[i++] = src[j++];
		id.data[i++] = 255;
	}

	ctx.putImageData(id, 0, 0);
	var dataURL = canvas.toDataURL();
	var data = atob(dataURL.slice(dataURL.indexOf(",")+1));
	var compressed = stringToBuffer(data);
	console.log('pngCompress', 'compressed byteLength', compressed.byteLength);
	return compressed;
};

var pngDecompress = function(buffer, callback, onerror) {
	var img = new Image();
	img.onload = function() {
		var canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		var ctx = canvas.getContext('2d');
		ctx.globalCompositeOperation = 'copy';
		ctx.drawImage(img, 0, 0);
		var id = ctx.getImageData(0, 0, canvas.width, canvas.height);

		console.log('pngDecompress', 'compressed data length', buffer.byteLength);
		console.log('pngDecompress', 'decompressed pixels byteLength', id.data.buffer.byteLength);

		var src = id.data;
		var u32 = new Uint32Array(1);
		var u8 = new Uint8Array(u32.buffer);

		var i = 0, j = 0;
		u8[j++] = src[i++];
		u8[j++] = src[i++];
		u8[j++] = src[i++];
		i++;
		u8[j++] = src[i++];
		i++;
		i++;
		i++;
		console.log('pngDecompress', 'decompressed byteLength', u32, u8);

		var dst = new Uint8Array(u32[0]);
		for (var j=0; j<dst.length;) {
			dst[j++] = src[i++];
			dst[j++] = src[i++];
			dst[j++] = src[i++];
			i++;
		}
		callback(dst.buffer);
	}
	img.onerror = onerror;
	img.src = window.URL.createObjectURL(new Blob([buffer]));
};

var stringToBuffer = function(string) {
	var u8 = new Uint8Array(string.length);
	for (var i=0; i<u8.length; i++) {
		u8[i] = string.charCodeAt(i) & 0xff;
	}
	return u8.buffer;
};

var bufferToString = function(buffer) {
	var u8 = new Uint8Array(buffer);
	var string = [];
	for (var i=0; i<u8.length; i += 4096) {
		var len = Math.min(4096, u8.length-i)
		string.push(String.fromCharCode.apply(null, new Uint8Array(buffer, i, len)));
	}
	return string.join("");
};

var differ = function(a, b) {
	if (a === b) {
		return false;
	}
	if (a instanceof Array && b instanceof Array) {
		if (a.length !== b.length) {
			return true;
		}
		for (var i=0; i<a.length; i++) {
			if (a[i] !== b[i]) {
				return true;
			}
		}
		return false;
	}
	if (typeof a === 'object' && typeof b === 'object') {
		for (var i in a) {
			if (a[i] !== b[i]) {
				return true;
			}
		}
		for (var i in b) {
			if (a[i] !== b[i]) {
				return true;
			}
		}
		return false;
	}
	return true;
};

var delta = function(state, obj) {
	var deltaObj = {};
	var newState = {};

	for (var i in state) {
		if (state[i] === undefined && obj[i] === undefined) { // remains deleted
		} else {
			if (obj[i] === undefined) { // deleted from state
				deltaObj[i] = null;
				delete state[i];

			} else if (typeof obj[i] === 'number' && typeof state[i] === 'number') { // different number
				if (state[i] !== obj[i]) {
					deltaObj[i] = obj[i] - state[i];
				}
				state[i] = obj[i];

			} else if (differ(obj[i], state[i])) { // different state
				deltaObj[i] = obj[i];
				state[i] = obj[i];

			} else {
				state[i] = obj[i];
			}
		}
	}
	for (var i in obj) {
		if (state[i] === undefined) {
			deltaObj[i] = obj[i];
			state[i] = obj[i];
		}
	}
	return deltaObj;
};

var undelta = function(state, obj) {
	var o = {};
	for (var i in obj) {
		if (obj[i] === null) {
			delete state[i];
		} else if (typeof state[i] === 'number' && typeof obj[i] === 'number') {
			state[i] += obj[i];
		} else {
			state[i] = obj[i];
		}
	}
	for (var i in state) {
		o[i] = state[i];
	}
	return o;
};

var deltaPack = function(arr) {
	var r = [];
	var state = {};
	for (var i=0; i<arr.length; i++) {
		r[i] = delta(state, arr[i]);
	}
	return r;
};

var deltaUnpack = function(arr) {
	var r = [];
	var state = {};
	for (var i=0; i<arr.length; i++) {
		r[i] = undelta(state, arr[i]);
	}
	return r;
};

var compressString = function(string) {
	return pngCompress( stringToBuffer(string) );
};

var decompressString = function(buffer, onsuccess, onerror) {
	pngDecompress(buffer, function(buffer) {
		var str;
		try {
			str = bufferToString(buffer);
		} catch (e) {
			onerror(e);
			return;
		}
		onsuccess(str);
	}, onerror);
};

var compressArray = function(array) {
	return compressString( JSON.stringify( deltaPack(array) ) );
};

var decompressArray = function(buffer, onsuccess, onerror) {
	decompressString(buffer, function(string) {
		var array;
		try {
			array = deltaUnpack(JSON.parse(string));
		} catch (e) {
			onerror(e);
			return;
		}
		onsuccess(array);
	}, onerror);
};


var testArr = [
	{x: 1, y: 2, z: 3},
	{x: 2, y: 4},
	{x: 2, y: 4},
	{z: 8},
	{w: 12, z:8, y: 3},
	{y: 3, z: 8}
];
var cmpArr = function(a, b) {
	if (a.length !== b.length) return 'lengths differ';
	for (var i=0; i<a.length; i++) {
		var ac = a[i], bc = b[i];
		for (var j in ac) {
			if (JSON.stringify(ac[j]) !== JSON.stringify(bc[j])) return ['differ at', i, j];
		}
	}
	return 'OK';
};

console.log ( 'delta pack roundtrip', cmpArr(testArr, deltaUnpack(deltaPack(testArr))) );

decompressArray(compressArray(testArr), function(arr) {
	console.log('compression roundtrip', cmpArr(testArr, arr));
}, function(e) { console.log('compression roundtrip error', e); });

