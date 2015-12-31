(function() {

	var App = function() {
		this.init();
	};

	App.Mode = {
		DRAW: 0,
		BRUSH_RESIZE: 1,
		OPACITY_CHANGE: 2,
		COLOR_PICKER: 3
	};

	App.prototype.snapshotSeparation = 500;
	App.prototype.maxSnapshotCount = 6;

	App.prototype.initIndexedDB = function(callback) {
		// IndexedDB
		window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
		    IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
		    dbVersion = 1;

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

        var createObjectStore = function (dataBase) {
            // Create an objectStore
            console.log("Creating objectStore")
            dataBase.createObjectStore("images");
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
		                callback();
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
		this.putToDB(name, this.serializeImage());
	};

	App.prototype.loadImageFromDB = function(name) {
    	this.getFromDB(name, this.loadSerializedImage.bind(this));
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

	App.prototype.putToDB = function(key, value) {
        // Open a transaction to the database
        var transaction = this.indexedDB.transaction(["images"], 'readwrite');

        // Put the value into the database
        var put = transaction.objectStore("images").put(value, key);
	};

	App.prototype.getFromDB = function(key, callback) {
        // Open a transaction to the database
        var transaction = this.indexedDB.transaction(["images"], 'readonly');

        // Retrieve the file that was just stored
        transaction.objectStore("images").get(key).onsuccess = function (event) {
        	callback(event.target.result);
        };
	};

	App.prototype.init = function() {
		this.pixelRatio = window.devicePixelRatio;
		this.mode = App.Mode.DRAW;

		this.brushTextures = {};

		this.ticker = this.tick.bind(this);

		this.brush = {
			x: 0,
			y: 0,
			r: 3,
			opacity: 1,
			blend: 0.5,
			color: '#000000',
			colorArray: new Uint8Array([0,0,0,255])
		};

		this.snapshots = [{ index: 0, state: {} }];
		this.drawArray = [];
		this.drawStartIndex = 0;
		this.drawEndIndex = 0;

		App.modeToggle(this, window.brushResize, App.Mode.BRUSH_RESIZE);
		App.modeToggle(this, window.opacityChange, App.Mode.OPACITY_CHANGE);
		App.modeToggle(this, window.colorPicker, App.Mode.COLOR_PICKER);

		this.setupCanvas();
		this.addEventListeners();

		var self = this;
		this.initIndexedDB(function() {
			self.loadImageFromDB('drawingInProgress');
		});
	};

	// Use ShaderToy shaders as brush shaders / filters.
	// 

	// Have a bunch of other brush textures to load & use.
	//

	App.prototype.undo = function() {
		if (this.drawEndIndex > 0) {
			var idx = this.drawEndIndex - 1;
			while (idx > 0) {
				if (this.drawArray[idx].isStart) {
					break;
				}
				idx--;
			}
			this.timeTravel(idx);
		}
	};

	App.prototype.redo = function() {
		if (this.drawEndIndex < this.drawArray.length) {
			var idx = this.drawEndIndex + 1;
			while (idx < this.drawArray.length) {
				if (this.drawArray[idx].isStart) {
					break;
				}
				idx++;
			}
			this.timeTravel(idx);
		}
	};

	App.prototype.timeTravel = function(drawArrayIndex) {
		var snapshot = this.getSnapshot(drawArrayIndex);
		if (drawArrayIndex - snapshot.index > 5 * this.snapshotSeparation) {
			if (!this.undoOk) {
				this.undoOk = confirm("Continuing undo operations are going to be very slow, proceed?");
				if (!this.undoOk) {
					return;
				}
			}
		} else {
			this.undoOk = false;
		}
		this.drawStartIndex = snapshot.index;
		this.drawEndIndex = drawArrayIndex;
		this.applySnapshot(snapshot);
		this.needUpdate = true;
	};

	App.prototype.recordSnapshotIfNeeded = function() {
		if (this.snapshots[this.snapshots.length-1].index < this.drawEndIndex-this.snapshotSeparation && this.drawEndIndex === this.drawArray.length) {
			this.snapshots.push( this.createSnapshot() );
			if (this.snapshots.length > this.maxSnapshotCount) {
				this.snapshots.splice(1, 1);
				/*
					Snapshots should be spaced with exponential separations so that
					undo is usually fast and doesn't usually eat too much memory.

					Also, rebuild snapshots while undoing so that there's always a 
					snapshot within snapshotSeparation of current undo state.
				*/

			}
		}
	};

	App.prototype.getSnapshot = function(drawArrayIndex) {
		for (var i = this.snapshots.length-1; i >= 0; i--) {
			var snapshot = this.snapshots[i];
			if (snapshot.index <= drawArrayIndex) {
				return snapshot;
			}
		}
		throw("No snapshot found for drawArrayIndex " + drawArrayIndex);
	};

	App.prototype.applySnapshot = function(snapshot) {
		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.strokeRenderTarget);
		this.renderer.setClearColor(0xffffff, 1.0);
		this.renderer.clearTarget(this.drawRenderTarget);
		if (snapshot.state.texture) {
			this.copyTextureToRenderTarget(snapshot.state.texture, this.drawRenderTarget);
		}
		this.endDrawBrush(true);
	};

	App.prototype.copyTextureToRenderTarget = function(texture, renderTarget) {
		this.copyQuadTexture.image.width = texture.width;
		this.copyQuadTexture.image.height = texture.height;
		this.copyQuadTexture.image.data = texture.data;
		this.copyQuadTexture.needsUpdate = true;
		this.renderer.render(this.copyScene, this.copyCamera, renderTarget);
	};

	App.prototype.createSnapshot = function(flipY) {
		var gl = this.renderer.context;

		console.log('createSnapshot');

		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.copyRenderTarget);

		this.drawQuad.scale.y = flipY ? -1 : 1;
		this.renderer.render(this.drawScene, this.drawCamera, this.copyRenderTarget);
		this.drawQuad.scale.y = 1;

		this.strokeQuad.scale.y = flipY ? -1 : 1;
		this.renderer.render(this.strokeScene, this.strokeCamera, this.copyRenderTarget);
		this.strokeQuad.scale.y = 1;

		var image = { width: this.width, height: this.height, data: new Uint8Array(this.width*this.height*4) };
		gl.readPixels(
			0, 0, image.width, image.height,
			gl.RGBA, gl.UNSIGNED_BYTE, image.data
		);
		return {
			index: this.drawEndIndex,
			state: {
				texture: image
			}
		};
	};

	App.prototype.getTextureDataForImage = function(image) {
		var c = document.createElement('canvas');
		c.width = image.width;
		c.height = image.height;
		var ctx = c.getContext('2d');
		ctx.globalCompositeOperation = 'copy';
		ctx.drawImage(image, 0, 0);
		var id = ctx.getImageData(0, 0, image.width, image.height);
		var a = [];
		for (var i=0; i<id.data.length; i++) {
			a[i] = id.data[i];
		}
		return {
			width: id.width,
			height: id.height,
			data: a
		};
	}

	App.prototype.setupCanvas = function() {

		var width = window.innerWidth;
		var height = window.innerHeight;
		var near = 0.1;
		var far = 100;

		var renderer = new THREE.WebGLRenderer({ premultipliedAlpha: true });
		renderer.setClearColor(0xffffff, 1.0);
		renderer.setPixelRatio( this.pixelRatio );
		renderer.setSize(width, height);
		renderer.domElement.id = 'draw-canvas';
		document.body.appendChild(renderer.domElement);

		this.width = renderer.domElement.width;
		this.height = renderer.domElement.height;

		var strokeRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height);
		var drawRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height);
		var copyRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height);

		this.strokeRenderTarget = strokeRenderTarget;
		this.drawRenderTarget = drawRenderTarget;
		this.copyRenderTarget = copyRenderTarget;

		this.strokeRenderTarget.texture.generateMipmaps = false;
		this.drawRenderTarget.texture.generateMipmaps = false;
		this.copyRenderTarget.texture.generateMipmaps = false;

		renderer.clear();
		renderer.autoClear = false;

		this.renderer = renderer;

		this.drawScene = new THREE.Scene();
		this.drawCamera = new THREE.Camera();
		this.drawScene.add(this.drawCamera);
		this.drawQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2, 2),
			new THREE.MeshBasicMaterial({
				map: this.drawRenderTarget,
				transparent: true,
				depthWrite: false,
				depthTest: false,
				side: THREE.DoubleSide
			})
		);
		this.drawScene.add(this.drawQuad);
		this.renderer.clearTarget(this.drawRenderTarget);


		this.copyScene = new THREE.Scene();
		this.copyCamera = new THREE.Camera();
		this.copyScene.add(this.copyCamera);
		this.copyQuadTexture = new THREE.DataTexture(null, this.width, this.height);
		this.copyQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2, 2),
			new THREE.MeshBasicMaterial({
				map: this.copyQuadTexture,
				transparent: true,
				depthWrite: false,
				depthTest: false,
				side: THREE.DoubleSide
			})
		);
		this.copyScene.add(this.copyQuad);

		this.strokeScene = new THREE.Scene();
		this.strokeCamera = new THREE.Camera();
		this.strokeScene.add(this.strokeCamera);

		this.strokeQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2, 2),
			new THREE.MeshBasicMaterial({
				map: this.strokeRenderTarget,
				transparent: true,
				depthWrite: false,
				depthTest: false,
				side: THREE.DoubleSide
			})
		);
		this.strokeScene.add(this.strokeQuad);
		this.renderer.clearTarget(this.strokeRenderTarget);

		this.scene = new THREE.Scene();
		var camera = new THREE.OrthographicCamera( 0, width, 0, height, near, far );
		camera.position.z = 90;
		this.camera = camera;
		this.scene.add(this.camera);

		this.brushRenderTarget = new THREE.WebGLRenderTarget(64, 64);
		this.brushRenderTarget.texture.generateMipmaps = false;

		this.brushCamera = new THREE.Camera();
		this.brushCamera.matrixAutoUpdate = false;

		this.brushTextureLoaded = false;

		var self = this;
		this.maskTexture = new THREE.DataTexture();
		var image = new Image();
		image.onload = function() {
			self.brushTextureLoaded = true;
			if (!self.drawArray.find(function(c){ return c.type === 'addBrush' && c.name === 1; })) {
				self.addBrush(1, self.getTextureDataForImage(this));
			}
		};
		image.src = 'texture.png';

		this.brushQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2, 2),
			new THREE.ShaderMaterial({

				vertexShader: [
					"varying vec2 vUv;",

					"void main() {",
					"	vUv = vec2(uv.x, 1.0-uv.y);",
					"	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
					"}"
				].join("\n"),

				fragmentShader: [
					"varying vec2 vUv;",

					"uniform vec2 resolution;",
					"uniform vec3 color;",
					"uniform float opacity;",
					"uniform float blend;",
					"uniform float textured;",
					"uniform float squareBrush;",
					"uniform sampler2D paint;",
					"uniform sampler2D mask;",

					"void main(void) {",
					"	vec4 paintContent = texture2D(paint, vUv);",
					"	vec2 unitUv = (vUv - 0.5) * 2.0;",
					"	float maskV = 1.0-texture2D(mask, vUv).r;",
					"	float brushOpacity = max(squareBrush, mix(smoothstep(1.0, 0.9, length(unitUv)), maskV, textured));",
					"	gl_FragColor.a = opacity * brushOpacity;",
					"	gl_FragColor.rgb = mix(paintContent.rgb, color, blend) * gl_FragColor.a;",
					"}"
				].join("\n"),

				uniforms: {
					resolution: { type: 'v2', value: new THREE.Vector2(this.width, this.height) },
					color: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
					opacity: { type: 'f', value: 0.5 },
					paint: { type: 't', value: this.brushRenderTarget },
					mask: { type: 't', value: this.maskTexture },
					blend: { type: 'f', value: 1 },
					squareBrush: { type: 'f', value: 0 },
					textured: { type: 'f', value: 0 }
				},

				transparent: true,
				depthWrite: false,
				depthTest: false,
				blending: THREE.CustomBlending,
				blendEquation: THREE.AddEquation,
				blendSrc: THREE.OneFactor,
				blendDst: THREE.ZeroFactor,
				blendEquationAlpha: THREE.MaxEquation,
				blendSrcAlpha: THREE.OneFactor,
				blendDstAlpha: THREE.OneFactor
			})
		);
		this.brushQuad.material.side = THREE.DoubleSide;
		this.scene.add(this.brushQuad);

		this.endDrawBrush();
	};

	App.prototype.mirrorDrawRenderTarget = function() {
		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.strokeRenderTarget);

		this.renderer.render(this.drawScene, this.drawCamera, this.strokeRenderTarget);

		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.drawRenderTarget);

		this.strokeQuad.scale.x = -1;
		this.renderer.render(this.strokeScene, this.strokeCamera, this.drawRenderTarget);

		this.renderer.clearTarget(this.strokeRenderTarget);
		this.strokeQuad.scale.x = 1;
	};

	App.prototype.mirror = function() {
		this.drawArrayPush({type: 'mirror', isStart: true});
		this.endBrush();
	};

	App.prototype.addEventListeners = function() {
		this.eventHandler = new App.EventHandler(this, this.renderer.domElement);
		var f = function(ev){ ev.preventDefault(); };
		var click = function(el, g) {
			el.addEventListener('click', g, false);

			el.addEventListener('touchstart', f, false);
			el.addEventListener('touchcancel', f, false);
			el.addEventListener('touchmove', f, false);
			el.addEventListener('touchend', g, false);
		};

		click(window.undo, this.undo.bind(this));
		click(window.redo, this.redo.bind(this));
		click(window.hideUI, function() {
			document.body.classList.add('hide-ui');
		});
		click(window.showUI, function() {
			document.body.classList.remove('hide-ui');
		});
		click(window.savePNG, this.save.bind(this));

		click(window.mirror, this.mirror.bind(this));

		// click(window.save, function() { self.saveImageToDB('drawingInProgress'); });
		click(window.newDrawing, function() { 
			if (confirm("Erase current drawing?")) {
				self.timeTravel(0);
				self.drawArray = [];
				self.addBrush(1, self.brushTextures[1]);
			}
		});

		var self = this;
		window.onbeforeunload = function(ev) {
			if (self.saved) {
				ev.preventDefault();
				return;
			}
			try {
				self.saveImageToDB('drawingInProgress');
				return;
			} catch(e) {
				return "Leaving this page will erase your drawing.";
			}
		};
	};

	App.prototype.save = function() {
		var snap = this.createSnapshot(true);
		var imageData = snap.state.texture;
		var canvas = document.createElement('canvas');
		canvas.width = imageData.width;
		canvas.height = imageData.height;
		var ctx = canvas.getContext('2d');

		// IE workaround (it doesn't have new ImageData(w, h))
		var id = ctx.getImageData(0, 0, imageData.width, imageData.height);
		for (var i=0; i<id.data.length; i++) {
			id.data[i] = imageData.data[i];
		}
		ctx.putImageData(id, 0, 0);

		var filename = 'Drawmore '+(new Date().toString().replace(/:/g, '.'))+ '.png';

		var blob;
		if (canvas.msToBlob) {
			blob = canvas.msToBlob();
		} else {
			var data = canvas.toDataURL();
			var binary = atob(data.slice(data.indexOf(',') + 1));
			var arr = new Uint8Array(binary.length);
			for (var i=0; i<binary.length; i++) {
				arr[i] = binary.charCodeAt(i);
			}
			blob = new Blob([arr]);
		}

		this.saveBlob(blob, filename);
	};

	App.prototype.saveBlob = function(blob, filename) {
		if (window.navigator.msSaveBlob) {
			window.navigator.msSaveBlob(blob, filename);			
		} else {
			var dlURL = window.URL.createObjectURL(blob);
			var a = document.createElement('a');
			a.href = dlURL;
			a.download = filename;
			document.body.appendChild(a);

			var clickEvent = new MouseEvent('click', {
				'view': window,
				'bubbles': true,
				'cancelable': false,
			});
			a.dispatchEvent(clickEvent);
			document.body.removeChild(a);
			window.URL.revokeObjectURL(dlURL);
		}
	};

	App.prototype.pressureCurve = function(v, x0, y0, x1, y1) {
		return Math.clamp(Math.pow(v, f), 0, 1);
	};

	App.prototype.addBrush = function(name, tex) {
		this.drawArrayPush({
			type: 'addBrush',
			name: name,
			texture: tex
		});
	};

	App.prototype.drawArrayPush = function(state) {
		if (this.drawArray.length > this.drawEndIndex) {
			this.drawArray.splice(this.drawEndIndex);
		}
		while (this.snapshots.length > 0 && this.snapshots[this.snapshots.length-1].index > this.drawEndIndex) {
			this.snapshots.pop();
			console.log('deleted obsolete snapshot');
		}
		this.drawArray[this.drawEndIndex++] = state;
	};

	App.Curves = {
		one : [0, 1, 0, 1, 1, 1, 1, 1],
		linear: [0, 0, 0, 0, 1, 1, 1, 1],
		linear15: [0, 0, 0, 0, 0.75, 1, 0.75, 1],
		pencilOpacity: [0, 0, 0.9, 0.0, 1, 1, 1, 1],
		pencilRadius: [0, 0.5, 0, 0.65, 0.8, 1, 1, 1],

		wateryOpacity: [0, 0, 0, 1, 0, 1, 1, 0.1]
	};

	App.CurvePresets = {
		brush: {
			radius: App.Curves.linear,
			opacity: App.Curves.linear15
		},

		liner: {
			radius: App.Curves.linear15,
			opacity: App.Curves.one
		},

		pencil: {
			radius: App.Curves.pencilRadius,
			opacity: App.Curves.pencilOpacity
		},

		watery: {
			radius: App.Curves.linear,
			opacity: App.Curves.wateryOpacity
		}
	};

	App.prototype.curvePoint = (function() {
		var xy = {x:0, y:0};

		var bezier = function(x0, y0, x1, y1, x2, y2, x3, y3, t, xy) {
			var t1 = 1-t;
			var t_2 = t*t;
			var t1_2 = t1*t1;
			var t_3 = t_2*t;
			var t1_3 = t1_2*t1;
			var t1_2t = t1_2*t*3;
			var t1t_2 = t1*t_2*3;
			xy.x = t1_3 * x0 + t1_2t * x1 + t1t_2 * x2 + t_3 * x3;
			xy.y = t1_3 * y0 + t1_2t * y1 + t1t_2 * y2 + t_3 * y3;
		};

		var yFromX = function(xTarget, x0, y0, x1, y1, x2, y2, x3, y3) {
			var xTolerance = 0.0001; //adjust as you please

			//establish bounds
			var lower = 0;
			var upper = 1;
			var t = (upper + lower) / 2;

			bezier(x0, y0, x1, y1, x2, y2, x3, y3, t, xy);

			var i = 0;

			//loop until completion
			while (Math.abs(xTarget - xy.x) > xTolerance && i < 10) {
				if(xTarget > xy.x) {
					lower = t;
				} else {
					upper = t;
				}

				t = (upper + lower) / 2;
				bezier(x0, y0, x1, y1, x2, y2, x3, y3, t, xy);

				i++;
			}

			//we're within tolerance of the desired x value.
			//return the y value.
			return xy.y;
		};

		return function(x, points) {
			var x0 = points[0];
			var y0 = points[1];
			var x1 = points[2];
			var y1 = points[3];
			var x2 = points[4];
			var y2 = points[5];
			var x3 = points[6];
			var y3 = points[7];

			if (x < x0) {
				return y0;
			}
			if (x > x3) {
				return y3;
			}

			return yFromX(x, x0, y0, x1, y1, x2, y2, x3, y3);
		};
	})();

	App.prototype.byteCount = 0;

	App.prototype.drawBrush = function(isStart) {

		var curve = App.CurvePresets[window.curve.value];

		var brush = this.brush;
		var blend = window.blending.checked ? 0 : 1;
		var texture = window.texturedBrush.checked ? 1 : 0;
		var radiusCurve = window.radiusPressure.checked ? curve.radius : App.Curves.one;
		var opacityCurve = window.opacityPressure.checked ? curve.opacity : App.Curves.one;

		this.byteCount += isStart ? 15 : 2;
		if (!isStart) {
			var last = this.drawArray[this.drawEndIndex-1];
			var dx = brush.x - last.x;
			var dy = brush.y - last.y;
			var dp = brush.pressure - last.pressure;
			var add = 2 * Math.floor(Math.max(
				Math.abs(dx) / 32, Math.abs(dy) / 32, Math.abs(dp * 2048) / 32
			));
			if (add > 0) {
				console.log('adding', add);
			}
			this.byteCount += add;
		}

		this.drawArrayPush({
			x: brush.x, // 14 bits
			y: brush.y, // 14 bits
			pressure: brush.pressure, // 11 bits

			isStart: isStart, // 1 bit

			// 5 bytes

			// Delta-compress x, y, pressure with 5-bit deltas => 15+1 = 16 bits per event, repeat if needed.

			// (Each non-isStart stroke event is 2 bytes)

			// The following are constant over a stroke, only defined for isStart == 1.

			// 10 bytes

			color: brush.colorArray, // 24 bits

			r: brush.r, // 16 bits
			opacity: brush.opacity, // 8 bits

			radiusCurve: radiusCurve, // 8 bits -- index to curve array
			opacityCurve: opacityCurve, // 8 bits

			blend: blend, // 8 bits
			texture: texture // 8 bits -- index to brush array
		});

		this.needUpdate = true;
	};

	App.prototype.endBrush = function() {
		this.drawArrayPush({type: 'end'});
		this.needUpdate = true;
	};

	App.prototype.endDrawBrush = function(noSnapshot) {
		this.renderer.render(this.strokeScene, this.strokeCamera, this.drawRenderTarget);

		var m = this.drawQuad.material;

		m.blending = THREE.CustomBlending;
		m.blendEquation = THREE.AddEquation;
		m.blendSrc = THREE.OneFactor;
		m.blendDst = THREE.ZeroFactor;
		m.blendEquationAlpha = THREE.AddEquation;
		m.blendSrcAlpha = THREE.ZeroFactor;
		m.blendDstAlpha = THREE.ZeroFactor;

		this.renderer.render(this.drawScene, this.drawCamera, this.strokeRenderTarget);

		m.blendEquation = THREE.AddEquation;
		m.blendSrc = THREE.OneFactor;
		m.blendDst = THREE.ZeroFactor;
		m.blendEquationAlpha = THREE.AddEquation;
		m.blendSrcAlpha = THREE.OneFactor; // OneMinusDstAlpha
		m.blendDstAlpha = THREE.ZeroFactor; // One

		this.needUpdate = true;

		if (!noSnapshot)
			this.recordSnapshotIfNeeded();
		this.renderer.setClearColor(0xffffff, 1.0);
	};

	App.prototype.copyDrawingToBrush = function(x, y, r) {
		var screenWidth = this.width / this.pixelRatio;
		var screenHeight = this.height / this.pixelRatio;
		// For smudge, render the current composite under the brush quad to the brushRenderTarget.
		// Set up the brush camera to capture only the area of the brush quad.
		var m = this.brushCamera.projectionMatrix.elements;
		m[0] = 0.5*screenWidth / r;
		m[5] = 0.5*screenHeight / r;
		m[12] = 4*m[0] * -(x - screenWidth/2) / (screenWidth*2);
		m[13] = 4*m[5] * (y - screenHeight/2) / (screenHeight*2);
		this.renderer.setClearColor(0x000000, 0.0);
		this.renderer.clearTarget(this.brushRenderTarget);
		this.renderer.render(this.drawScene, this.brushCamera, this.brushRenderTarget);
		this.renderer.render(this.strokeScene, this.brushCamera, this.brushRenderTarget);
	};

	App.prototype.renderDrawArray = function() {
		for (var i=this.drawStartIndex; i<this.drawEndIndex; i++) {
			var a = this.drawArray[i];
			if (a.type === 'end') {
				this.endDrawBrush();
			} else if (a.type === 'mirror') {
				this.mirrorDrawRenderTarget();
			} else if (a.type === 'addBrush') {
				this.brushTextures[a.name] = a.texture;
			} else {

				var last = a.isStart ? a : this.drawArray[i-1];

				var dx = a.x - last.x;
				var dy = a.y - last.y;
				var dp = a.pressure - last.pressure;
				var d = Math.sqrt(dx*dx + dy*dy);

				if (d === 0) {
					this.renderBrush(
						a.x,
						a.y,
						this.curvePoint(a.pressure, a.radiusCurve) * a.r,
						a.color,
						this.curvePoint(a.pressure, a.opacityCurve) * a.opacity,
						a.isStart,
						a.blend,
						a.texture
					);

				} else {
					var rdx = dx / d;
					var rdy = dy / d;
					var rdp = dp / d;
					var od = d;
					d = 0;
					var isStart = a.isStart;

					while (d < od) {
						var x = (last.x + d*rdx);
						var y = (last.y + d*rdy);
						var p = (last.pressure + d*rdp);

						this.renderBrush(
							x,
							y,
							this.curvePoint(p, a.radiusCurve) * a.r,
							a.color,
							this.curvePoint(p, a.opacityCurve) * a.opacity,
							isStart,
							a.blend,
							a.texture
						);

						d += Math.clamp(0.25 * this.curvePoint(p, a.radiusCurve) * a.r, 0.125, 1);
						isStart = false;
					}
				}
			}
		}
		// this.brushQuad.position.set(50, 50, 0);
		// this.brushQuad.scale.set(32, 32, 32);
		// this.brushQuad.material.uniforms.opacity.value = 1;
		// this.brushQuad.material.uniforms.blend.value = 0;
		// this.brushQuad.material.uniforms.squareBrush.value = 1;
		// this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
	};

	App.prototype.setBrushTexture = function(textureName) {
		var texture = this.brushTextures[textureName];

		if (this.maskTexture.brushTexture !== texture) {
			this.maskTexture.image.width = texture.width;
			this.maskTexture.image.height = texture.height;
			this.maskTexture.image.data = new Uint8Array(texture.data);
			this.maskTexture.brushTexture = texture;
			this.maskTexture.needsUpdate = true;
		}
	};

	App.prototype.renderBrush = function(x, y, r, colorArray, opacity, isStart, blend, texture) {
		if (isStart && blend < 1) {

		} else {
			this.brushQuad.position.set(x, y, 0);
			this.brushQuad.scale.set(r,r,r);
			var m = this.brushQuad.material;
			m.uniforms.opacity.value = opacity;
			m.uniforms.color.value.set(colorArray[0]/255, colorArray[1]/255, colorArray[2]/255);
			m.uniforms.blend.value = blend;
			if (texture) {
				this.setBrushTexture(texture);
			}
			m.uniforms.textured.value = texture ? 1 : 0;
			m.uniforms.squareBrush.value = 0;
			if (blend < 1) {
				m.blending = THREE.CustomBlending;
				m.blendEquation = THREE.AddEquation;
				m.blendSrc = THREE.OneFactor;
				m.blendDst = THREE.OneMinusSrcAlphaFactor;
				m.blendEquationAlpha = THREE.MaxEquation;
				m.blendSrcAlpha = THREE.OneFactor;
				m.blendDstAlpha = THREE.OneFactor;
			} else {
				m.blending = THREE.CustomBlending;
				m.blendEquation = THREE.AddEquation;
				m.blendSrc = THREE.OneFactor;
				m.blendDst = THREE.OneMinusSrcAlphaFactor;
				m.blendEquationAlpha = THREE.MaxEquation;
				m.blendSrcAlpha = THREE.OneFactor;
				m.blendDstAlpha = THREE.OneFactor;
			}
			this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
		}

		if (blend < 1) {
			this.copyDrawingToBrush(x, y, r);
		}					
	};

	App.prototype.tick = function() {
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		if (this.needUpdate && this.brushTextureLoaded) {

			this.renderDrawArray();
			this.drawStartIndex = this.drawEndIndex;
			this.renderer.setRenderTarget(null);
			this.renderer.clear();
			this.renderer.render(this.drawScene, this.drawCamera);
			this.renderer.render(this.strokeScene, this.strokeCamera);
			this.needUpdate = false;

			// window.debug.innerHTML = this.drawArray.length + " events, " + this.byteCount + " bytes";
		}

		if (this.colorMixer) {
			this.colorMixer.redraw();
		}

		window.requestAnimationFrame(this.ticker);
	};

	App.prototype.log = function(txt) {
		window.debug.textContent = txt;
	};





	// App drawing event handlers.
	//
	//

	App.EventHandler = function(app, el) {
		this.app = app;

		this.startX = 0;
		this.startY = 0;
		this.startRadius = 0;
		this.startOpacity = 1;
		this.startColor = '#ff0000';

		this.down = false;
		this.pointerDown = false;

		el.addEventListener("touchstart", this, false);
		el.addEventListener("touchend", this, false);
		el.addEventListener("touchcancel", this, false);
		el.addEventListener("touchmove", this, false);

		el.addEventListener("mousedown", this, false);
		window.addEventListener("mousemove", this, false);
		window.addEventListener("mouseup", this, false);

		el.addEventListener("pointerdown", this, false);
		window.addEventListener("pointermove", this, false);
		window.addEventListener("pointerup", this, false);
	};

	App.EventHandler.prototype = {
		handleEvent: function(ev) {
			ev.preventDefault();
			if (this[ev.type]) {
				this[ev.type](ev);
			}
		},

		resetMode: function() {
			if (this.app.mode !== App.Mode.DRAW) {
				this.app.mode = App.Mode.DRAW;
			}
		},

		parsePressure: function(touch) {
			var force = touch.force;
			if (!force && touch.radiusX !== 0) {
				force = 1;
			}
			if (touch.pointerType != undefined && force === 0.5 && touch.pointerType !== 'pen') {
				// Set touch & mouse force to 1 on IE (why is 0.5 the "not applicable" value?)
				force = 1;
			}
			return force;
		},

		startBrushStroke: function(x, y, pressure) {
			this.startX = x;
			this.startY = y;
			this.app.brush.x = x;
			this.app.brush.y = y;
			this.app.brush.pressure = pressure;

			if (this.app.mode === App.Mode.DRAW) {

				this.app.brush.lastX = this.app.brush.x;
				this.app.brush.lastY = this.app.brush.y;
				this.app.brush.lastPressure = this.app.brush.pressure;

				this.app.drawBrush(true);
			}

			this.app.colorMixer.widget.style.display = 'none';
		},

		endBrushStroke: function() {
			if (this.app.mode === App.Mode.DRAW) {
				this.app.endBrush();
			}
			this.resetMode();
		},

		moveBrushStroke: function(x, y, pressure) {
			this.app.brush.pressure = pressure;
			if (this.app.mode === App.Mode.DRAW) {
				this.app.brush.x = x;
				this.app.brush.y = y;
				this.app.drawBrush(false);
			}
		},


		mousedown: function(ev) {
			if (!this.pointerDown) {
				this.down = true;
				this.startBrushStroke(ev.clientX, ev.clientY, ev.pressure === undefined ? 1 : ev.pressure);
			}
		},

		mouseup: function(ev) {
			if (this.down) {
				this.down = false;
				this.endBrushStroke();
			}
		},

		mousemove: function(ev) {
			if (this.down) {
				this.moveBrushStroke(ev.clientX, ev.clientY, ev.pressure === undefined ? 1 : ev.pressure);
			}
		},


		pointerdown: function(ev) {
			if (!this.down) {
				this.mousedown(ev);
			}
			this.down = false;
			this.pointerDown = true;
		},

		pointerup: function(ev) {
			if (this.pointerDown) {
				this.down = true;
				this.mouseup(ev);
				this.pointerDown = false;
			}
		},

		pointermove: function(ev) {
			if (this.pointerDown) {
				this.down = true;
				this.mousemove(ev);
				this.down = false;
			}
		},


		touchstart: function(ev) {
			this.startBrushStroke(
				ev.touches[0].clientX,
				ev.touches[0].clientY,
				this.parsePressure(ev.touches[0])
			);
		},

		touchend: function(ev) {
			this.endBrushStroke();
		},

		touchcancel: function(ev) {
			this.touchend(ev);
		},

		touchmove: function(ev) {
			this.moveBrushStroke(ev.touches[0].clientX, ev.touches[0].clientY, this.parsePressure(ev.touches[0]));
		}
	};




	// Utils for colors.
	//
	//

	App.toColor = function(c) {
		return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';
	};

	App.blend = function(a, b, f) {
		return [
			(1-f)*a[0] + f*b[0],
			(1-f)*a[1] + f*b[1],
			(1-f)*a[2] + f*b[2]
		];
	};



	// Event handlers for the UI controls.
	//
	//

	App.modeToggle = function(app, toggle, targetMode) {
		var toggleCanvas = document.createElement('canvas');
		var bbox = toggle.getBoundingClientRect(); 
		var w = bbox.width;
		var h = bbox.height;
		toggleCanvas.width = w * app.pixelRatio;
		toggleCanvas.height = h * app.pixelRatio;
		toggleCanvas.style.width = w + 'px';
		toggleCanvas.style.height = h + 'px';

		toggle.appendChild(toggleCanvas);

		var toggleCtx = toggleCanvas.getContext('2d');
		toggleCtx.scale(app.pixelRatio, app.pixelRatio);

		var update = function() {
			toggleCtx.clearRect(0, 0, w, h);

			if (targetMode === App.Mode.COLOR_PICKER) {
				toggleCtx.fillStyle = app.brush.color;
				toggleCtx.fillRect(0, 0, w, h);

			} else if (targetMode === App.Mode.BRUSH_RESIZE) {

				if (app.brushCircle) {
					app.brushCircle.style.borderRadius = app.brush.r+1 + 'px';
					app.brushCircle.style.marginTop = -app.brush.r + 'px';
					app.brushCircle.style.width = app.brushCircle.style.height = 2 * app.brush.r + 'px';
				}

				var r = Math.min(app.brush.r, h/2 - 8)

				toggleCtx.beginPath();
				toggleCtx.arc(w/2, h/2-5, r, 0, Math.PI*2, true);
				toggleCtx.fillStyle = 'white';
				toggleCtx.fill();

				toggleCtx.fillStyle = 'black';
				if (r < app.brush.r) {
					toggleCtx.fillRect(w/2-2, h/2-5, 5, 1);
					toggleCtx.fillRect(w/2, h/2-5-2, 1, 5);
				}

				if (app.brush.r < 1) {
					var rs = (Math.round(app.brush.r * 100) / 100).toString().replace(/(\...).+/, '$1');
				} else {
					var rs = Math.round(app.brush.r).toString();
				}
				var tw = toggleCtx.measureText(rs).width;
				toggleCtx.fillText(rs, w/2-tw/2, h-2);

			} else if (targetMode === App.Mode.OPACITY_CHANGE) {
				var segs = 8;
				var pw = w/segs;
				var ph = h/segs;
				toggleCtx.globalAlpha = 1;
				for (var x=0; x<segs; x++) {
					for (var y=0; y<segs; y++) {
						toggleCtx.fillStyle = ((x+y) % 2) ? '#AAA' : '#CCC';
						toggleCtx.fillRect(x * pw, y * ph, pw, ph);
					}
				}
				toggleCtx.fillStyle = 'black';
				toggleCtx.globalAlpha = app.brush.opacity;
				toggleCtx.fillRect(0, 0, w, h);

				toggleCtx.globalAlpha = 1;
				toggleCtx.fillStyle = 'white';
				var rs = Math.round(app.brush.opacity * 100).toString() + '%';
				var tw = toggleCtx.measureText(rs).width;
				toggleCtx.fillText(rs, w/2-tw/2, h-2);

			}
		};
		update();

		var touchInsideElement = function(el, ev) {
			var bbox = el.getBoundingClientRect();
			var cx = ev.clientX;
			var cy = ev.clientY;
			return (cx < bbox.right && cx > bbox.left && cy < bbox.bottom && cy > bbox.top);
		};

		toggle.revertBrush = function() {
			app.brush.r = this.startRadius;
			app.brush.opacity = this.startOpacity;
			app.brush.color = this.startColor;
			app.brush.colorArray = this.startColorArray;
		};

		var colorMixer;
		var brushCircle;
		if (targetMode === App.Mode.COLOR_PICKER) {
			colorMixer = new ColorMixer(document.body, 100, 100, function(c) {
				app.brush.colorArray = new Uint8Array(4);
				app.brush.colorArray[0] = c[0]*255;
				app.brush.colorArray[1] = c[1]*255;
				app.brush.colorArray[2] = c[2]*255;
				app.brush.colorArray[3] = 255;
				app.brush.color = App.toColor(app.brush.colorArray);
				update();
			});
			colorMixer.widget.id = 'colorMixer';
			colorMixer.redraw();
			app.colorMixer = colorMixer;

			var toggleColorMixer = function() {
				if (colorMixer.widget.style.display === 'none') {
					colorMixer.widget.style.display = 'block';
					var c = app.brush.colorArray;
					colorMixer.setColor([c[0]/255, c[1]/255, c[2]/255]);
				} else {
					colorMixer.widget.style.display = 'none';
				}
			};
			toggleColorMixer();

		} else if (targetMode === App.Mode.BRUSH_RESIZE) {
			brushCircle = document.createElement('div');
			brushCircle.id = 'brushCircle'
			app.brushCircle = brushCircle;
			document.body.appendChild(brushCircle);
		}

		var wasVisible = false;
		
		toggle.start = function(ev) {
			this.startRadius = app.brush.r;
			this.startOpacity = app.brush.opacity;
			this.startColor = app.brush.color;
			this.startColorArray = app.brush.colorArray;

			this.startX = ev.clientX;
			this.startY = ev.clientY;

			wasVisible = app.colorMixer.widget.style.display !== 'none';
			app.colorMixer.widget.style.display = 'none';

			app.brushCircle.style.opacity = (targetMode === App.Mode.BRUSH_RESIZE) ? 1 : 0;

			app.mode = targetMode;
		};

		toggle.end = function(ev) {
			if (targetMode === App.Mode.COLOR_PICKER) {
				if (touchInsideElement(this, ev)) {
					if (!wasVisible) {
						toggleColorMixer();
					}
					this.revertBrush();
				}
			}
			app.brushCircle.style.opacity = 0;
			app.mode = App.Mode.DRAW;
		};

		toggle.cancel = function() {
			this.revertBrush();
			app.brushCircle.style.opacity = 0;
			app.mode = App.Mode.DRAW;
		};

		toggle.move = function(ev) {
			var mode = app.mode;
			switch (mode) {
				case App.Mode.BRUSH_RESIZE: {
					var dx = ev.clientX - this.startX;
					var dy = ev.clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.r = Math.max(0.5, this.startRadius - dy/3);
					break;
				}
				case App.Mode.OPACITY_CHANGE: {
					var dx = ev.clientX - this.startX;
					var dy = ev.clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.opacity = Math.max(0, Math.min(1, this.startOpacity - dy/100));
					break;
				}
				case App.Mode.COLOR_PICKER: {
					if ( touchInsideElement(this, ev) ) {
						// Touch is still inside element area.
						// Do nothing, maybe the user wants to bring up the color mixer.

					} else { // dragged to outside element area
						var x = Math.floor(ev.clientX * app.pixelRatio);
						var y = Math.floor(ev.clientY * app.pixelRatio);
						var pixels = new Uint8Array(4);
						var gl = app.renderer.context;
						app.renderer.setRenderTarget(app.drawRenderTarget);
						gl.readPixels(x, app.height-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
						app.brush.color = App.toColor(pixels);
						app.brush.colorArray = pixels;
					}
					break;
				}
			}

			update();
		};

		toggle.addEventListener('touchstart', function(ev) {
			ev.preventDefault();
			this.start(ev.touches[0]);
		}, false);

		toggle.addEventListener('touchend', function(ev) {
			ev.preventDefault();
			this.end(ev.changedTouches[0]);
		}, false);

		toggle.addEventListener('touchcancel', function(ev) {
			ev.preventDefault();
			this.cancel();
		}, false);

		toggle.addEventListener('touchmove', function(ev) {
			ev.preventDefault();
			this.move(ev.touches[0]);
		}, false);


		toggle.addEventListener('mousedown', function(ev) {
			ev.preventDefault();
			this.down = true;
			this.start(ev);
		}, false);

		window.addEventListener('mouseup', function(ev) {
			if (toggle.down) {
				ev.preventDefault();
				toggle.end(ev);
				toggle.down = false;
			}
		}, false);

		window.addEventListener('mousemove', function(ev) {
			if (toggle.down) {
				ev.preventDefault();
				toggle.move(ev);
			}
		}, false);
	};









	var app = new App();
	app.tick();
})();
