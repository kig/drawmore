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
			color: '#ff0000',
			colorArray: [255,0,0,255]
		};

		App.modeToggle(this, window.brushResize, App.Mode.BRUSH_RESIZE);
		App.modeToggle(this, window.opacityChange, App.Mode.OPACITY_CHANGE);
		App.modeToggle(this, window.colorPicker, App.Mode.COLOR_PICKER);

		this.setupCanvas();
		this.addEventListeners();
	};



	App.prototype.setupCanvas = function() {
		var canvas = document.createElement('canvas');
		canvas.width = window.innerWidth * this.pixelRatio;
		canvas.height = window.innerHeight * this.pixelRatio;
		canvas.id = 'brush-canvas';

		document.body.appendChild(canvas);

		var ctx = canvas.getContext('2d');

		var drawCanvas = document.createElement('canvas');
		drawCanvas.width = window.innerWidth * this.pixelRatio;
		drawCanvas.height = window.innerHeight * this.pixelRatio;
		drawCanvas.id = 'draw-canvas';

		document.body.appendChild(drawCanvas);

		var drawCtx = drawCanvas.getContext('2d');
		drawCtx.fillStyle = '#fff';
		drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
		
		var strokeCanvas = document.createElement('canvas');
		strokeCanvas.width = window.innerWidth * this.pixelRatio;
		strokeCanvas.height = window.innerHeight * this.pixelRatio;
		strokeCanvas.id = 'stroke-canvas';

		document.body.appendChild(strokeCanvas);

		var strokeCtx = strokeCanvas.getContext('2d');
		strokeCtx.fillStyle = '#fff';
		strokeCtx.fillRect(0, 0, strokeCanvas.width, strokeCanvas.height);

		this.drawCtx = drawCtx;
		this.ctx = ctx;
		this.strokeCtx = strokeCtx;
		this.canvas = canvas;
		this.strokeCanvas = strokeCanvas;
		this.drawCanvas = drawCanvas;
	};
	
	App.prototype.addEventListeners = function() {
		this.eventHandler = new App.EventHandler(this, this.canvas);
	};

	App.prototype.drawBrush = function(newStroke) {
		var ctx = this.strokeCtx;
		var brush = this.brush;

		ctx.save(); {

			ctx.scale(this.pixelRatio, this.pixelRatio);

			ctx.save(); {
				ctx.fillStyle = brush.color;
				ctx.globalAlpha = brush.opacity;
				if (newStroke) {
					// var x = Math.floor(brush.x * app.pixelRatio);
					// var y = Math.floor(brush.y * app.pixelRatio);
					// var c = drawCtx.getImageData(x, y, 1, 1);
					// ctx.beginPath();
					// ctx.fillStyle = toColor
					// ctx.arc(brush.x, brush.y, brush.r, 0, Math.PI*2, true);
					// ctx.fill();
				} else {
					var dx = brush.x - brush.lastX;
					var dy = brush.y - brush.lastY;
					var dp = brush.pressure - brush.lastPressure;
					var d = Math.sqrt(dx*dx + dy*dy);
					var rdx = dx / d;
					var rdy = dy / d;
					var rdp = dp / d;
					while (d > 0) {
						var x = Math.floor((brush.lastX + d*rdx) * this.pixelRatio);
						var y = Math.floor((brush.lastY + d*rdy) * this.pixelRatio);
						// var c = drawCtx.getImageData(x, y, 1, 1);
						// ctx.fillStyle = toColor(blend(brush.colorArray, c.data, brush.blend));
						ctx.beginPath();
						ctx.arc(brush.lastX + d*rdx, brush.lastY + d*rdy, (brush.lastPressure + d*rdp) * brush.r, 0, Math.PI*2, true);
						d -= Math.max(0.25, 0.5 * (brush.lastPressure + d*rdp) * brush.r);
						ctx.fill();
					}
				}
			} ctx.restore();

		} ctx.restore();

		brush.lastX = brush.x;
		brush.lastY = brush.y;
		brush.lastPressure = brush.pressure;
	};

	App.prototype.endDrawBrush = function() {
		var ctx = this.strokeCtx;
		this.drawCtx.drawImage(ctx.canvas, 0, 0);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);			
	};

	App.prototype.tick = function() {
		var ctx = this.ctx;
		var brush = this.brush;
		var mode = this.mode;
		var pixelRatio = this.pixelRatio;

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		if (mode !== App.Mode.DRAW && this.eventHandler.touchActive) {
			ctx.save(); {

				ctx.scale(pixelRatio, pixelRatio);

				ctx.save(); {
					if (mode === App.Mode.COLOR_PICKER) {
						ctx.beginPath();
						ctx.fillStyle = brush.color;
						ctx.fillRect(brush.x-60, brush.y-60, 20, 20);
						ctx.fill();
					} else {
						ctx.beginPath();
						ctx.arc(brush.x, brush.y, brush.r+1, 0, Math.PI*2, true);
						ctx.strokeStyle = '#000';
						ctx.stroke();
						ctx.beginPath();
						ctx.arc(brush.x, brush.y, brush.r, 0, Math.PI*2, true);
						ctx.strokeStyle = '#fff';
						ctx.stroke();
						if (mode === App.Mode.OPACITY_CHANGE) {
							ctx.globalAlpha = brush.opacity;
							ctx.fillStyle = brush.color;
							ctx.fill();
						}
					}
				} ctx.restore();

			} ctx.restore();
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
			}
		};
		update();

		toggle.addEventListener('touchstart', function(ev) {
			ev.preventDefault();

			this.startRadius = app.brush.r;
			this.startOpacity = app.brush.opacity;
			this.startColor = app.brush.color;
			this.startColorArray = app.brush.colorArray;

			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;

			app.mode = targetMode;
		}, false);

		toggle.addEventListener('touchend', function(ev) {
			ev.preventDefault();
			app.mode = App.Mode.DRAW;
		}, false);

		toggle.addEventListener('touchcancel', function(ev) {
			ev.preventDefault();
			app.brush.r = this.startRadius;
			app.brush.opacity = this.startOpacity;
			app.brush.color = this.startColor;
			app.brush.colorArray = this.startColorArray;
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
					app.brush.r = Math.max(0.25, this.startRadius + dx);
					break;
				}
				case App.Mode.OPACITY_CHANGE: {
					var dx = ev.touches[0].clientX - this.startX;
					var dy = ev.touches[0].clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					app.brush.opacity = Math.max(0, Math.min(1, this.startOpacity - dy/50));
					break;
				}
				case App.Mode.COLOR_PICKER: {
					var x = Math.floor(ev.touches[0].clientX * app.pixelRatio);
					var y = Math.floor(ev.touches[0].clientY * app.pixelRatio);
					var c = app.drawCtx.getImageData(x, y, 1, 1);
					app.brush.color = App.toColor(c.data);
					app.brush.colorArray = c.data;
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

			if (this.app.mode === App.Mode.COLOR_PICKER) {
				var x = Math.floor(this.app.brush.x * this.app.pixelRatio);
				var y = Math.floor(this.app.brush.y * this.app.pixelRatio);
				var c = this.app.drawCtx.getImageData(x, y, 1, 1);
				this.app.brush.color = App.toColor(c.data);
				this.app.brush.colorArray = c.data;
			} else if (this.app.mode === App.Mode.DRAW) {
				this.app.brush.blend = 1-ev.touches[0].force;
				this.app.drawBrush(true);
			}
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
				this.app.drawBrush(false);
			}
		}
	};





	var app = new App();
	app.tick();
})();
