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

	App.prototype.snapshotSeparation = 3000;
	App.prototype.maxSnapshotCount = 6;

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

		this.snapshots = [{ index: 0, state: {} }];
		this.drawArray = [];
		this.drawStartIndex = 0;
		this.drawEndIndex = 0;

		App.modeToggle(this, window.brushResize, App.Mode.BRUSH_RESIZE);
		App.modeToggle(this, window.opacityChange, App.Mode.OPACITY_CHANGE);
		App.modeToggle(this, window.colorPicker, App.Mode.COLOR_PICKER);

		this.setupCanvas();
		this.addEventListeners();
	};

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
					undo is fast and doesn't eat too much memory.

					  |
					  ||
					  |||
					  ||||
					  |||||
					  ||||||
					1 |x|||||
					2 |x|x||||
					3 |x|x|x|||

					4 |x|x|x|x||
					1 |xxx|x|x|||

					4 |xxx|x|x|x||
					2 |xxx|xxx|x|||

					4 |xxx|xxx|x|x||
					3 |xxx|xxx|xxx|||

					4 |xxx|xxx|xxx|x||
					4 |xxx|xxx|xxx|xx||
					4 |xxx|xxx|xxx|xxx||
					1 |xxxxxxx|xxx|xxx|||

					4 |xxxxxxx|xxx|xxx|x||
					4 |xxxxxxx|xxx|xxx|xx||
					4 |xxxxxxx|xxx|xxx|xxx||
					2 |xxxxxxx|xxxxxxx|xxx|||

					4 |xxxxxxx|xxx|xxx|xxx|x||
					4 |xxxxxxx|xxx|xxx|xxx|xx||
					4 |xxxxxxx|xxx|xxx|xxx|xxx||
					3 |xxxxxxx|xxxxxxx|xxxxxxx|||

					FIXME Rebuild snapshots while undoing so that there's always a 
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
		this.copyQuadTexture.image.data = texture.dataU8;
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

		var image = new ImageData(this.renderer.domElement.width, this.renderer.domElement.height);
		var u8 = new Uint8Array(image.data.buffer);
		image.dataU8 = u8;
		gl.readPixels(
			0, 0, image.width, image.height,
			gl.RGBA, gl.UNSIGNED_BYTE, u8
		);
		return {
			index: this.drawEndIndex,
			state: {
				texture: image
			}
		};
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
		var copyRenderTarget = new THREE.WebGLRenderTarget(renderer.domElement.width, renderer.domElement.height);

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
		this.copyQuadTexture = new THREE.DataTexture(null, renderer.domElement.width, renderer.domElement.height);
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

		this.maskTexture = new THREE.TextureLoader().load('texture.png');

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
					"	gl_FragColor.rgb = mix(paintContent.rgb, color, blend);",
					"	gl_FragColor.a = opacity * brushOpacity;",
					"}"
				].join("\n"),

				uniforms: {
					resolution: { type: 'v2', value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
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
		click(window.save, this.save.bind(this));

		click(window.mirror, this.mirror.bind(this));
	};

	App.prototype.save = function() {
		var snap = this.createSnapshot(true);
		var imageData = snap.state.texture;
		var canvas = document.createElement('canvas');
		canvas.width = imageData.width;
		canvas.height = imageData.height;
		var ctx = canvas.getContext('2d');
		ctx.putImageData(imageData, 0, 0);
		var blob;
		// if (canvas.toBlob) {
			// blob = canvas.toBlob();
		// } else {
			var data = canvas.toDataURL();
			var binary = atob(data.slice(data.indexOf(',') + 1));
			var arr = new Uint8Array(binary.length);
			for (var i=0; i<binary.length; i++) {
				arr[i] = binary.charCodeAt(i);
			}
			blob = new Blob([arr]);
		// }
		var dlURL = window.URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = dlURL;
		a.download = 'Drawmore '+(new Date().toString().replace(/:/g, '.'))+ '.png';
		document.body.appendChild(a);
		var clickEvent = new MouseEvent('click', {
			'view': window,
			'bubbles': true,
			'cancelable': false,
		});
		a.dispatchEvent(clickEvent);
		document.body.removeChild(a);
		window.URL.revokeObjectURL(dlURL);
	};

	App.prototype.radiusPressureCurve = function(v) {
		return window.radiusPressure.checked ? v : 1;
	};

	App.prototype.opacityPressureCurve = function(v) {
		return window.opacityPressure.checked ? Math.clamp(v*1.5, 0, 1) : 1;
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

	App.prototype.drawBrush = function(isStart) {

		var brush = this.brush;
		var blend = window.blending.checked ? 0 : 1;
		var textured = window.texturedBrush.checked ? 1 : 0;

		var dx = brush.x - brush.lastX;
		var dy = brush.y - brush.lastY;
		var dp = brush.pressure - brush.lastPressure;
		var d = Math.sqrt(dx*dx + dy*dy);
		if (d === 0) {
			this.drawArrayPush({
				x: brush.x,
				y: brush.y,
				r: this.radiusPressureCurve(brush.pressure) * brush.r, 
				color: brush.colorArray,
				opacity: this.opacityPressureCurve(brush.pressure) * brush.opacity,
				isStart: isStart,
				blend: blend,
				textured: textured
			});
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

				this.drawArrayPush({
					x: brush.lastX + d*rdx,
					y: brush.lastY + d*rdy,
					r: this.radiusPressureCurve(p) * brush.r, 
					color: brush.colorArray,
					opacity: this.opacityPressureCurve(p) * brush.opacity,
					isStart: isStart,
					blend: blend,
					textured: textured
				});
				d += Math.clamp(0.25 * p * brush.r, 0.125, 1);
				isStart = false;
			}
		}

		brush.lastX = brush.x;
		brush.lastY = brush.y;
		brush.lastPressure = brush.pressure;
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
		for (var i=this.drawStartIndex; i<this.drawEndIndex; i++) {
			var a = this.drawArray[i];
			if (a.type === 'end') {
				this.endDrawBrush();
			} else if (a.type === 'mirror') {
				this.mirrorDrawRenderTarget();
			} else {
				var x = a.x, y = a.y, r = a.r, colorArray = a.color, opacity = a.opacity;

				if (a.isStart && a.blend < 1) {

				} else {
					this.brushQuad.position.set(x, y, 0);
					this.brushQuad.scale.set(r,r,r);
					var m = this.brushQuad.material;
					m.uniforms.opacity.value = opacity;
					m.uniforms.color.value.set(colorArray[0]/255, colorArray[1]/255, colorArray[2]/255);
					m.uniforms.blend.value = a.blend;
					m.uniforms.textured.value = a.textured;
					m.uniforms.squareBrush.value = 0;
					if (a.blend < 1) {
						m.blending = THREE.CustomBlending;
						m.blendEquation = THREE.AddEquation;
						m.blendSrc = THREE.SrcAlphaFactor;
						m.blendDst = THREE.OneMinusSrcAlphaFactor;
						m.blendEquationAlpha = THREE.MaxEquation;
						m.blendSrcAlpha = THREE.OneFactor;
						m.blendDstAlpha = THREE.OneFactor;
					} else {
						m.blending = THREE.CustomBlending;
						m.blendEquation = THREE.AddEquation;
						m.blendSrc = THREE.SrcAlphaFactor;
						m.blendDst = THREE.OneMinusSrcAlphaFactor;
						m.blendEquationAlpha = THREE.MaxEquation;
						m.blendSrcAlpha = THREE.OneFactor;
						m.blendDstAlpha = THREE.OneFactor;
					}
					this.renderer.render(this.scene, this.camera, this.strokeRenderTarget);
				}

				if (a.blend < 1) {
					this.copyDrawingToBrush(x, y, r, screenWidth, screenHeight);
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

	App.prototype.tick = function() {
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		if (this.needUpdate) {

			this.renderDrawArray();
			this.drawStartIndex = this.drawEndIndex;
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
		if (targetMode === App.Mode.COLOR_PICKER) {
			colorMixer = new ColorMixer(document.body, 100, 100, function(c) {
				app.brush.colorArray = [c[0]*255, c[1]*255, c[2]*255, 255];
				app.brush.color = App.toColor(app.brush.colorArray);
				update();
			});
			colorMixer.widget.id = 'colorMixer';
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
			app.mode = App.Mode.DRAW;
		};

		toggle.cancel = function() {
			this.revertBrush();
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
						gl.readPixels(x, app.renderer.domElement.height-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
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
