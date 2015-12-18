(function() {

	var App = function() {
		this.init();
	};

	App.prototype.init = function() {
		this.pixelRatio = window.devicePixelRatio;
		this.mode = App.Mode.DRAW;

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

		App.modeToggle(this, window.brushResize, App.Mode.BRUSH_RESIZE);
		App.modeToggle(this, window.opacityChange, App.Mode.OPACITY_CHANGE);
		App.modeToggle(this, window.colorPicker, App.Mode.COLOR_PICKER);

		this.setupCanvas();
		this.addEventListeners();
	};



	App.prototype.setupCanvas = function() {

		var width = window.innerWidth;
		var height = window.innerHeight;
		var near = 0.1;
		var far = 100;

		var renderer = new THREE.WebGLRenderer();
		renderer.setClearColor(0xffffff, 1.0);
		renderer.setPixelRatio( this.pixelRatio );
		renderer.setSize(width, height);
		renderer.domElement.id = 'draw-canvas';
		document.body.appendChild(renderer.domElement);

		var strokeRenderTarget = new THREE.WebGLRenderTarget(renderer.domElement.width, renderer.domElement.height);
		var drawRenderTarget = new THREE.WebGLRenderTarget(renderer.domElement.width, renderer.domElement.height);

		this.strokeRenderTarget = strokeRenderTarget;
		this.drawRenderTarget = drawRenderTarget;

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

		this.brushQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(2, 2),
			new THREE.ShaderMaterial({
				vertexShader: [
					"varying vec2 vUv;",

					"void main() {",
					"	vUv = uv;",
					"	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
					"}"
				].join("\n"),
				fragmentShader: [
					"varying vec2 vUv;",

					"uniform vec2 resolution;",
					"uniform vec3 color;",
					"uniform float opacity;",

					"void main(void) {",
					"	vec2 unitUv = (vUv - 0.5) * 2.0;",
					"	gl_FragColor = vec4(color, opacity * smoothstep(1.0, 0.9, length(unitUv)) );",
					"}"
				].join("\n"),
				uniforms: {
					resolution: { type: 'v2', value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
					color: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
					opacity: { type: 'f', value: 0.5 }
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
	
	App.prototype.addEventListeners = function() {
		this.eventHandler = new App.EventHandler(this, this.renderer.domElement);
	};

	App.prototype.drawBrushSprite = function(x, y, r, colorArray, opacity) {

		this.brushQuad.position.set(x, y, 0);
		this.brushQuad.scale.set(r,r,r);
		this.brushQuad.material.uniforms.opacity.value = opacity;
		this.brushQuad.material.uniforms.color.value.set(colorArray[0]/255, colorArray[1]/255, colorArray[2]/255);
		this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
	};

	App.prototype.radiusPressureCurve = function(v) {
		return window.radiusPressure.checked ? v : 1;
	};

	App.prototype.opacityPressureCurve = function(v) {
		return window.opacityPressure.checked ? Math.clamp(v*2, 0, 1) : 1;
	};

	App.prototype.drawBrush = function() {

		var brush = this.brush;

		var dx = brush.x - brush.lastX;
		var dy = brush.y - brush.lastY;
		var dp = brush.pressure - brush.lastPressure;
		var d = Math.sqrt(dx*dx + dy*dy);
		var rdx = dx / d;
		var rdy = dy / d;
		var rdp = dp / d;
		while (d > 0) {
			var x = (brush.lastX + d*rdx);
			var y = (brush.lastY + d*rdy);
			var p = (brush.lastPressure + d*rdp);

			this.drawBrushSprite(
				brush.lastX + d*rdx,
				brush.lastY + d*rdy,
				this.radiusPressureCurve(p) * brush.r, 
				brush.colorArray,
				this.opacityPressureCurve(p) * brush.opacity
			);
			d -= Math.max(0.25, 0.25 * p * brush.r);
		}

		brush.lastX = brush.x;
		brush.lastY = brush.y;
		brush.lastPressure = brush.pressure;
		this.needUpdate = true;
	};

	App.prototype.endDrawBrush = function() {
		this.renderer.render(this.strokeScene, this.strokeCamera, this.drawRenderTarget);
		this.renderer.setClearColor(0xffffff, 0.0);
		this.renderer.clearTarget(this.strokeRenderTarget);
		this.renderer.setClearColor(0xffffff, 1.0);
		this.needUpdate = true;
	};

	App.prototype.tick = function() {
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		if (this.needUpdate) {
			this.renderer.setRenderTarget(null);
			this.renderer.clear();
			this.renderer.render(this.drawScene, this.drawCamera);
			this.renderer.render(this.strokeScene, this.strokeCamera);
			this.needUpdate = false;
		}

		if (this.colorMixer) {
			this.colorMixer.redraw();
		}

		window.requestAnimationFrame(this.ticker);
	};






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

				var r = Math.min(app.brush.r, h/2 - 15)

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
			var cx = ev.changedTouches[0].clientX;
			var cy = ev.changedTouches[0].clientY;
			return (cx < bbox.right && cx > bbox.left && cy < bbox.bottom && cy > bbox.top);
		};

		toggle.revertBrush = function() {
			app.brush.r = this.startRadius;
			app.brush.opacity = this.startOpacity;
			app.brush.color = this.startColor;
			app.brush.colorArray = this.startColorArray;
		};

		var colorMixer;
		if (targetMode === App.Mode.COLOR_PICKER) {
			colorMixer = new ColorMixer(document.body, 100, 100, function(c) {
				app.brush.colorArray[0] = c[0]*255;
				app.brush.colorArray[1] = c[1]*255;
				app.brush.colorArray[2] = c[2]*255;
				app.brush.color = App.toColor(app.brush.colorArray);
				update();
			});
			colorMixer.widget.style.position = 'absolute';
			colorMixer.widget.style.left = '80px';
			colorMixer.widget.style.bottom = '80px';
			colorMixer.widget.style.zIndex = 10;
			colorMixer.redraw();
			app.colorMixer = colorMixer;

			var toggleColorMixer = function() {
				if (colorMixer.widget.style.display === 'none') {
					colorMixer.widget.style.display = 'block';
				} else {
					colorMixer.widget.style.display = 'none';
				}
			};
			toggleColorMixer();

		}

		toggle.addEventListener('touchstart', function(ev) {
			ev.preventDefault();

			this.startRadius = app.brush.r;
			this.startOpacity = app.brush.opacity;
			this.startColor = app.brush.color;
			this.startColorArray = app.brush.colorArray;

			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;

			app.colorMixer.widget.style.display = 'none';

			app.mode = targetMode;
		}, false);

		toggle.addEventListener('touchend', function(ev) {
			ev.preventDefault();
			if (targetMode === App.Mode.COLOR_PICKER) {
				if (touchInsideElement(this, ev)) {
					toggleColorMixer();
					this.revertBrush();
				}
			}
			app.mode = App.Mode.DRAW;
		}, false);

		toggle.addEventListener('touchcancel', function(ev) {
			ev.preventDefault();
			this.revertBrush();
			app.mode = App.Mode.DRAW;
		}, false);

		toggle.addEventListener('touchmove', function(ev) {
			ev.preventDefault();
			var mode = app.mode;
			switch (mode) {
				case App.Mode.BRUSH_RESIZE: {
					var dx = ev.touches[0].clientX - this.startX;
					var dy = ev.touches[0].clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.r = Math.max(0.25, this.startRadius + dx/3);
					break;
				}
				case App.Mode.OPACITY_CHANGE: {
					var dx = ev.touches[0].clientX - this.startX;
					var dy = ev.touches[0].clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.opacity = Math.max(0, Math.min(1, this.startOpacity - dy/100));
					break;
				}
				case App.Mode.COLOR_PICKER: {
					if ( touchInsideElement(this, ev) ) {
						// Touch is still inside element area.
						// Do nothing, maybe the user wants to bring up the color mixer.

					} else { // dragged to outside element area
						var x = Math.floor(ev.touches[0].clientX * app.pixelRatio);
						var y = Math.floor(ev.touches[0].clientY * app.pixelRatio);
						var pixels = new Uint8Array(4);
						var gl = app.renderer.context;
						app.renderer.setRenderTarget(app.drawRenderTarget);
						gl.readPixels(x, app.renderer.domElement.height-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
						app.brush.color = App.toColor(pixels);
						app.brush.colorArray = pixels;
					}
					break;
				}
			}

			update();
		}, false);
	};





	App.Mode = {
		DRAW: 0,
		BRUSH_RESIZE: 1,
		OPACITY_CHANGE: 2,
		COLOR_PICKER: 3
	};




	App.EventHandler = function(app, el) {
		this.app = app;

		this.startX = 0;
		this.startY = 0;
		this.startRadius = 0;
		this.startOpacity = 1;
		this.startColor = '#ff0000';
		this.touchActive = false;

		el.addEventListener("touchstart", this, false);
		el.addEventListener("touchend", this, false);
		el.addEventListener("touchcancel", this, false);
		el.addEventListener("touchmove", this, false);
	};

	App.EventHandler.prototype = {
		handleEvent: function(ev) {
			ev.preventDefault();
			if (this[ev.type]) {
				this[ev.type](ev);
			}
		},

		resetMode: function() {
			this.touchActive = false;
			if (this.app.mode !== App.Mode.DRAW) {
				this.app.mode = App.Mode.DRAW;
				var toggles = document.querySelectorAll('.mode-toggle');
				for (var i = 0; i < toggles.length; i++) {
					toggles[i].classList.remove('active');
				}
			}
		},

		log: function(txt) {
			var drawCtx = this.app.drawCtx;
			drawCtx.fillStyle = '#fff';
			drawCtx.fillRect(0,0, drawCtx.canvas.width, 50);
			drawCtx.fillStyle = '#000';
			drawCtx.font = '40px sans-serif';
			drawCtx.fillText(txt, 5, 40);
		},

		touchstart: function(ev) {
			this.touchActive = true;
			this.startRadius = this.app.brush.r;
			this.startOpacity = this.app.brush.opacity;
			this.startColor = this.app.brush.color;
			this.startColorArray = this.app.brush.colorArray;

			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;
			this.app.brush.x = ev.touches[0].clientX;
			this.app.brush.y = ev.touches[0].clientY;
			this.app.brush.pressure = ev.touches[0].force;

			if (this.app.mode === App.Mode.DRAW) {
				this.app.brush.blend = 1-ev.touches[0].force;

				this.app.brush.lastX = this.app.brush.x;
				this.app.brush.lastY = this.app.brush.y;
				this.app.brush.lastPressure = this.app.brush.pressure;

				this.app.drawBrush();
			}

			this.app.colorMixer.widget.style.display = 'none';
		},

		touchend: function(ev) {
			if (this.app.mode === App.Mode.DRAW) {
				this.app.endDrawBrush();
			}
			this.resetMode();
		},

		touchcancel: function(ev) {
			this.resetMode();
			this.app.brush.r = this.startRadius;
			this.app.brush.opacity = this.startOpacity;
			this.app.brush.color = this.startColor;
			this.app.brush.colorArray = this.startColorArray;
		},

		touchmove: function(ev) {
			this.app.brush.pressure = ev.touches[0].force;
			if (this.app.mode === App.Mode.DRAW) {
				this.app.brush.x = ev.touches[0].clientX;
				this.app.brush.y = ev.touches[0].clientY;
				this.app.brush.blend = 1-ev.touches[0].force;
				this.app.drawBrush();
			}
		}
	};





	var app = new App();
	app.tick();
})();
