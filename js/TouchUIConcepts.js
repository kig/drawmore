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

		this.drawArray = [];

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

		this.strokeRenderTarget.texture.generateMipmaps = false;
		this.drawRenderTarget.texture.generateMipmaps = false;

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

		this.brushRenderTarget = new THREE.WebGLRenderTarget(64, 64);
		this.brushRenderTarget.texture.generateMipmaps = false;

		this.brushCamera = new THREE.Camera();
		this.brushCamera.matrixAutoUpdate = false;

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
					"uniform float squareBrush;",
					"uniform sampler2D paint;",

					"void main(void) {",
					"	vec4 paintContent = texture2D(paint, vUv);",
					"	vec2 unitUv = (vUv - 0.5) * 2.0;",
					"	float brushOpacity = max(squareBrush, smoothstep(1.0, 0.9, length(unitUv)));",
					"	gl_FragColor.rgb = mix(paintContent.rgb, color, blend);",
					"	gl_FragColor.a = opacity * brushOpacity;",
					"}"
				].join("\n"),

				uniforms: {
					resolution: { type: 'v2', value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
					color: { type: 'v3', value: new THREE.Vector3(0, 0, 0) },
					opacity: { type: 'f', value: 0.5 },
					paint: { type: 't', value: this.brushRenderTarget },
					blend: { type: 'f', value: 1 },
					squareBrush: { type: 'f', value: 0 },
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

	App.prototype.drawBrushSprite = function(x, y, r, colorArray, opacity, isStart) {
		this.drawArray.push({
			x: x,
			y: y,
			r: r,
			color: colorArray,
			opacity: opacity,
			isStart: isStart
		});
	};

	App.prototype.radiusPressureCurve = function(v) {
		return window.radiusPressure.checked ? v : 1;
	};

	App.prototype.opacityPressureCurve = function(v) {
		return window.opacityPressure.checked ? Math.clamp(v*1.5, 0, 1) : 1;
	};

	App.prototype.drawBrush = function(isStart) {

		var brush = this.brush;

		var dx = brush.x - brush.lastX;
		var dy = brush.y - brush.lastY;
		var dp = brush.pressure - brush.lastPressure;
		var d = Math.sqrt(dx*dx + dy*dy);
		if (d === 0) {
			this.drawBrushSprite(
				brush.x,
				brush.y,
				this.radiusPressureCurve(brush.pressure) * brush.r, 
				brush.colorArray,
				this.opacityPressureCurve(brush.pressure) * brush.opacity,
				isStart
			);
		} else {
			var rdx = dx / d;
			var rdy = dy / d;
			var rdp = dp / d;
			var od = d;
			d = 0;
			while (d < od) {
				var x = (brush.lastX + d*rdx);
				var y = (brush.lastY + d*rdy);
				var p = (brush.lastPressure + d*rdp);

				this.drawBrushSprite(
					brush.lastX + d*rdx,
					brush.lastY + d*rdy,
					this.radiusPressureCurve(p) * brush.r, 
					brush.colorArray,
					this.opacityPressureCurve(p) * brush.opacity,
					isStart
				);
				d += Math.clamp(0.25 * p * brush.r, 0.125, 1);
				isStart = false;
			}
		}

		brush.lastX = brush.x;
		brush.lastY = brush.y;
		brush.lastPressure = brush.pressure;
		this.needUpdate = true;
	};

	App.prototype.endDrawBrush = function() {
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
		m.blendSrcAlpha = THREE.OneFactor;
		m.blendDstAlpha = THREE.ZeroFactor;

		this.renderer.setClearColor(0xffffff, 1.0);
		this.needUpdate = true;
	};

	App.prototype.copyDrawingToBrush = function(x, y, r, screenWidth, screenHeight) {
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
		var screenWidth = this.renderer.domElement.width / this.pixelRatio;
		var screenHeight = this.renderer.domElement.height / this.pixelRatio;
		var blend = window.blending.checked ? 0 : 1;
		for (var i=0; i<this.drawArray.length; i++) {
			var a = this.drawArray[i];
			if (a === 'end') {
				this.endDrawBrush();
			} else {
				var x = a.x, y = a.y, r = a.r, colorArray = a.color, opacity = a.opacity;

				if (a.isStart && blend < 1) {
				} else {
					this.brushQuad.position.set(x, y, 0);
					this.brushQuad.scale.set(r,r,r);
					this.brushQuad.material.uniforms.opacity.value = opacity;
					this.brushQuad.material.uniforms.color.value.set(colorArray[0]/255, colorArray[1]/255, colorArray[2]/255);
					this.brushQuad.material.uniforms.blend.value = blend;
					if (blend < 1) {
						var m = this.brushQuad.material;
						m.blending = THREE.CustomBlending;
						m.blendEquation = THREE.AddEquation;
						m.blendSrc = THREE.SrcAlphaFactor;
						m.blendDst = THREE.OneMinusSrcAlphaFactor;
						m.blendEquationAlpha = THREE.MaxEquation;
						m.blendSrcAlpha = THREE.OneFactor;
						m.blendDstAlpha = THREE.OneFactor;
					} else {
						var m = this.brushQuad.material;
						m.blending = THREE.CustomBlending;
						m.blendEquation = THREE.AddEquation;
						m.blendSrc = THREE.SrcAlphaFactor;
						m.blendDst = THREE.OneMinusSrcAlphaFactor;
						m.blendEquationAlpha = THREE.MaxEquation;
						m.blendSrcAlpha = THREE.OneFactor;
						m.blendDstAlpha = THREE.OneFactor;
					}
					this.brushQuad.material.uniforms.squareBrush.value = 0;
					this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
				}

				if (blend < 1) {
					this.copyDrawingToBrush(x, y, r, screenWidth, screenHeight);
				}
			}
		}
		this.brushQuad.position.set(50, 50, 0);
		this.brushQuad.scale.set(32, 32, 32);
		this.brushQuad.material.uniforms.opacity.value = 1;
		this.brushQuad.material.uniforms.blend.value = 0;
		this.brushQuad.material.uniforms.squareBrush.value = 1;
		this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
	};

	App.prototype.tick = function() {
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		if (this.needUpdate) {

			this.renderDrawArray();
			this.drawArray.splice(0);
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
			if (this.app.mode !== App.Mode.DRAW) {
				this.app.mode = App.Mode.DRAW;
			}
		},

		parsePressure: function(touch) {
			var force = touch.force;
			if (!force && touch.radiusX !== 0) {
				force = 1;
			}
			return force;
		},

		touchstart: function(ev) {
			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;
			this.app.brush.x = ev.touches[0].clientX;
			this.app.brush.y = ev.touches[0].clientY;
			this.app.brush.pressure = this.parsePressure(ev.touches[0]);

			if (this.app.mode === App.Mode.DRAW) {

				this.app.brush.lastX = this.app.brush.x;
				this.app.brush.lastY = this.app.brush.y;
				this.app.brush.lastPressure = this.app.brush.pressure;

				this.app.drawBrush(true);
			}

			this.app.colorMixer.widget.style.display = 'none';
		},

		touchend: function(ev) {
			if (this.app.mode === App.Mode.DRAW) {
				this.app.drawArray.push('end');
				this.app.needUpdate = true;
			}
			this.resetMode();
		},

		touchcancel: function(ev) {
			if (this.app.mode === App.Mode.DRAW) {
				this.app.drawArray.push('end');
				this.app.needUpdate = true;
			}
			this.resetMode();
		},

		touchmove: function(ev) {
			this.app.brush.pressure = this.parsePressure(ev.touches[0]);
			if (this.app.mode === App.Mode.DRAW) {
				this.app.brush.x = ev.touches[0].clientX;
				this.app.brush.y = ev.touches[0].clientY;
				this.app.drawBrush(false);
			}
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
				app.brush.colorArray = [c[0]*255, c[1]*255, c[2]*255, 255];
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
					app.brush.r = Math.max(0.5, this.startRadius - dy/3);
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









	var app = new App();
	app.tick();
})();
