window.ColorMixer = function(container, width, height, callback) {
  for (var i in ColorUtils) {
    this[i] = ColorUtils[i];
  }
  this.initialize(container, width, height, callback);
};

ColorMixer.prototype = {
  hue : 0,
  saturation : 0,
  value : 0,

  initialize: function(container, width, height, callback) {
    var self = this;
    this.callback = callback;

    var pixelRatio = window.devicePixelRatio;
    this.pixelRatio = pixelRatio;

    var widget = document.createElement('div');
    widget.style.position = 'relative';
    widget.style.padding = '0px';
    widget.classList.add('hidden');
    this.widget = widget;
    container.appendChild(this.widget);

    this.canvas = document.createElement('canvas');
    this.canvas.width = (width-8) * pixelRatio;
    this.canvas.height = (height-8) * pixelRatio;
    this.canvas.style.width = (width-8) + 'px';
    this.canvas.style.height = (height-8) + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(pixelRatio, pixelRatio);

    var hueSize = Math.ceil((34+width) * Math.sqrt(2));

    this.hueCanvas = document.createElement('canvas');
    this.hueCanvas.width = this.hueCanvas.height = hueSize * pixelRatio;
    this.hueCanvas.style.width = this.hueCanvas.style.height = hueSize + 'px';
    this.hueCanvas.style.position = 'relative';
    this.hueCanvas.style.top = this.hueCanvas.style.left = '0px';
    widget.appendChild(this.hueCanvas);

    this.svWidget = document.createElement('div');
    this.svWidget.style.position = 'absolute';
    this.svWidget.style.left = Math.floor((hueSize-(width-8))/2) + 'px';
    this.svWidget.style.top = Math.floor((hueSize-(height-8))/2) + 'px';

    this.canvas.style.position = 'absolute';
    this.canvas.style.boxShadow = '0px 0px 4px rgba(0,0,0,0.3)';
    this.canvas.style.top = this.canvas.style.left = '0px';
    this.svWidget.appendChild(this.canvas);

    widget.appendChild(this.svWidget);

    this.hueCtx = this.hueCanvas.getContext('2d');
    this.hueCtx.scale(pixelRatio, pixelRatio);

    this.hueCanvas.update = function(ev) {
      if (this.down) {
        var bbox = this.getBoundingClientRect();
        var xy = {x: ev.clientX-bbox.left, y: ev.clientY-bbox.top};
        var cx = ev.clientX-(bbox.left+bbox.width/2);
        var cy = ev.clientY-(bbox.top+bbox.height/2);
        if (Math.sqrt(cx*cx+cy*cy) > bbox.width/2) {
          return;
        }
        var h = self.hueAtMouseCoords(xy);
        self.setHue(h, true);
      }
    };

    this.canvas.update = function(ev) {
      if (this.down) {
        var bbox = this.getBoundingClientRect();
        var xy = {x: ev.clientX-bbox.left, y: ev.clientY-bbox.top};
        var x = Math.clamp(xy.x, 0, width-9);
        var y = Math.clamp(xy.y, 0, height-9);
        self.saturation = x/(width-9);
        self.value = 1-(y/(height-9));

        self.signalChange();
        self.requestRedraw();
      }
    };

    var addEventListeners = function(el) {
      el.addEventListener('touchstart', function(ev) {
        this.down = true;
        ev.preventDefault();
        this.update(ev.touches[0]);
      }, false);
      el.addEventListener('touchmove', function(ev) { el.update(ev.touches[0]); ev.preventDefault(); }, false);
      el.addEventListener('touchend', function(ev) { this.down = false; }, false);
      el.addEventListener('touchcancel', function(ev) { this.down = false; }, false);

      el.addEventListener('mousedown', function(ev) {
        this.down = true;
        ev.preventDefault();
        this.update(ev);
      }, false);
      window.addEventListener('mousemove', function(ev) { el.update(ev); if (el.down) { ev.preventDefault(); } }, false);
      window.addEventListener('mouseup', function(ev) { el.down = false; }, false);
    };

    addEventListeners(this.canvas);
    addEventListeners(this.hueCanvas);

    var w = this.ctx.createLinearGradient(0,0,0,height-9);
    w.addColorStop(0, 'rgba(0,0,0,0)');
    w.addColorStop(1, 'rgba(0,0,0,1)');
    this.valueGradient = w;
    this.currentColor = this.colorVec(-1,0,0,1);
    this.setHue(0);
  },

  signalChange : function() {
    this.callback(this.hsva2rgba(this.hue, this.saturation, this.value, 1));
  },

  setColor : function(c, signal) {
    var cc = this.currentColor;
    var eq = !cc || (
      (Math.floor(c[0]*255) == Math.floor(cc[0]*255)) &&
      (Math.floor(c[1]*255) == Math.floor(cc[1]*255)) &&
      (Math.floor(c[2]*255) == Math.floor(cc[2]*255))
    );
    if (!eq) {
      var hsv = this.rgb2hsv(c[0], c[1], c[2]);
      if (hsv[2] > 0 && hsv[1] > 0)
        this.setHue(hsv[0], false);
      this.setSaturation(hsv[1], false);
      this.setValue(hsv[2], false);
      this.currentColor = this.colorVec(c[0],c[1],c[2], 1);
    }
    this.requestRedraw();
    if (signal == true) {
      this.signalChange();
    }
  },

  setSaturation : function(s, signal) {
    this.saturation = s;
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  },

  setValue : function(s, signal) {
    this.value = s;
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  },

  setHue : function(hue, signal) {
    this.hue = hue % 360;
    if (this.hue < 0) this.hue += 360;
    this.requestRedraw();
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  },

  hueAtMouseCoords : function(xy) {
    var w2 = this.hueCanvas.width/2/this.pixelRatio;
    var h2 = this.hueCanvas.height/2/this.pixelRatio;
    var dx = xy.x - w2;
    var dy = xy.y - h2;
    var a = Math.PI/2 + Math.atan2(dy,dx);
    if (a < 0) a += 2*Math.PI;
    return (a*180/Math.PI) % 360;
  },

  requestRedraw : function() {
    this.needRedraw = true;
    if (this.app)
      this.app.requestRedraw();
  },

  updateDisplay : function() {
    this.redrawHueCanvas();
    this.redrawSVCanvas();
  },

  redraw : function() {
    if (this.needRedraw) {
      this.updateDisplay();
      this.needRedraw = false;
    }
  },

  redrawHueCanvas : function() {
    var hc = this.hueCtx;
    var deg2rad = Math.PI/180;
    var r = this.canvas.width/this.pixelRatio*0.5 * Math.sqrt(2) + 11.5;
    var w2 = this.hueCanvas.width/2/this.pixelRatio;
    var h2 = this.hueCanvas.height/2/this.pixelRatio;
    hc.save();
    hc.clearRect(0,0,this.hueCanvas.width/this.pixelRatio,this.hueCanvas.height/this.pixelRatio);
    hc.translate(w2,h2);
    hc.lineWidth = 15;

    hc.save();
    hc.shadowOffsetX = 0;
    hc.shadowOffsetY = 1;
    hc.shadowBlur = 5;
    hc.shadowColor = 'rgba(0,0,0,0.8)';
    hc.fillStyle = '#808080';
    hc.beginPath();
    hc.arc(0,0,r+11, 0, Math.PI*2, true);
    hc.fill();
    hc.beginPath();
    hc.arc(0,0,r, 0, Math.PI*2, false);
    hc.strokeStyle = 'black'
    hc.lineWidth = 14;
    hc.stroke();
    hc.restore();

    hc.lineWidth = 15;
    for (var h=0; h<360; h++) {
      var rgb = this.hsv2rgb(h, 1,1);
      rgb[3] = 1;
      hc.strokeStyle = this.colorToStyle(rgb);
      hc.beginPath();
      var a1 = (h-1.5)*deg2rad-Math.PI*0.5;
      var a2 = (h+0.5)*deg2rad-Math.PI*0.5;
      hc.arc(0,0,r, a1, a2, false);
      hc.stroke();
    }
    hc.fillStyle = 'black';
    hc.rotate(this.hue*deg2rad-Math.PI*0.5);
    hc.fillRect(r-8,-2,16,1);
    hc.fillRect(r-8,2,16,1);
    hc.restore();
  },

  redrawSVCanvas : function() {
    var w = this.canvas.width/this.pixelRatio;
    var h = this.canvas.height/this.pixelRatio;
    var rgb = this.hsva2rgba(this.hue, 1, 1, 1);
    var g = this.ctx.createLinearGradient(0, 0, w-1, 0);
    g.addColorStop(0, 'white');
    g.addColorStop(1, this.colorToStyle(rgb));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0,0,w,h);
    this.ctx.fillStyle = this.valueGradient;
    this.ctx.fillRect(0,0,w,h);

    this.ctx.beginPath();
    this.ctx.arc( this.saturation * (this.canvas.width/this.pixelRatio-1), (1-this.value)*(this.canvas.height/this.pixelRatio-1), 8, 0, Math.PI*2, true);
    this.ctx.strokeStyle = 'white';
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc( this.saturation * (this.canvas.width/this.pixelRatio-1), (1-this.value)*(this.canvas.height/this.pixelRatio-1), 7, 0, Math.PI*2, true);
    this.ctx.strokeStyle = 'black';
    this.ctx.stroke();
  }
};
