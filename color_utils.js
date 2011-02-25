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
  
  hsva2rgba : function(h,s,v,a) {
    var rgb = this.hsv2rgb(h,s,v);
    rgb.push(a);
    return rgb;
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

  rgba2hsva : function(r,g,b,a) {
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
    return [h,s,v,a];
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
  saturation : 0,
  value : 0,

  initialize: function(container, width, height, callback) {
    var self = this;
    this.callback = callback;
    var widget = DIV();
    widget.style.position = 'relative';
    widget.style.padding = '0px';
    this.widget = widget;
    container.appendChild(this.widget);
    this.canvas = E.canvas(width-8, height-8);
    this.ctx = this.canvas.getContext('2d');
    var hueSize = Math.ceil((34+width) * Math.sqrt(2));
    this.hueCanvas = E.canvas(hueSize, hueSize);
    this.hueCanvas.style.position = 'relative';
    this.hueCanvas.style.top = this.hueCanvas.style.left = '0px';
    widget.appendChild(this.hueCanvas);
    this.svWidget = DIV();
    this.svWidget.style.position = 'absolute';
    this.svWidget.style.left = Math.floor((hueSize-this.canvas.width)/2) + 'px';
    this.svWidget.style.top = Math.floor((hueSize-this.canvas.width)/2) + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.boxShadow =
    this.canvas.style.mozBoxShadow =
    this.canvas.style.webkitBoxShadow = '0px 0px 4px rgba(0,0,0,0.3)';
    this.canvas.style.top = this.canvas.style.left = '0px';
    this.svWidget.appendChild(this.canvas);
    widget.appendChild(this.svWidget);
    this.hueCtx = this.hueCanvas.getContext('2d');
    this.cursor = new RoundBrushCursor();
    this.cursor.cursorCanvas.style.zIndex = 11;
    this.svWidget.appendChild(this.cursor.cursorCanvas);
    this.cursor.update(8);
    var hc = this.hueCanvas;
    var cc = this.canvas;
    hc.addEventListener('mousedown', function(ev) {
      this.down = true;
      var xy = Mouse.getRelativeCoords(hc, ev);
      var h = self.hueAtMouseCoords(xy);
      self.setHue(h);
      ev.preventDefault();
    }, false);
    cc.addEventListener('mousedown', function(ev) {
      this.down = true;
      var xy = Mouse.getRelativeCoords(cc, ev);
      var x = Math.clamp(xy.x, 0, self.canvas.width-1);
      var y = Math.clamp(xy.y, 0, self.canvas.height-1);
      self.saturation = x/(self.canvas.width-1);
      self.value = 1-(y/(self.canvas.width-1));
      self.cursor.moveTo(x, y);
      self.signalChange();
      ev.preventDefault();
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (hc.down) {
        var xy = Mouse.getRelativeCoords(hc, ev);
        var h = self.hueAtMouseCoords(xy);
        self.setHue(h);
        ev.preventDefault();
      } else if (cc.down) {
        var xy = Mouse.getRelativeCoords(cc, ev);
        var x = Math.clamp(xy.x, 0, self.canvas.width-1);
        var y = Math.clamp(xy.y, 0, self.canvas.height-1);
        self.saturation = x/(self.canvas.width-1);
        self.value = 1-(y/(self.canvas.width-1));
        self.cursor.moveTo(x, y);
        self.signalChange();
        ev.preventDefault();
      }
    }, false);
    window.addEventListener('mouseup', function(ev) {
      hc.down = false;
      cc.down = false;
    }, false);
    var w = this.ctx.createLinearGradient(0,0,0,self.canvas.height-1);
    w.addColorStop(0, 'rgba(0,0,0,0)');
    w.addColorStop(1, 'rgba(0,0,0,1)');
    this.valueGradient = w;
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
      this.setHue(hsv[0], false);
      this.setSaturation(hsv[1], false);
      this.setValue(hsv[2], false);
      this.currentColor = [c[0],c[1],c[2]];
    }
    if (signal == true) {
      this.signalChange();
    }
  },

  setSaturation : function(s, signal) {
    this.cursor.moveTo(s*this.canvas.width, this.cursor.y);
    this.saturation = s;
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  },

  setValue : function(s, signal) {
    this.cursor.moveTo(this.cursor.x, (1-s)*this.canvas.height);
    this.value = s;
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  },

  hueAtMouseCoords : function(xy) {
    var w2 = this.hueCanvas.width/2;
    var h2 = this.hueCanvas.height/2;
    var dx = xy.x - w2;
    var dy = xy.y - h2;
    console.log(dx,dy,Math.atan2(dy,dx));
    var a = Math.PI/2 + Math.atan2(dy,dx);
    if (a < 0) a += 2*Math.PI;
    return (a*180/Math.PI) % 360;
  },
  
  redrawHueCanvas : function() {
    var hc = this.hueCtx;
    var deg2rad = Math.PI/180;
    var r = this.canvas.width*0.5 * Math.sqrt(2) + 11.5;
    var w2 = this.hueCanvas.width/2;
    var h2 = this.hueCanvas.height/2;
    hc.save();
    hc.clearRect(0,0,this.hueCanvas.width,this.hueCanvas.height);
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
      var a1 = (h-1)*deg2rad-Math.PI*0.5;
      var a2 = (h+0.5)*deg2rad-Math.PI*0.5;
      hc.arc(0,0,r, a1, a2, false);
      hc.stroke();
    }
    hc.fillStyle = 'black';
    hc.rotate(this.hue*deg2rad-Math.PI*0.5);
    hc.fillRect(r-8,-2,16,4);
    hc.restore();  
  },

  setHue : function(hue, signal) {
    var w = this.canvas.width;
    var h = this.canvas.height;
    this.hue = hue;
    this.redrawHueCanvas();
    var rgb = this.hsva2rgba(hue, 1, 1, 1);
    var white = [1,1,1,1];
    var g = this.ctx.createLinearGradient(0, 0, w-1, 0);
    g.addColorStop(0, this.colorToStyle(white));
    g.addColorStop(1, this.colorToStyle(rgb));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0,0,w,h);
    this.ctx.fillStyle = this.valueGradient;
    this.ctx.fillRect(0,0,w,h);
    if (signal == true) {
      this.currentColor = this.hsv2rgb(this.hue, this.saturation, this.value);
      this.signalChange();
    }
  }
});
