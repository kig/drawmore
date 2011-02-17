Brush = Klass({
  initialize : function() {},
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {},
  drawPoint : function(ctx, color, x, y, r) {
    this.drawLine(ctx, color, x,y,r, x,y,r);
  },
  
  copy : function(){
    return Object.extend({}, this);
  }
});

PolygonBrush = Klass(Brush, {

  initialize : function(path) {
    this.path = path;
  },

  // for each brush path segment, draw a quad from
  // one endpoint to the other
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    ctx.beginPath();
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i-1];
      var v = this.path[i];
      ctx.moveTo(x1+u.x*r1, y1+u.y*r1);
      ctx.lineTo(x2+u.x*r2, y2+u.y*r2);
      ctx.lineTo(x2+v.x*r2, y2+v.y*r2);
      ctx.lineTo(x1+v.x*r1, y1+v.y*r1);
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }  
});


RoundBrush = Klass(Brush, {
  drawPoint : function(ctx, color, x1, y1, r1) {
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
  },
  
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    if (r1 == r2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = r1*2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1+r1*Math.cos(a11), y1+r1*Math.sin(a11));
      ctx.lineTo(x2+r2*Math.cos(a21), y1+r1*Math.sin(a21));
      ctx.lineTo(x2+r2*Math.cos(a22), y1+r1*Math.sin(a22));
      ctx.lineTo(x1+r1*Math.cos(a12), y1+r1*Math.sin(a12));
      ctx.closePath();
      ctx.moveTo(x1,y1);
      ctx.arc(x1, y1, r1, 0, Math.PI*2);
      ctx.closePath();
      ctx.moveTo(x2,y2);
      ctx.arc(x2, y2, r2, 0, Math.PI*2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
});


ImageBrush = Klass(Brush, {

  spacing : 0.2,

  initialize : function(image, spacing) {
    this.image = image;
    if (spacing)
      this.setSpacing(spacing);
  },
  
  setSpacing : function(spacing) {
    if (spacing <= 0)
      throw (new Error("ImageBrush.setSpacing: bad spacing "+spacing));
    this.spacing = spacing;
  },

  // draw brush image every spacing*image.radius
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    var dx = x2-x1;
    var dy = y2-y1;
    var d = Math.sqrt(dx*dx+dy*dy);
    var i = 0;
    var iw = this.image.width;
    var ih = this.image.height;
    var max = Math.max(iw,ih);
    while (i<=d) {
      var f = i/d;
      var r = r1*(1-f) + r2*f;
      var x = x1*(1-f) + x2*f;
      var y = y1*(1-f) + y2*f;
      var s = r / max;
      var w = w*s, h = h*s;
      ctx.drawImage(this.image, x-w/2, y-h/2, w, h);
      i += Math.max(0.5, this.spacing * r);
    }
  }
});
