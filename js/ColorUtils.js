Math.clamp = function(v, min, max) {
  return Math.min(max, Math.max(min, v));
};

window.ColorUtils = {

  colorToStyle : function(c) {
    return (
      'rgba('+Math.floor(c[0]*255)+
          ','+Math.floor(c[1]*255)+
          ','+Math.floor(c[2]*255)+
          ','+c[3]+')'
    );
  },

  colorToHex : function(c, noHash) {
    var r = Math.floor(255*Math.clamp(c[0], 0, 1));
    var g = Math.floor(255*Math.clamp(c[1], 0, 1));
    var b = Math.floor(255*Math.clamp(c[2], 0, 1));
    return [
      noHash ? '' : '#',
      r<16 ? '0' : '', r.toString(16),
      g<16 ? '0' : '', g.toString(16),
      b<16 ? '0' : '', b.toString(16)
    ].join('');
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
    return this.colorVec(r,g,b,a);
  },

  tween : function(a, b, f, dst) {
    var r = dst == null ? new this.colorVecType(a.length) : dst;
    for (var i=0; i<a.length; i++) {
      r[i] = a[i]*(1-f) + b[i]*f;
    }
    return r;
  },

  tweenColor : function(a, b, f, dst) {
    var c = this.tween(a,b,f, dst);
    return this.colorToStyle(c);
  },

  averageColor : function(imageData, dst) {
    var d = imageData.data;
    var r=0, g=0, b=0, a=0;
    for (var i=-1, dl=d.length-1; i<dl;) {
      r += d[++i];
      g += d[++i];
      b += d[++i];
      a += d[++i];
    }
    var l = d.length / 4;
    return this.colorVec( r/l, g/l, b/l, a/l, dst );
  },

  colorAt : function(ctx, x, y, radius, dst) {
    radius = radius || 1;
    var id = ctx.getImageData(x-(radius-1), y-(radius-1), 2*radius-1, 2*radius-1);
    var c = this.averageColor(id, dst);
    c[0] /= 255;
    c[1] /= 255;
    c[2] /= 255;
    c[3] /= 255;
    return c;
  },

  colorVecType : (typeof Float32Array === 'undefined' ? Array : Float32Array),

  colorVec : function(r,g,b,a,dst) {
    if (dst == null)
      dst = new this.colorVecType(4);
    dst[0]=r; dst[1]=g; dst[2]=b; dst[3]=a;
    return dst;
  },

  /**
    Converts an HSL color to its corresponding RGB color.

    @param h Hue in degrees [0 .. 360]
    @param s Saturation [0.0 .. 1.0]
    @param l Lightness [0.0 .. 1.0]
    @param dst Optional array to write the color into.
    @return The corresponding RGB color as [r,g,b]
    @type Array
    */
  hsl2rgb : function(h,s,l,dst) {
    var r,g,b;
    if (s == 0) {
      r=g=b=l;
    } else {
      var q = (l < 0.5 ? l * (1+s) : l+s-(l*s));
      var p = 2 * l - q;
      var hk = (h % 360) / 360;
      var tr = hk + 1/3;
      var tg = hk;
      var tb = hk - 1/3;
      if (tr < 0) tr++;
      if (tr > 1) tr--;
      if (tg < 0) tg++;
      if (tg > 1) tg--;
      if (tb < 0) tb++;
      if (tb > 1) tb--;
      if (tr < 1/6)
        r = p + ((q-p)*6*tr);
      else if (tr < 1/2)
        r = q;
      else if (tr < 2/3)
        r = p + ((q-p)*6*(2/3 - tr));
      else
        r = p;

      if (tg < 1/6)
        g = p + ((q-p)*6*tg);
      else if (tg < 1/2)
        g = q;
      else if (tg < 2/3)
        g = p + ((q-p)*6*(2/3 - tg));
      else
        g = p;

      if (tb < 1/6)
        b = p + ((q-p)*6*tb);
      else if (tb < 1/2)
        b = q;
      else if (tb < 2/3)
        b = p + ((q-p)*6*(2/3 - tb));
      else
        b = p;
    }
    return this.colorVec(r,g,b,1,dst);
  },

  /**
    Converts an HSV color to its corresponding RGB color.

    @param h Hue in degrees [0 .. 360]
    @param s Saturation [0.0 .. 1.0]
    @param v Value [0 .. 1.0]
    @return The corresponding RGB color as [r,g,b]
    @type Array
    */
  hsv2rgb : function(h,s,v,dst) {
    var r,g,b;
    if (s == 0) {
      r=g=b=v;
    } else {
      h = (h % 360)/60.0;
      var i = Math.floor(h);
      var f = h-i;
      var p = v * (1-s);
      var q = v * (1-s*f);
      var t = v * (1-s*(1-f));
      switch (i) {
        case 0:
          r = v;
          g = t;
          b = p;
          break;
        case 1:
          r = q;
          g = v;
          b = p;
          break;
        case 2:
          r = p;
          g = v;
          b = t;
          break;
        case 3:
          r = p;
          g = q;
          b = v;
          break;
        case 4:
          r = t;
          g = p;
          b = v;
          break;
        case 5:
          r = v;
          g = p;
          b = q;
          break;
      }
    }
    return this.colorVec(r,g,b,1,dst);
  },

  hsva2rgba : function(h,s,v,a,dst) {
    var rgb = this.hsv2rgb(h,s,v,dst);
    rgb[3] = a;
    return rgb;
  },

  rgb2cmy : function(r,g,b,dst) {
    return this.colorVec(1-r, 1-g, 1-b, 1, dst);
  },

  cmy2rgb : function(c,m,y,dst) {
    return this.colorVec(1-c, 1-m, 1-y, 1, dst);
  },

  rgba2cmya : function(r,g,b,a,dst) {
    return this.colorVec(1-r, 1-g, 1-b, a, dst);
  },

  cmya2rgba : function(c,m,y,a,dst) {
    return this.colorVec(1-c, 1-m, 1-y, a, dst);
  },

  cmy2cmyk : function(c,m,y,dst) {
    var k = Math.min(c,m,y);
    if (k == 1)
      return this.colorVec(0,0,0,1,dst);
    var k1 = 1-k;
    return this.colorVec((c-k)/k1, (m-k)/k1, (y-k)/k1, k,dst);
  },

  cmyk2cmy : function(c,m,y,k,dst) {
    var k1 = 1-k;
    return this.colorVec(c*k1+k, m*k1+k, y*k1+k, 1, dst);
  },

  cmyk2rgb : function(c,m,y,k,dst) {
    var cmy = this.cmyk2cmy(c,m,y,k,dst);
    return this.cmy2rgb(cmy[0], cmy[1], cmy[2], cmy);
  },

  rgb2cmyk : function(r,g,b,dst) {
    var cmy = this.rgb2cmy(r,g,b,dst);
    return this.cmy2cmyk(cmy[0], cmy[1], cmy[2], cmy);
  },

  rgba2hsva : function(r,g,b,a,dst) {
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
    return this.colorVec(h,s,v,a,dst);
  },

  rgb2hsv : function(r,g,b,dst) {
    return this.rgba2hsva(r,g,b,1,dst);
  }

  // rgb2yiqMatrix : mat3.create([
  //   0.299, 0.587, 0.114,
  //   0.596, -0.275, -0.321,
  //   0.212, -0.523, 0.311
  // ]),
  // rgba2yiqa : function(r,g,b,a,dst) {
  //   return mat3.multiplyVec3(this.rgb2yiqMatrix, this.colorVec(r,g,b,a,dst));
  // },

  // rgb2yiq : function(r,g,b,dst) {
  //   return this.rgba2yiqa(r,g,b,1,dst);
  // },

  // yiq2rgbMatrix : mat3.create([
  //   1, 0.956, 0.621,
  //   1, -0.272, -0.647,
  //   1, -1.105, 1.702
  // ]),
  // yiqa2rgba : function(y,i,q,a,dst) {
  //   return mat3.multiplyVec3(this.yiq2rgbMatrix, this.colorVec(y,i,q,a,dst));
  // },

  // yiq2rgb : function(y,i,q,dst) {
  //   return this.yiqa2rgba(y,i,q,1,dst);
  // },

  // rgb2xyzMatrix : mat3.create([
  //   3.240479, -1.537150, -0.498535,
  //   -0.969256, 1.875992, 0.041556,
  //   0.055648, -0.204043, 1.057311
  // ]),
  // rgba2xyza : function(r,g,b,a,dst) {
  //   return mat3.multiplyVec3(this.rgba2xyzaMatrix, this.colorVec(r,g,b,a,dst));
  // },
  // rgb2xyz : function(r,g,b,dst) {
  //   return this.rgba2xyza(r,g,b,1,dst);
  // },

  // xyz2rgbMatrix : mat3.create([
  //   0.412453, 0.357580, 0.180423,
  //   0.212671, 0.715160, 0.072169,
  //   0.019334, 0.119193, 0.950227
  // ]),
  // xyza2rgba : function(x,y,z,a,dst) {
  //   return mat3.multiplyVec3(this.xyz2rgbMatrix, this.colorVec(x,y,z,a,dst));
  // },
  // xyz2rgb : function(x,y,z,dst) {
  //   return this.xyza2rgba(x,y,z,1,dst);
  // },

  // laba2xyza : function(l,a,b,xn,yn,zn,alpha,dst) {
  //   p = (l + 16.0) / 116.0;
  //   return this.colorVec(
  //     xn * Math.pow(p + a / 500.0, 3),
  //     yn * p*p*p,
  //     zn * Math.pow(p - b / 200.0, 3),
  //     alpha, dst
  //   );
  // },
  // lab2xyz : function(l,a,b,xn,yn,zn,dst) {
  //   return this.laba2xyza(l,a,b,xn,yn,zn,1,dst);
  // },
  // xyza2laba : function(x,y,z,xn,yn,zn,a,dst) {
  //   var f = function(t) {
  //     return (t > 0.008856) ? Math.pow(t,(1.0/3.0)) : (7.787 * t + 16.0/116.0);
  //   };
  //   return this.colorVec(
  //     ((y/yn > 0.008856) ? 116.0 * Math.pow(y/yn, 1.0/3.0) - 16.0 : 903.3 * y/yn),
  //     500.0 * ( f(x/xn) - f(y/yn) ),
  //     200.0 * ( f(y/yn) - f(z/zn) ),
  //     a, dst
  //   );
  // },
  // xyz2lab : function(x,y,z,xn,yn,zn,dst) {
  //   return this.xyza2laba(x,y,z,xn,yn,zn,1,dst);
  // },

  // laba2rgba : function(l,a,b,xn,yn,zn,A,dst) {
  //   var xyza = this.laba2xyza(l,a,b,xn,yn,zn,A,dst)
  //   return this.xyza2rgba(xyza[0], xyza[1], xyza[2], xyza[3], xyza);
  // },
  // lab2rgb : function(l,a,b,xn,yn,zn,dst) {
  //   return this.laba2rgba(l,a,b,xn,yn,zn,1,dst);
  // },

  // rgba2laba : function(r,g,b,a,xn,yn,zn,dst) {
  //   var xyza = this.rgba2xyza(r,g,b,a,dst);
  //   return this.xyza2laba(xyza[0], xyza[1], xyza[2], xn,yn,zn, xyza[3], xyza);
  // },
  // rgb2lab : function(r,g,b,xn,yn,zn,dst) {
  //   return this.rgba2labal(r,g,b,xn,yn,zn,1,dst);
  // },

  // rgb2yuvMatrix : mat3.create([
  //   0.299, 0.587, 0.144,
  //   -0.159, -0.332, 0.050,
  //   0.500, -0.419, -0.081
  // ]),
  // rgba2yuva : function(r,g,b,a,dst) {
  //   return mat3.multiplyVec3(this.rgb2yuvMatrix, this.colorVec(r,g,b,a,dst));
  // },
  // rgb2yuv : function(r,g,b,dst) {
  //   return this.rgba2yuva(r,g,b,1,dst);
  // },

  // yuva2rgba : function(y,u,v,a,dst) {
  //   return this.colorVec(
  //     y + (1.4075 * (v - 128)),
  //     y - (0.3455 * (u - 128) - (0.7169 * (v - 128))),
  //     y + (1.7790 * (u - 128)),
  //     a, dst
  //   );
  // },
  // yuv2rgb : function(y,u,v,dst) {
  //   return this.yuva2rgba(y,u,v,1,dst);
  // }

};

