(function() {
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
		this.init();
	};
	
	App.extend = function(mixin) {
		for (var i in mixin) {
			this.prototype[i] = mixin[i];
		}
	};

	App.extend(AppDBMixin);
	App.extend(FilePickerMixin);
	App.extend(ImageSerializationMixin);

	App.Mode = {
		DRAW: 0,
		BRUSH_RESIZE: 1,
		OPACITY_CHANGE: 2,
		COLOR_PICKER: 3,
		BRUSH_SHAPE: 4
	};

	App.prototype.snapshotSeparation = 500;
	App.prototype.maxSnapshotCount = 6;

	App.prototype.penMode = false;

	App.prototype.plotCurve = function(svg, curve) {
		var p1 = svg.querySelector('.p1');
		var p2 = svg.querySelector('.p2');
		var c1 = svg.querySelector('.c1');
		var c2 = svg.querySelector('.c2');
		var path = svg.querySelector('.curve');
		var line1 = svg.querySelector('.pc1');
		var line2 = svg.querySelector('.pc2');

		p1.setAttribute('cx', curve[0]*99);
		p1.setAttribute('cy', 99-curve[1]*99);
		p2.setAttribute('cx', curve[6]*99);
		p2.setAttribute('cy', 99-curve[7]*99);

		c1.setAttribute('x', curve[2]*99-5);
		c1.setAttribute('y', 99-curve[3]*99-5);
		c2.setAttribute('x', curve[4]*99-5);
		c2.setAttribute('y', 99-curve[5]*99-5);

		path.setAttribute('d', [
			'M', 0, 99-curve[1]*99,
			'L', curve[0]*99, 99-curve[1]*99,
			'C', curve[2]*99, 99-curve[3]*99,
				 curve[4]*99, 99-curve[5]*99,
				 curve[6]*99, 99-curve[7]*99,
			'L', 99, 99-curve[7]*99
		].join(" "));

		line1.setAttribute('d', [
			'M', p1.getAttribute('cx'), p1.getAttribute('cy'),
			'L', parseFloat(c1.getAttribute('x'))+5, parseFloat(c1.getAttribute('y'))+5
		].join(" "));
		line2.setAttribute('d', [
			'M', p2.getAttribute('cx'), p2.getAttribute('cy'),
			'L', parseFloat(c2.getAttribute('x'))+5, parseFloat(c2.getAttribute('y'))+5
		].join(" "));
	};

	App.prototype.draggable = function(el, xyParams, moveCallback, upCallback) {
		var down = false;
		var previousX = 0;
		var previousY = 0;
		var onDown = function(ev) {
			down = true;
			previousX = ev.clientX;
			previousY = ev.clientY;
			if (ev.preventDefault) {
				ev.preventDefault();
			}
		};
		var onMove = function(ev) {
			if (down) {
				var dx = ev.clientX - previousX;
				var dy = ev.clientY - previousY;
				previousX = ev.clientX;
				previousY = ev.clientY;
				var x = parseFloat(el.getAttribute(xyParams[0]));
				var y = parseFloat(el.getAttribute(xyParams[1]));
				var xy = {x: x+dx, y: y+dy};
				var newXY = moveCallback(xy);
				el.setAttribute(xyParams[0], newXY.x);
				el.setAttribute(xyParams[1], newXY.y);
				if (ev.preventDefault) {
					ev.preventDefault();
				}
			}
		};
		var onUp = function(ev) {
			if (down) {
				down = false;
				if (ev.preventDefault) {
					ev.preventDefault();
				}
				upCallback();
			}
		};

		var touchWrap = function(touchHandler) {
			return function(ev) {
				ev.preventDefault();
				touchHandler(ev.touches[0]);
			}
		};

		el.addEventListener('mousedown', onDown, false);
		window.addEventListener('mousemove', onMove, false);
		window.addEventListener('mouseup', onUp, false);

		el.addEventListener('touchstart', touchWrap(onDown), false);
		el.addEventListener('touchmove', touchWrap(onMove), false);
		el.addEventListener('touchend', touchWrap(onUp), false);
		el.addEventListener('touchcancel', touchWrap(onUp), false);
	};

	App.prototype.draggableCurve = function(svg, curveCallback) {
		var p1 = svg.querySelector('.p1');
		var p2 = svg.querySelector('.p2');
		var c1 = svg.querySelector('.c1');
		var c2 = svg.querySelector('.c2');
		var path = svg.querySelector('.curve');
		var line1 = svg.querySelector('.pc1');
		var line2 = svg.querySelector('.pc2');

		var updatePath = function() {
			var p1x = parseFloat(p1.getAttribute('cx'));
			var p1y = parseFloat(p1.getAttribute('cy'));
			var p2x = parseFloat(p2.getAttribute('cx'));
			var p2y = parseFloat(p2.getAttribute('cy'));

			var c1x = Math.clamp(parseFloat(c1.getAttribute('x')), p1x-5, p2x-5);
			c1.setAttribute('x', c1x);
			c1x += 5;

			var c2x = Math.clamp(parseFloat(c2.getAttribute('x')), p1x-5, p2x-5);
			c2.setAttribute('x', c2x);
			c2x += 5;

			var c1y = parseFloat(c1.getAttribute('y'))+5;
			var c2y = parseFloat(c2.getAttribute('y'))+5;
			path.setAttribute('d', [
				'M', '0', p1y,
				'L', p1x, p1y,
				'C', c1x, c1y, c2x, c2y, p2x, p2y,
				'L', '99', p2y
			].join(" "));
			line1.setAttribute('d', [
				'M', p1x, p1y,
				'L', c1x, c1y
			].join(" "));
			line2.setAttribute('d', [
				'M', p2x, p2y,
				'L', c2x, c2y
			].join(" "));

			var curve = curveCallback();
			curve[0] = p1x / 99;
			curve[1] = 1 - p1y / 99;
			curve[2] = c1x / 99;
			curve[3] = 1 - c1y / 99;
			curve[4] = c2x / 99;
			curve[5] = 1 - c2y / 99;
			curve[6] = p2x / 99;
			curve[7] = 1 - p2y / 99;
		};

		this.draggable(p1, ['cx', 'cy'], function(xy) {
			xy.x = Math.clamp(xy.x, 0, parseFloat(p2.getAttribute('cx')));
			xy.y = Math.clamp(xy.y, 0, 99);
			updatePath();
			return xy;
		}, updatePath);
		this.draggable(p2, ['cx', 'cy'], function(xy) {
			xy.x = Math.clamp(xy.x, parseFloat(p1.getAttribute('cx')), 99);
			xy.y = Math.clamp(xy.y, 0, 99);
			updatePath();
			return xy;
		}, updatePath);
		this.draggable(c1, ['x', 'y'], function(xy) {
			xy.x = Math.clamp(xy.x, parseFloat(p1.getAttribute('cx'))-5, parseFloat(p2.getAttribute('cx'))-5);
			xy.y = Math.clamp(xy.y, -5, 94);
			updatePath();
			return xy;
		}, updatePath);
		this.draggable(c2, ['x', 'y'], function(xy) {
			xy.x = Math.clamp(xy.x, parseFloat(p1.getAttribute('cx'))-5, parseFloat(p2.getAttribute('cx'))-5);
			xy.y = Math.clamp(xy.y, -5, 94);
			updatePath();
			return xy;
		}, updatePath);
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
			blend: 1,
			hardness: 1,
			rotation: 0,
			xScale: 1,
			rotateWithStroke: 0,
			smudge: 0,
			curve: CurvePresets.liner,
			texture: 0,
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
		App.modeToggle(this, window.brushShape, App.Mode.BRUSH_SHAPE);

		this.setupCanvas();

		var self = this;
		this.initIndexedDB(function() {
			self.initFilePicker();
			self.addEventListeners();
		}, function(error) {
			self.addEventListeners();
			window.load.style.display = 'none';
			window.save.style.display = 'none';
			window.saveCopy.style.display = 'none';
			window.saveBrush.style.display = 'none';
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

	App.prototype.replay = function() {
		this.replayEndIndex = this.drawEndIndex;
		this.timeTravel(0);
		this.replayInProgress = true;
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

	App.prototype.recordSaveSnapshot = function() {
		var ss = this.createSnapshot();
		while (this.snapshots.length > 0 && this.snapshots[this.snapshots.length-1].index > ss.index) {
			this.snapshots.pop();
		}
		if (this.snapshots.length === 0 || this.snapshots[this.snapshots.length-1].index < ss.index) {
			this.snapshots.push( ss );
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
		this.copyQuad.scale.set(texture.width, -texture.height, 1);
		this.copyQuad.position.set((texture.x || 0) + texture.width/2, (texture.y || 0) + texture.height/2, 0);
		this.copyCamera.right = renderTarget.width;
		this.copyCamera.bottom = renderTarget.height;
		this.copyCamera.updateProjectionMatrix();
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

		var image = { x: 0, y: 0, width: this.width, height: this.height, data: new Uint8Array(this.width*this.height*4) };
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

		this.resizeThese = [
			strokeRenderTarget,
			drawRenderTarget,
			copyRenderTarget
		];

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
		this.copyCamera = new THREE.OrthographicCamera(0, this.width, 0, this.height, near, far);
		this.copyCamera.position.z = 90;
		this.copyScene.add(this.copyCamera);
		this.copyQuadTexture = new THREE.DataTexture(null, this.width, this.height);
		this.copyQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(1, 1),
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

		this.brushTextureLoaded = -1;

		this.maskTexture = new THREE.DataTexture();

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
					"uniform float radius;",
					"uniform float pixelRatio;",
					"uniform float hardness;",
					"uniform float rotation;",
					"uniform float xScale;",
					"uniform float smudge;",

					"void main(void) {",
					"	vec2 uv = vUv;",
					"   uv = (uv - 0.5) * mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) + 0.5;",
					"	uv.x = (uv.x - 0.5) / xScale + 0.5;",
					"	vec4 paintContent = texture2D(paint, vec2(0.5, 0.5));",
					"	vec2 unitUv = (uv - 0.5) * 2.0;",
					"	float maskV = 1.0-texture2D(mask, uv).r;",
					"	float brushOpacity = max(squareBrush, mix(smoothstep(1.0, hardness * max(0.1, 1.0 - (2.0 / (pixelRatio*radius))), length(unitUv)), maskV, textured));",
					"	gl_FragColor.rgb = mix(paintContent.rgb, color, smudge) * opacity * brushOpacity;",
					"	gl_FragColor.a = opacity * brushOpacity;",
					"}"
				].join("\n"),

				uniforms: {
					resolution: { type: 'v2', value: new THREE.Vector2(this.width, this.height) },
					color: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
					opacity: { type: 'f', value: 0.5 },
					paint: { type: 't', value: this.brushRenderTarget },
					mask: { type: 't', value: this.maskTexture },
					radius: { type: 'f', value: 3 },
					hardness: { type: 'f', value: 1 },
					pixelRatio: { type: 'f', value: window.devicePixelRatio || 1 },
					blend: { type: 'f', value: 1 },
					squareBrush: { type: 'f', value: 0 },
					textured: { type: 'f', value: 0 },
					rotation: { type: 'f', value: 0 },
					xScale: { type: 'f', value: 1 },
					smudge: { type: 'f', value: 1 }
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

		var self = this;
		window.onresize = function() {
			self.renderer.setSize(window.innerWidth, window.innerHeight);
			self.width = self.renderer.domElement.width;
			self.height = self.renderer.domElement.height;
			self.resizeThese.forEach(function(rt) {
				rt.setSize(self.width, self.height);
			});

			self.camera.right = window.innerWidth;
			self.camera.bottom = window.innerHeight;
			self.camera.updateProjectionMatrix();

			self.timeTravel(self.drawEndIndex);
		};

		this.endDrawBrush();
	};

	App.prototype.loadBrush = function(src, brushIndex) {
		this.brushTextureLoaded++;
		var self = this;
		var image = new Image();
		image.onload = function() {
			self.brushTextureLoaded--;
			if (!self.drawArray.find(function(c){ return c.type === 'addBrush' && c.name === brushIndex; })) {
				var tex = self.getTextureDataForImage(this);
				self.addBrush(brushIndex, tex);
			}
		};
		image.src = src;
	};

	App.prototype.clearDrawRenderTarget = function() {
		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.strokeRenderTarget);

		this.renderer.setClearColor(0xffffff, 1.0);
		this.renderer.clearTarget(this.drawRenderTarget);
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

	App.prototype.clear = function() {
		this.drawArrayPush({type: 'clear', isStart: true});
		this.endBrush();
	};

	App.prototype.mirror = function() {
		this.drawArrayPush({type: 'mirror', isStart: true});
		this.endBrush();
	};

	App.prototype.updateBrushControls = function() {
		window.colorPicker.update();
		window.opacityChange.update();
		window.brushResize.update();
		window.brushShape.update();
		window.brushRotation.value = this.brush.rotation;
		window.xScale.value = this.brush.xScale;
		window.blending.value = this.brush.blend;
		window.rotateWithStroke.checked = !!this.brush.rotateWithStroke;
		window.smudge.checked = !!this.brush.smudge;
	};

	App.prototype.newDrawing = function() {
		this.timeTravel(0);
		this.drawArray = [];
		this.imageName = null;
	};

	App.prototype.addEventListeners = function() {
		var self = this;

		
		var brush = localStorage.DrawMoreBrush;
		if (brush) {
			try {
				brush = JSON.parse(brush);
				for (var i in brush) {
					this.brush[i] = brush[i];
				}
				this.updateBrushControls();
			} catch(e) {}
		}
		

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
		click(window.savePNG, function() {
			closeMenu();
			self.exportPNG();
		});
		click(window.mirror, this.mirror.bind(this));
		click(window.clear, this.clear.bind(this));
		click(window.replay, function() {
			closeMenu();
			self.replay();
		});


		var paletteColors = document.querySelectorAll('.palette-color');
		var colors = localStorage.DrawMorePalette
		if (colors) {
			try { colors = JSON.parse(colors); }
			catch(e) { colors = null;}
		}
		if (!colors) {
			colors = DefaultPalette;
		}

		for (var i=0; i<paletteColors.length; i++) {
			var pc = paletteColors[i];
			pc.color = colors[i] || [255,255,255];
			pc.style.backgroundColor = 'rgb(' + pc.color.join(",") + ')';
			click(pc, function() {
				self.brush.colorArray = this.color;
				self.brush.color = this.style.backgroundColor;
				window.colorPicker.update();
				self.colorMixer.setColor([this.color[0]/255, this.color[1]/255, this.color[2]/255, 1]);
			});
		}


		this.brushTextureLoaded = 0;
		var brushShapes = document.querySelectorAll('#texture > div > img');
		for (var i=0; i<brushShapes.length; i++) {
			var el = brushShapes[i];
			el.brushId = i;
			click(el, function() {
				var sel = document.querySelector('#texture > .selected');
				if (sel) {
					sel.classList.remove('selected');
				}
				this.parentElement.classList.add('selected');
				self.brush.texture = this.brushId;
				window.brushShape.update();
			});
			if (el.className === 'svg') {
			} else {
				this.loadBrush(el.getAttribute('src'), parseInt(el.brushId));
			}
			if (this.brush.texture === el.brushId) {
				el.parentElement.classList.add('selected');
			}
		}

		window.blending.oninput = function() {
			self.brush.blend = parseFloat(this.value);
			window.brushShape.update();
		};
		window.rotateWithStroke.onchange = function() {
			self.brush.rotateWithStroke = this.checked ? 1 : 0;
			window.brushShape.update();
		};
		window.smudge.onchange = function() {
			self.brush.smudge = this.checked ? 1 : 0;
			window.brushShape.update();
		};
		window.brushRotation.oninput = function() {
			self.brush.rotation = parseFloat(this.value);
			window.brushShape.update();
		};
		window.xScale.oninput = function() {
			self.brush.xScale = parseFloat(this.value);
			window.brushShape.update();
		};

		click(window.exportBrushes, function() {
			var a = document.createElement('a');
			a.href = 'data:text/json,'+JSON.stringify(BrushPresets);
			a.download = 'Drawmore Brushes.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		});

		window.importBrushes.onchange = function() {
			var reader = new FileReader();
			reader.onload = function() {
				var brushes = JSON.parse(reader.result);
				for (var i in brushes) {
					updateBrush(i, brushes[i]);
				}
			};
			reader.readAsText(this.files[0]);
		};

		click(window.saveBrush, function(){
			self.getBrushNamesFromDB(function(names) {
				var name = prompt("Name:" + names.join(", ") + ")");
				var brush = {
					radius: self.brush.radius,
					texture: self.brush.texture,
					curve: {
						radius: self.brush.curve.radius.slice(),
						opacity: self.brush.curve.opacity.slice(),
						blend: self.brush.curve.blend.slice()
					}
				};
				if (name) {
					updateBrush(name, brush);
				}
			});
		});

		var updateBrush = function(name, brush) {
			if (!BrushPresets[name]) {
				createBrush(name);
			}
			BrushPresets[name] = brush;
			if (window.indexedDB) {
				self.putToDB('brushes', name, BrushPresets[name]);
			}
		};

		var createBrush = function(name) {
			var div = document.createElement('div');
			div.appendChild(document.createTextNode(name));
			div.dataset.name = name;
			click(div, function() {
				self.setBrushPreset(BrushPresets[this.dataset.name]);
				self.updateBrushControls();
				closeBrushMenu();
			});
			window.brushShapeControls.appendChild(div);
		};

		for (var name in BrushPresets) {
			createBrush(name);
		}


		if (window.indexedDB || false) {
			this.getBrushesFromDB(function(brushes){
				var names = {};
				brushes.forEach(function(brush) {
					names[brush.name] = true;
					var exists = BrushPresets[brush.name];
					BrushPresets[brush.name] = brush;
					if (!exists) {
						createBrush(brush.name);
					}
				});
				for (var i in BrushPresets) {
					if (!names[i]) {
						self.putToDB('brushes', i, BrushPresets[i]);
					}
				}
			});
		}

		window.penMode.onchange = function(ev) {
			self.penMode = this.checked;
			localStorage.DrawMorePenMode = this.checked;
		};

		window.penMode.checked = this.penMode = (localStorage.DrawMorePenMode === 'true');

		this.draggableCurve(window.opacityCurveCanvas, function() {
			var curve = self.brush.curve;
			curve.opacity = curve.opacity.slice();
			return curve.opacity;
		});
		this.draggableCurve(window.brushSizeCurveCanvas, function() {
			var curve = self.brush.curve;
			curve.radius = curve.radius.slice();
			return curve.radius;
		});
		this.draggableCurve(window.blendCurveCanvas, function() {
			var curve = self.brush.curve;
			curve.blend = (curve.blend || Curves.zero).slice();
			return curve.blend;
		});

		var closeMenu = function() {
			window.menu.classList.add('hidden');
		};

		var closeBrushMenu = function() {
			window.brushShapeControls.classList.add('hidden');
		};

		Object.defineProperty(this, 'imageName', {
			get: function() {
				return this._imageName;
			},

			set: function(v) {
				this._imageName = v;
				window.saveCopy.style.display = v ? 'block' : 'none';
			}
		})

		click(window.save, function() {
			closeMenu();
			var name = self.imageName || Date.now().toString();
			self.imageName = name;
			self.saveImageToDB(name);
		});
		click(window.saveCopy, function() {
			closeMenu();
			var name = Date.now().toString();
			self.imageName = name;
			self.saveImageToDB(name);
		});
		click(window.export, function() {
			closeMenu();
			self.save();
		});
		click(window.load, function() {
			closeMenu();
			clearTimeout(window.filePicker.clearTimeout);
			window.filePicker.innerHTML = 'Cancel <input id="loadFile" type="file"><br><br>';
			window.loadFile.onchange = function(ev) {
				var file = ev.target.files[0];
				var fr = new FileReader();

				fr.onload = function(ev) {
					var m = (/\.png$/i).test(file.name) ? 'loadSerializedImagePNG' : 'loadSerializedImage';
					self[m](ev.target.result).then(function(image) {
						self.drawArray = image.drawArray;
						self.snapshots = image.snapshots;
						self.timeTravel(image.drawEndIndex);
						self.imageName = (new Date()).toString();
					});
				};
				fr.readAsArrayBuffer(file);
				window.filePicker.onclick({preventDefault: function(){}});
			};
			window.filePicker.onclick = function(ev) {
				if (ev.target === window.loadFile) {
					return;
				}
				ev.preventDefault();
				this.classList.add('hidden');
				var self = this;
				this.clearTimeout = setTimeout(function() {
					self.innerHTML = '';
				}, 500);
			}
			if (window.indexedDB) {
				var container = document.createElement('div');
				container.className = 'filePickerContainer';
				window.filePicker.appendChild(container);
				self.buildFilePicker(container);
			}
			window.filePicker.classList.remove('hidden');
		});

		click(window.newDrawing, function() { 
			closeMenu();
			if (confirm("Erase current drawing?")) {
				self.newDrawing();
			}
		});

		function toggleFullScreen() {
		  if (!document.fullscreenElement &&    // alternative standard method
		      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
		    if (document.documentElement.requestFullscreen) {
		      document.documentElement.requestFullscreen();
		    } else if (document.documentElement.msRequestFullscreen) {
		      document.documentElement.msRequestFullscreen();
		    } else if (document.documentElement.mozRequestFullScreen) {
		      document.documentElement.mozRequestFullScreen();
		    } else if (document.documentElement.webkitRequestFullscreen) {
		      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		    }
		  } else {
		    if (document.exitFullscreen) {
		      document.exitFullscreen();
		    } else if (document.msExitFullscreen) {
		      document.msExitFullscreen();
		    } else if (document.mozCancelFullScreen) {
		      document.mozCancelFullScreen();
		    } else if (document.webkitExitFullscreen) {
		      document.webkitExitFullscreen();
		    }
		  }
		  closeMenu();
		}
		click(window.toggleFullScreenButton, toggleFullScreen);

		window.onbeforeunload = function(ev) {
			localStorage.DrawMoreBrush = JSON.stringify(self.brush);

			return "Leaving this page will erase your drawing.";

			if (self.saved) {
				ev.preventDefault();
				return;
			}
			try {
				// self.saveImageToDB('drawingInProgress');
				return;
			} catch(e) {
				return "Leaving this page will erase your drawing.";
			}
		};

		var self = this;
		var curve = self.brush.curve;
		self.plotCurve(window.opacityCurveCanvas, curve.opacity);
		self.plotCurve(window.brushSizeCurveCanvas, curve.radius);
	};

	App.prototype.setBrushPreset = function(preset) {
		for (var i in preset) {
			this.brush[i] = preset[i];
		}

		var self = this;
		var curve = self.brush.curve;
		self.plotCurve(window.opacityCurveCanvas, curve.opacity);
		self.plotCurve(window.brushSizeCurveCanvas, curve.radius);
	};

	App.prototype.exportPNG = function() {
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

	App.prototype.save = function() {
		var filename = 'DrawmoreImage '+(new Date().toString().replace(/:/g, '.'))+ '.drawmore';

		var buffer = this.getSaveImageBuffer();
		var blob = new Blob([buffer]);
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
			points = points || Curves.zero;

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

		var brush = this.brush;
		var curve = brush.curve;
		var blend = brush.blend;
		var texture = brush.texture;
		var radiusCurve = curve.radius;
		var opacityCurve = curve.opacity;
		var blendCurve = curve.blend || Curves.zero;

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
				// console.log('adding', add);
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

			// 12 bytes

			color: brush.colorArray, // 24 bits

			r: brush.r, // 16 bits
			opacity: brush.opacity, // 8 bits
			hardness: brush.hardness, // 8 bits

			rotation: brush.rotation, // 8 bits
			xScale: brush.xScale, // 8 bits

			rotateWithStroke: brush.rotateWithStroke, // 1 bit
			smudge: brush.smudge, // 1 bit

			radiusCurve: radiusCurve, // 8 bits -- index to curve array
			opacityCurve: opacityCurve, // 8 bits
			blendCurve: blendCurve, // 8 bits

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
			} else if (a.type === 'clear') {
				this.clearDrawRenderTarget();
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
						this.curvePoint(a.pressure, a.blendCurve) * a.blend,
						a.smudge,
						a.texture,
						a.hardness,
						a.rotation,
						a.xScale
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
							this.curvePoint(a.pressure, a.blendCurve) * a.blend,
							a.smudge,
							a.texture,
							a.hardness,
							a.rotation + (a.rotateWithStroke ? Math.atan2(dy, dx) : 0),
							a.xScale
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

	App.prototype.renderBrush = function(x, y, r, colorArray, opacity, isStart, blend, smudge, texture, hardness, rotation, xScale) {
		if (isStart) {
			this.colorArray = colorArray.slice(0);
		}
		if (isStart && smudge > 0) {

		} else {
			this.brushQuad.position.set(x, y, 0);
			this.brushQuad.scale.set(r,r,r);
			var m = this.brushQuad.material;
			m.uniforms.opacity.value = opacity;
			m.uniforms.blend.value = blend;
			m.uniforms.smudge.value = 1-smudge;
			m.uniforms.hardness.value = hardness;
			m.uniforms.rotation.value = rotation || 0;
			m.uniforms.xScale.value = xScale || 1;
			if (texture) {
				this.setBrushTexture(texture);
			}
			m.uniforms.textured.value = texture ? 1 : 0;
			m.uniforms.squareBrush.value = 0;
			m.uniforms.radius.value = r;

			m.blending = THREE.CustomBlending;
			m.blendEquation = THREE.AddEquation;
			m.blendSrc = THREE.OneFactor;
			m.blendDst = THREE.OneMinusSrcAlphaFactor;
			m.blendEquationAlpha = THREE.MaxEquation;
			m.blendSrcAlpha = THREE.OneFactor;
			m.blendDstAlpha = THREE.OneFactor;

			if (blend > 0) {
				/*
				blend = 0.9 + 0.1 * (1.0 - blend);

				var pixels = new Uint8Array(4);
				var gl = this.renderer.context;
				this.renderer.setRenderTarget(this.drawRenderTarget);
				gl.readPixels(x, this.height-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				var da = pixels[3] / 255;
				var r = pixels[0] * (1-blend) + this.colorArray[0] * blend;
				var g = pixels[1] * (1-blend) + this.colorArray[1] * blend;
				var b = pixels[2] * (1-blend) + this.colorArray[2] * blend;
				this.colorArray[0] = r;
				this.colorArray[1] = g;
				this.colorArray[2] = b;
				*/
			}
			m.uniforms.color.value.set(this.colorArray[0]/255, this.colorArray[1]/255, this.colorArray[2]/255);
			this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
		}

		if (smudge > 0) {
			this.copyDrawingToBrush(x, y, r);
		}
	};

	App.prototype.nextEndIndex = function() {
		for (var i=this.drawStartIndex+1; i<this.drawArray.length; i++) {
			var a = this.drawArray[i];
			if (a.type === 'end') {
				return i;
			}
		}
		return this.drawArray.length-1;
	};

	App.prototype.tick = function() {
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		if (this.replayInProgress) {
			if (this.drawStartIndex >= this.replayEndIndex) {
				this.replayInProgress = false;
			} else {
				this.needUpdate = true;
				this.drawEndIndex = this.nextEndIndex() + 1;
			}
		}

		if (this.needUpdate && this.brushTextureLoaded === 0) {

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
			if (force === undefined) {
				force = 1;
			}
			if (touch.pointerType != undefined && force === 0.5 && touch.pointerType !== 'pen') {
				// Set touch & mouse force to 1 on IE (why is 0.5 the "not applicable" value?)
				force = 1;
			}
			return force;
		},

		getPenTouch: function(ev) {
			var touches = ev.changedTouches;
			for (var i=0; i<touches.length; i++) {
				var t = touches[i];
				if (t.radiusX == 0 || t.radiusY == 0) {
					//this.app.log(t.radiusX + " \n" + t.radiusY);
					return t;
				}
			}
			if (this.app.penMode) {
				return null;
			}
			return ev.touches[0];
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

			if (!window.palette.isOpen) {
				window.palette.classList.add('hidden');
			}
			this.app.colorMixer.widget.classList.add('hidden');
		},

		endBrushStroke: function() {
			if (this.app.mode === App.Mode.DRAW) {
				this.showUITimeout = setTimeout(function() {
					document.body.classList.remove('hide-ui');
				}, 1000);
				this.app.endBrush();
			}
			this.resetMode();
		},

		moveBrushStroke: function(x, y, pressure) {
			this.app.brush.pressure = pressure;
			if (this.app.mode === App.Mode.DRAW) {
				if (y < 60) {
					if (this.showUITimeout) {
						clearTimeout(this.showUITimeout);
					}
					document.body.classList.add('hide-ui');
				}
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
			var touch = this.getPenTouch(ev, this.app.penMode);
			if (!touch) {
				return;
			}
			this.startBrushStroke(
				touch.clientX,
				touch.clientY,
				this.parsePressure(touch)
			);
		},

		touchend: function(ev) {
			this.endBrushStroke();
		},

		touchcancel: function(ev) {
			this.touchend(ev);
		},

		touchmove: function(ev) {
			var touch = this.getPenTouch(ev);
			if (!touch) {
				return;
			}
			this.moveBrushStroke(
				touch.clientX,
				touch.clientY,
				this.parsePressure(touch)
			);
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

			} else if (targetMode === App.Mode.BRUSH_SHAPE) {

				var texId = app.brush.texture;
				var tex = app.brushTextures[texId];
				if (tex) {
					if (!tex.canvas) {
						var c = tex.canvas = document.createElement('canvas');
						c.width = tex.width;
						c.height = tex.height;
						var ctx = c.getContext('2d');
						var id = ctx.getImageData(0, 0, c.width, c.height);
						for (var i=0; i<id.data.length; i+=4) {
							id.data[i+3] = 255-tex.data[i];
						}
						ctx.putImageData(id, 0, 0);
					}
					toggleCtx.fillStyle = '#AAA';
					toggleCtx.fillRect(0, 0, w, h);

					toggleCtx.save();
					toggleCtx.translate(w/2, h/2);
					toggleCtx.rotate(app.brush.rotation);
					toggleCtx.scale(app.brush.xScale, 1);
					var sw = w*0.8, sh = h*0.8;
					toggleCtx.drawImage(tex.canvas, -sw/2, -sh/2, sw, sh);
					toggleCtx.restore();
				} else {
					toggleCtx.fillStyle = '#AAA';
					toggleCtx.fillRect(0, 0, w, h);

					var gradient = toggleCtx.createRadialGradient(0, 0, 0, 0, 0, h/2-8);
					gradient.addColorStop(0, 'rgba(0,0,0,1)');
					gradient.addColorStop(app.brush.hardness, 'rgba(0,0,0,1)');
					gradient.addColorStop(1, 'rgba(0,0,0,0)');

					toggleCtx.save();
					toggleCtx.translate(w/2, h/2-5);
					toggleCtx.rotate(app.brush.rotation);
					toggleCtx.scale(app.brush.xScale, 1);

					toggleCtx.beginPath();
					toggleCtx.arc(0, 0, h/2-8, 0, Math.PI*2, true);
					toggleCtx.fillStyle = gradient;
					toggleCtx.fill();

					toggleCtx.restore();

					toggleCtx.fillStyle = 'black';

					var rs =  Math.round(app.brush.hardness * 100).toString() + '%';
					var tw = toggleCtx.measureText(rs).width;
					toggleCtx.fillText(rs, w/2-tw/2, h-2);
				}

			} else if (targetMode === App.Mode.BRUSH_RESIZE) {

				if (app.brushCircle) {
					app.brushCircle.style.borderRadius = app.brush.r+2 + 'px';
					app.brushCircle.style.marginLeft = -app.brush.r + 'px';
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
		toggle.update = update;
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
			var c = app.brush.colorArray;
			app.colorMixer.setColor([c[0]/255, c[1]/255, c[2]/255]);
			app.brush.hardness = this.startHardness;
			this.update();
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
				if (colorMixer.widget.classList.contains('hidden')) {
					window.palette.classList.remove('hidden');
					colorMixer.widget.classList.remove('hidden');
					var c = app.brush.colorArray;
					colorMixer.setColor([c[0]/255, c[1]/255, c[2]/255]);
				} else {
					if (!window.palette.isOpen) {
						window.palette.classList.add('hidden');
					}
					colorMixer.widget.classList.add('hidden');
				}
			};

		} else if (targetMode === App.Mode.BRUSH_SHAPE) {
			var toggleBrushShape = function() {
				if (window.brushShapeControls.classList.contains('hidden')) {
					window.brushShapeControls.classList.remove('hidden');
				} else {
					window.brushShapeControls.classList.add('hidden');
				}
			};

		} else if (targetMode === App.Mode.BRUSH_RESIZE) {
			brushCircle = document.createElement('div');
			brushCircle.id = 'brushCircle'
			app.brushCircle = brushCircle;
			document.body.appendChild(brushCircle);
		}

		var wasVisible = false, brushShapeWasVisible = false;
		
		toggle.start = function(ev) {
			this.startRadius = app.brush.r;
			this.startOpacity = app.brush.opacity;
			this.startColor = app.brush.color;
			this.startColorArray = app.brush.colorArray;
			this.startHardness = app.brush.hardness;

			this.startX = ev.clientX;
			this.startY = ev.clientY;

			if (!window.palette.isOpen) {
				window.palette.classList.add('hidden');
			}
			wasVisible = !app.colorMixer.widget.classList.contains('hidden');
			app.colorMixer.widget.classList.add('hidden');
			brushShapeWasVisible = !window.brushShapeControls.classList.contains('hidden');
			window.brushShapeControls.classList.add('hidden');

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
				if (!window.palette.classList.contains('hidden')) {
					var paletteColors = document.querySelectorAll('.palette-color');
					for (var i=0; i<paletteColors.length; i++) {
						if (touchInsideElement(paletteColors[i], ev)) {
							var c = this.startColorArray;
							DefaultPalette[i] = paletteColors[i].color = [c[0], c[1], c[2]];
							paletteColors[i].style.background = 'rgb('+ paletteColors[i].color.join(",") +')';

							this.revertBrush();

							var palette = [];
							for (var j=0; j<paletteColors.length; j++) {
								palette.push(paletteColors[j].color);
							}

							localStorage.DrawMorePalette = JSON.stringify(palette);
							break;
						}
					}
				}
			} else if (targetMode === App.Mode.BRUSH_SHAPE) {
				if (touchInsideElement(this, ev)) {
					if (!brushShapeWasVisible) {
						toggleBrushShape();
					}
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
					app.brush.r = Math.max(0.5, this.startRadius + dx/3 - dy/3);
					break;
				}
				case App.Mode.OPACITY_CHANGE: {
					var dx = ev.clientX - this.startX;
					var dy = ev.clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.opacity = Math.max(0, Math.min(1, this.startOpacity + dx/100 - dy/100));
					break;
				}
				case App.Mode.BRUSH_SHAPE: {
					var dx = ev.clientX - this.startX;
					var dy = ev.clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.hardness = Math.max(0, Math.min(1, this.startHardness + dx/100 - dy/100));
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
						app.colorMixer.setColor([pixels[0]/255, pixels[1]/255, pixels[2]/255, 1]);
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

	window.app = app;
})();
