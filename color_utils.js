Math.clamp = function(v, min, max) {
  return Math.min(max, Math.max(min, v));
};

ColorUtils = Klass(Magi.Colors, {

  colorToStyle : function(c) {
    return (
      'rgba('+Math.floor(c[0]*255)+
          ','+Math.floor(c[1]*255)+
          ','+Math.floor(c[2]*255)+
          ','+c[3]+')'
    );
  },

  styleToColor : function(c) {
    var r=0,g=0,b=0,a=0;
    if (/^#/.test(c)) {
      r = parseInt(c.substring(1,3), 16) / 255;
      g = parseInt(c.substring(3,5), 16) / 255;
      b = parseInt(c.substring(5,7), 16) / 255;
      a = 1;
      if (c.length == 9)
        a = parseInt(c.substring(7,9), 16) / 255;
    } else if (/^rgba/.test(c)) {
      rgba = c.substring(5,c.length-1).split(",").map(parseFloat);
      r = rgba[0] / 255;
      g = rgba[1] / 255;
      b = rgba[2] / 255;
      a = rgba[3];
    } else if (/^rgb/.test(c)) {
      rgb = c.substring(4,c.length-1).split(",").map(parseFloat);
      r = rgb[0] / 255;
      g = rgb[1] / 255;
      b = rgb[2] / 255;
      a = 1.0;
    }
    return [r,g,b,a];
  },

  tween : function(a, b, f) {
    var r = [];
    for (var i=0; i<a.length; i++) {
      r[i] = a[i]*(1-f) + b[i]*f;
    }
    return r;
  },

  tweenColor : function(a, b, f) {
    var c = this.tween(a,b,f);
    return this.colorToStyle(c);
  },

  averageColor : function(imageData) {
    var d = imageData.data;
    var r=0, g=0, b=0, a=0;
    for (var i=-1, dl=d.length-1; i<dl;) {
      r += d[++i];
      g += d[++i];
      b += d[++i];
      a += d[++i];
    }
    var l = d.length / 4;
    return [ r/l, g/l, b/l, a/l ];
  },

  colorAt : function(ctx, x, y, radius) {
    radius = radius || 1;
    var id = ctx.getImageData(x-(radius-1), y-(radius-1), 2*radius-1, 2*radius-1);
    var c = this.averageColor(id);
    c[0] /= 255;
    c[1] /= 255;
    c[2] /= 255;
    c[3] /= 255;
    return c;
  }
});

ColorPicker = Klass(ColorUtils, {
  hue : 0,

  initialize: function(container, width, height, callback) {
    var self = this;
    this.callback = callback;
    this.canvas = E.canvas(width, height);
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.hueCanvas = E.canvas(width, 15);
    container.appendChild(this.hueCanvas);
    this.hueCtx = this.hueCanvas.getContext('2d');
    this.cursor = new RoundBrushCursor();
    this.cursor.cursorCanvas.style.zIndex = 11;
    container.appendChild(this.cursor.cursorCanvas);
    this.cursor.update(8);
    for (var i=0; i<width; i++) {
      var rgb = this.hsv2rgb(i/width*360, 1,1);
      rgb[3] = 1;
      this.hueCtx.fillStyle = this.colorToStyle(rgb);
      this.hueCtx.fillRect(i,0,1,15);
    }
    this.hueCtx.fillStyle = 'black';
    this.hueCtx.fillRect(0,0,width,3);
    var hc = this.hueCanvas;
    var cc = this.canvas;
    hc.addEventListener('mousedown', function(ev) {
      this.down = true;
      var xy = Mouse.getRelativeCoords(hc, ev);
      var h = Math.clamp(xy.x/width, 0, (width-1)/width);
      self.setHue(h*360);
      var c = self.colorAt(self.ctx, self.cursor.x, self.cursor.y);
      self.callback(c);
      ev.preventDefault();
    }, false);
    cc.addEventListener('mousedown', function(ev) {
      this.down = true;
      var xy = Mouse.getRelativeCoords(cc, ev);
      var x = Math.clamp(xy.x, 0, width-1);
      var y = Math.clamp(xy.y, 0, height-1);
      var c = self.colorAt(self.ctx, x, y);
      self.cursor.moveTo(x, y);
      self.callback(c);
      ev.preventDefault();
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (hc.down) {
        var xy = Mouse.getRelativeCoords(hc, ev);
        var h = Math.clamp(xy.x/width, 0, (width-1)/width);
        self.setHue(h*360);
        var c = self.colorAt(self.ctx, self.cursor.x, self.cursor.y);
        self.callback(c);
        ev.preventDefault();
      } else if (cc.down) {
        var xy = Mouse.getRelativeCoords(cc, ev);
        var x = Math.clamp(xy.x, 0, width-1);
        var y = Math.clamp(xy.y, 0, height-1);
        var c = self.colorAt(self.ctx, x, y);
        var rect = self.canvas.getBoundingClientRect();
        self.cursor.moveTo(x, y);
        self.callback(c);
        ev.preventDefault();
      }
    }, false);
    window.addEventListener('mouseup', function(ev) {
      hc.down = false;
      cc.down = false;
    }, false);
    var w = this.ctx.createLinearGradient(0,0,width-1,height-1);
    w.addColorStop(0, 'rgba(255,255,255,1)');
    w.addColorStop(0.5000, 'rgba(255,255,255,0)');
    w.addColorStop(0.5001, 'rgba(0,0,0,0)');
    w.addColorStop(1, 'rgba(0,0,0,1)');
    this.valueGradient = w;
    this.setHue(0);
  },

  setHue : function(hue) {
    var w = this.canvas.width;
    var h = this.canvas.height;
    var last = this.hsv2rgb(this.hue, 1, 1);
    last[3] = 1;
    this.hueCtx.fillStyle = this.colorToStyle(last);
    this.hueCtx.fillRect(Math.floor(this.hue/360*w), 3, 1, this.hueCanvas.height);
    this.hueCtx.fillStyle = 'black';
    this.hueCtx.fillRect(Math.floor(hue/360*w), 3, 1, this.hueCanvas.height);
    this.hue = hue;
    var rgb = this.hsv2rgb(hue, 1, 1);
    var opposite = this.hsv2rgb(hue, 0, 0);
    var g = this.ctx.createLinearGradient(w-1, 0, 0, h-1);
    rgb[3] = opposite[3] = 1;
    g.addColorStop(1, this.colorToStyle(opposite));
    g.addColorStop(0, this.colorToStyle(rgb));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0,0,w,h);
    this.ctx.fillStyle = this.valueGradient;
    this.ctx.fillRect(0,0,w,h);
  }
});
