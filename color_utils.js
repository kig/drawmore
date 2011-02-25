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
  },

  rgb2cmy : function(r,g,b) {
    return [1-r, 1-g, 1-b];
  },

  cmy2rgb : function(c,m,y) {
    return [1-c, 1-m, 1-y];
  },

  cmy2cmyk : function(c,m,y) {
    var k = Math.min(c,m,y);
    if (k == 1)
      return [0,0,0,1];
    var k1 = 1-k;
    return [(c-k)/k1, (m-k)/k1, (y-k)/k1, k];
  },

  cmyk2cmy : function(c,m,y,k) {
    var k1 = 1-k;
    return [c*k1+k, m*k1+k, y*k1+k];
  },

  cmyk2rgb : function(c,m,y,k) {
    var cmy = this.cmyk2cmy(c,m,y,k);
    return this.cmy2rgb(cmy[0], cmy[1], cmy[2]);
  },

  rgb2cmyk : function(r,g,b) {
    var cmy = this.rgb2cmy(r,g,b);
    return this.cmy2cmyk(cmy[0], cmy[1], cmy[2]);
  },

  rgb2hsv : function(r,g,b) {
    var h=0,s=0,v=0;
    var mini = Math.min(r,g,b);
    var maxi = Math.max(r,g,b);
    var v=maxi;
    var delta = maxi-mini;
    if (maxi > 0) {
      s = delta/maxi;
      if (delta == 0)
        h = 0;
      else if (r == maxi)
        h = (g-b)/delta;
      else if (g == maxi)
        h = 2+(b-r)/delta;
      else
        h = 4+(r-g)/delta;
      h *= 60;
      if (h < 0)
        h += 360;
    }
    return [h,s,v];
  },

  rgb2yiqMatrix : mat3.create([
    0.299, 0.587, 0.114,
    0.596, -0.275, -0.321,
    0.212, -0.523, 0.311
  ]),
  rgb2yiq : function(r,g,b) {
    return mat3.multiplyVec3(this.rgb2yiqMatrix, [r,g,b]);
  },

  yiq2rgbMatrix : mat3.create([
    1, 0.956, 0.621,
    1, -0.272, -0.647,
    1, -1.105, 1.702
  ]),
  yiq2rgb : function(y,i,q) {
    return mat3.multiplyVec3(this.yiq2rgbMatrix, [y,i,q]);
  },

  rgb2xyzMatrix : mat3.create([
    3.240479, -1.537150, -0.498535,
    -0.969256, 1.875992, 0.041556,
    0.055648, -0.204043, 1.057311
  ]),
  rgb2xyz : function(r,g,b) {
    return mat3.multiplyVec3(this.rgb2xyzMatrix, [r,g,b]);
  },

  xyz2rgbMatrix : mat3.create([
    0.412453, 0.357580, 0.180423,
    0.212671, 0.715160, 0.072169,
    0.019334, 0.119193, 0.950227
  ]),
  xyz2rgb : function(x,y,z) {
    return mat3.multiplyVec3(this.xyz2rgbMatrix, [x,y,z]);
  },

  lab2xyz : function(l,a,b,xn,yn,zn) {
    p = (l + 16.0) / 116.0;
    return [
      xn * Math.pow(p + a / 500.0, 3),
      yn * p*p*p,
      zn * Math.pow(p - b / 200.0, 3)
    ];
  },
  xyz2lab : function(x,y,z,xn,yn,zn) {
    var f = function(t) {
      return (t > 0.008856) ? Math.pow(t,(1.0/3.0)) : (7.787 * t + 16.0/116.0);
    };
    return [
      ((y/yn > 0.008856) ? 116.0 * Math.pow(y/yn, 1.0/3.0) - 16.0 : 903.3 * y/yn),
      500.0 * ( f(x/xn) - f(y/yn) ),
      200.0 * ( f(y/yn) - f(z/zn) )
    ];
  },

  lab2rgb : function(l,a,b) {
    var xyz = this.lab2xyz(l,a,b)
    return this.xyz2rgb(xyz[0], xyz[1], xyz[2]);
  },

  rgb2lab : function(r,g,b) {
    var xyz = this.rgb2xyz(r,g,b);
    return this.xyz2lab(xyz[0], xyz[1], xyz[2]);
  },

  rgb2yuvMatrix : mat3.create([
    0.299, 0.587, 0.144,
    -0.159, -0.332, 0.050,
    0.500, -0.419, -0.081
  ]),
  rgb2yuv : function(r,g,b) {
    return mat3.multiplyVec3(cthis.rgb2yuvMatrix, [r,g,b]);
  },

  yuv2rgb : function(y,u,v) {
    return [
      y + (1.4075 * (v - 128)),
      y - (0.3455 * (u - 128) - (0.7169 * (v - 128))),
      y + (1.7790 * (u - 128))
    ];
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
      self.cursor.moveTo(x, y);
      self.signalChange();
      ev.preventDefault();
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (hc.down) {
        var xy = Mouse.getRelativeCoords(hc, ev);
        var h = Math.clamp(xy.x/width, 0, (width-1)/width);
        self.setHue(h*360);
        ev.preventDefault();
      } else if (cc.down) {
        var xy = Mouse.getRelativeCoords(cc, ev);
        var x = Math.clamp(xy.x, 0, width-1);
        var y = Math.clamp(xy.y, 0, height-1);
        self.cursor.moveTo(x, y);
        self.signalChange();
        ev.preventDefault();
      }
    }, false);
    window.addEventListener('mouseup', function(ev) {
      hc.down = false;
      cc.down = false;
    }, false);
    var w = this.ctx.createLinearGradient(0,0,0,height-1);
    w.addColorStop(0, 'rgba(0,0,0,0)');
    w.addColorStop(1, 'rgba(0,0,0,1)');
    this.valueGradient = w;
    this.setHue(0);
  },

  signalChange : function() {
    this.callback(this.colorAt(this.ctx, this.cursor.x, this.cursor.y));
  },

  setColor : function(c, signal) {
    var hsv = this.rgb2hsv(c[0], c[1], c[2]);
    this.setHue(hsv[0], false);
    this.setSaturation(hsv[1], false);
    this.setValue(hsv[2], false);
    if (signal == true)
      this.signalChange();
  },

  setSaturation : function(s, signal) {
    this.cursor.moveTo(s*this.canvas.width, this.cursor.y);
    if (signal == true)
      this.signalChange();
  },

  setValue : function(s, signal) {
    this.cursor.moveTo(this.cursor.x, (1-s)*this.canvas.height);
    if (signal == true)
      this.signalChange();
  },

  setHue : function(hue, signal) {
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
    rgb[3] = 1;
    var white = [1,1,1,1];
    var g = this.ctx.createLinearGradient(0, 0, w-1, 0);
    g.addColorStop(0, this.colorToStyle(white));
    g.addColorStop(1, this.colorToStyle(rgb));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0,0,w,h);
    this.ctx.fillStyle = this.valueGradient;
    this.ctx.fillRect(0,0,w,h);
    if (signal == true)
      this.signalChange();
  }
});
