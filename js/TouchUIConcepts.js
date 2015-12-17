(function() {

	var pixelRatio = window.devicePixelRatio;


	var toColor = function(c) {
		return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'
	};

	var blend = function(a, b, f) {
		return [
			(1-f)*a[0] + f*b[0],
			(1-f)*a[1] + f*b[1],
			(1-f)*a[2] + f*b[2]
		];
	};

	
	var canvas = document.createElement('canvas');
	canvas.width = window.innerWidth * pixelRatio;
	canvas.height = window.innerHeight * pixelRatio;
	canvas.id = 'brush-canvas';

	document.body.appendChild(canvas);

	var ctx = canvas.getContext('2d');

	var drawCanvas = document.createElement('canvas');
	drawCanvas.width = window.innerWidth * pixelRatio;
	drawCanvas.height = window.innerHeight * pixelRatio;
	drawCanvas.id = 'draw-canvas';

	document.body.appendChild(drawCanvas);

	var drawCtx = drawCanvas.getContext('2d');
	drawCtx.fillStyle = '#fff';
	drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
	
	var strokeCanvas = document.createElement('canvas');
	strokeCanvas.width = window.innerWidth * pixelRatio;
	strokeCanvas.height = window.innerHeight * pixelRatio;
	strokeCanvas.id = 'stroke-canvas';

	document.body.appendChild(strokeCanvas);

	var strokeCtx = strokeCanvas.getContext('2d');
	strokeCtx.fillStyle = '#fff';
	strokeCtx.fillRect(0, 0, strokeCanvas.width, strokeCanvas.height);

	var Mode = {
		DRAW: 0,
		BRUSH_RESIZE: 1,
		OPACITY_CHANGE: 2,
		COLOR_PICKER: 3
	};

	var mode = Mode.DRAW;

	var brush = {
		x: 0,
		y: 0,
		r: 3,
		opacity: 1,
		blend: 0.5,
		color: '#ff0000',
		colorArray: [255,0,0,255]
	};

	var modeToggle = function(toggle, targetMode) {
		var toggleCanvas = document.createElement('canvas');
		var bbox = toggle.getBoundingClientRect(); 
		var w = bbox.width;
		var h = bbox.height;
		toggleCanvas.width = w * pixelRatio;
		toggleCanvas.height = h * pixelRatio;
		toggleCanvas.style.width = w + 'px';
		toggleCanvas.style.height = h + 'px';

		toggle.appendChild(toggleCanvas);

		var toggleCtx = toggleCanvas.getContext('2d');
		toggleCtx.scale(pixelRatio, pixelRatio);

		var update = function() {
			toggleCtx.clearRect(0, 0, w, h);

			if (targetMode === Mode.COLOR_PICKER) {
				toggleCtx.fillStyle = brush.color;
				toggleCtx.fillRect(0, 0, w, h);

			} else if (targetMode === Mode.BRUSH_RESIZE) {

				var r = Math.min(brush.r, h/2 - 15)

				toggleCtx.beginPath();
				toggleCtx.arc(w/2, h/2-5, r, 0, Math.PI*2, true);
				toggleCtx.fillStyle = 'white';
				toggleCtx.fill();

				toggleCtx.fillStyle = 'black';
				if (r < brush.r) {
					toggleCtx.fillRect(w/2-2, h/2-5, 5, 1);
					toggleCtx.fillRect(w/2, h/2-5-2, 1, 5);
				}

				var rs = (Math.round(brush.r * 100) / 100).toString().replace(/(\...).+/, '$1');
				var tw = toggleCtx.measureText(rs).width;
				toggleCtx.fillText(rs, w/2-tw/2, h-2);

			} else if (targetMode === Mode.OPACITY_CHANGE) {
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
				toggleCtx.globalAlpha = brush.opacity;
				toggleCtx.fillRect(0, 0, w, h);
			}
		};
		update();

		toggle.addEventListener('touchstart', function(ev) {
			ev.preventDefault();

			this.startRadius = brush.r;
			this.startOpacity = brush.opacity;
			this.startColor = brush.color;
			this.startColorArray = brush.colorArray;

			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;

			mode = targetMode;
		}, false);

		toggle.addEventListener('touchend', function(ev) {
			ev.preventDefault();
			mode = Mode.DRAW;
		}, false);

		toggle.addEventListener('touchcancel', function(ev) {
			ev.preventDefault();
			brush.r = this.startRadius;
			brush.opacity = this.startOpacity;
			brush.color = this.startColor;
			brush.colorArray = this.startColorArray;
			mode = Mode.DRAW;
		}, false);

		toggle.addEventListener('touchmove', function(ev) {
			ev.preventDefault();
			switch (mode) {
				case Mode.BRUSH_RESIZE: {
					var dx = ev.touches[0].clientX - this.startX;
					var dy = ev.touches[0].clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					brush.r = Math.max(0.25, this.startRadius + dx);
					break;
				}
				case Mode.OPACITY_CHANGE: {
					var dx = ev.touches[0].clientX - this.startX;
					var dy = ev.touches[0].clientY - this.startY;
					var d = Math.sqrt(dx*dx + dy*dy);
					brush.opacity = Math.max(0, Math.min(1, this.startOpacity - dy/50));
					break;
				}
				case Mode.COLOR_PICKER: {
					var x = Math.floor(ev.touches[0].clientX * pixelRatio);
					var y = Math.floor(ev.touches[0].clientY * pixelRatio);
					var c = drawCtx.getImageData(x, y, 1, 1);
					brush.color = toColor(c.data);
					brush.colorArray = c.data;
					break;
				}
			}

			update();
		}, false);
	};

	modeToggle(window.brushResize, Mode.BRUSH_RESIZE);
	modeToggle(window.opacityChange, Mode.OPACITY_CHANGE);
	modeToggle(window.colorPicker, Mode.COLOR_PICKER);

	var eventHandler = {
		handleEvent: function(ev) {
			ev.preventDefault();
			if (this[ev.type]) {
				this[ev.type](ev);
			}
		},

		startX: 0,
		startY: 0,
		startRadius: 0,
		startOpacity: 1,
		startColor: '#ff0000',
		touchActive: false,

		resetMode: function() {
			this.touchActive = false;
			if (mode !== Mode.DRAW) {
				mode = Mode.DRAW;
				var toggles = document.querySelectorAll('.mode-toggle');
				for (var i = 0; i < toggles.length; i++) {
					toggles[i].classList.remove('active');
				}
			}
		},

		log: function(txt) {
			drawCtx.fillStyle = '#fff';
			drawCtx.fillRect(0,0, 200, 50);
			drawCtx.fillStyle = '#000';
			drawCtx.font = '40px sans-serif';
			drawCtx.fillText(txt, 5, 40);
		},

		touchstart: function(ev) {
			this.touchActive = true;
			this.startRadius = brush.r;
			this.startOpacity = brush.opacity;
			this.startColor = brush.color;
			this.startColorArray = brush.colorArray;

			this.startX = ev.touches[0].clientX;
			this.startY = ev.touches[0].clientY;
			brush.x = ev.touches[0].clientX;
			brush.y = ev.touches[0].clientY;
			brush.pressure = ev.touches[0].force;

			if (mode === Mode.BRUSH_RESIZE) {
				brush.x += -50;
				brush.y += -50;
			} else if (mode === Mode.OPACITY_CHANGE) {
				brush.x += -50;
				brush.y += -50;
			} else if (mode === Mode.COLOR_PICKER) {
				var x = Math.floor(brush.x * pixelRatio);
				var y = Math.floor(brush.y * pixelRatio);
				var c = drawCtx.getImageData(x, y, 1, 1);
				brush.color = toColor(c.data);
				brush.colorArray = c.data;
			} else if (mode === Mode.DRAW) {
				brush.blend = 1-ev.touches[0].force;
				drawBrush(true);
			}
		},

		touchend: function(ev) {
			if (mode === Mode.DRAW) {
				endDrawBrush();
			}
			this.resetMode();
		},

		touchcancel: function(ev) {
			this.resetMode();
			brush.r = this.startRadius;
			brush.opacity = this.startOpacity;
			brush.color = this.startColor;
			brush.colorArray = this.startColorArray;
		},

		touchmove: function(ev) {
			brush.pressure = ev.touches[0].force;
			if (mode === Mode.BRUSH_RESIZE) {
				var dx = ev.touches[0].clientX - this.startX;
				var dy = ev.touches[0].clientY - this.startY;
				var d = Math.sqrt(dx*dx + dy*dy);
				this.log(Math.floor(dx));
				brush.r = Math.max(1, this.startRadius + dx);
			} else if (mode === Mode.OPACITY_CHANGE) {
				var dx = ev.touches[0].clientX - this.startX;
				var dy = ev.touches[0].clientY - this.startY;
				var d = Math.sqrt(dx*dx + dy*dy);
				brush.opacity = Math.max(0, Math.min(1, this.startOpacity + dx/100));
			} else if (mode === Mode.COLOR_PICKER) {
				brush.x = ev.touches[0].clientX;
				brush.y = ev.touches[0].clientY; 
				var x = Math.floor(brush.x * pixelRatio);
				var y = Math.floor(brush.y * pixelRatio);
				var c = drawCtx.getImageData(x, y, 1, 1);
				brush.color = toColor(c.data);
				brush.colorArray = c.data;
			} else if (mode === Mode.DRAW) {
				brush.x = ev.touches[0].clientX;
				brush.y = ev.touches[0].clientY;
				brush.blend = 1-ev.touches[0].force;
				drawBrush(false);
			}
		}
	};

	canvas.addEventListener("touchstart", eventHandler, false);
	canvas.addEventListener("touchend", eventHandler, false);
	canvas.addEventListener("touchcancel", eventHandler, false);
	canvas.addEventListener("touchmove", eventHandler, false);

	var drawBrush = function(newStroke) {
		var ctx = strokeCtx;

		ctx.save(); {

			ctx.scale(pixelRatio, pixelRatio);

			ctx.save(); {
				ctx.fillStyle = brush.color;
				ctx.globalAlpha = brush.opacity;
				if (newStroke) {
					// var x = Math.floor(brush.x * pixelRatio);
					// var y = Math.floor(brush.y * pixelRatio);
					// var c = drawCtx.getImageData(x, y, 1, 1);
					// ctx.beginPath();
					// ctx.fillStyle = toColor
					// ctx.arc(brush.x, brush.y, brush.r, 0, Math.PI*2, true);
					// ctx.fill();
				} else {
					var dx = brush.x - brush.lastX;
					var dy = brush.y - brush.lastY;
					var d = Math.sqrt(dx*dx + dy*dy);
					var rdx = dx / d;
					var rdy = dy / d;
					while (d > 0) {
						var x = Math.floor((brush.lastX + d*rdx) * pixelRatio);
						var y = Math.floor((brush.lastY + d*rdy) * pixelRatio);
						var c = drawCtx.getImageData(x, y, 1, 1);
						ctx.fillStyle = toColor(blend(brush.colorArray, c.data, brush.blend));
						ctx.beginPath();
						ctx.arc(brush.lastX + d*rdx, brush.lastY + d*rdy, brush.r, 0, Math.PI*2, true);
						ctx.fill();
						d -= 0.5 * brush.r;
					}
				}
			} ctx.restore();

		} ctx.restore();

		brush.lastX = brush.x;
		brush.lastY = brush.y;
	};

	var endDrawBrush = function() {
		var ctx = strokeCtx;
		drawCtx.drawImage(strokeCanvas, 0, 0);
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);			
	};

	var tick = function() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (mode !== Mode.DRAW && eventHandler.touchActive) {
			ctx.save(); {

				ctx.scale(pixelRatio, pixelRatio);

				ctx.save(); {
					if (mode === Mode.COLOR_PICKER) {
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
						if (mode === Mode.OPACITY_CHANGE) {
							ctx.globalAlpha = brush.opacity;
							ctx.fillStyle = brush.color;
							ctx.fill();
						}
					}
				} ctx.restore();

			} ctx.restore();
		}

		window.requestAnimationFrame(tick);
	};

	tick();
})();
