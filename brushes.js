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
  
  drawQuad : function(ctx, x1,y1, x2,y2, x3,y3, x4,y4) {
    var cx = (x1+x2+x3+x4) / 4;
    var cy = (y1+y2+y3+y4) / 4;
    var points = [[x1,y1], [x2,y2], [x3,y3], [x4,y4]];
    points = points.map(function(p){
      return [p, Math.atan2(cx-p[0], cy-p[1])];
    }).sort(function(a,b){
      return b[1] - a[1];
    }).map(function(a){ return a[0]; });
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.lineTo(points[2][0], points[2][1]);
    ctx.lineTo(points[3][0], points[3][1]);
    ctx.closePath();
  },

  // draw brush at each endpoint
  // for each brush path segment, draw a quad from
  // one endpoint to the other
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    ctx.fillStyle = color;
    ctx.beginPath();
    var u = this.path[0];
    ctx.moveTo(x1+u.x*r1, y1+u.y*r1)
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i];
      ctx.lineTo(x1+u.x*r1, y1+u.y*r1)
    }
    ctx.closePath();
    var u = this.path[0];
    ctx.moveTo(x2+u.x*r2, y2+u.y*r2)
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i];
      ctx.lineTo(x2+u.x*r2, y2+u.y*r2)
    }
    ctx.closePath();
    var u = this.path[this.path.length-1];
    var v = this.path[0];
    this.drawQuad(ctx, 
      x1+u.x*r1, y1+u.y*r1,
      x1+v.x*r2, y1+v.y*r2,
      x2+u.x*r1, y2+u.y*r1,
      x2+v.x*r2, y2+v.y*r2
    );
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i-1];
      var v = this.path[i];
      this.drawQuad(ctx, 
        x1+u.x*r1, y1+u.y*r1,
        x1+v.x*r2, y1+v.y*r2,
        x2+u.x*r1, y2+u.y*r1,
        x2+v.x*r2, y2+v.y*r2
      );
    }
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
      ctx.moveTo(x1+r1*Math.cos(a1), y1+r1*Math.sin(a1));
      ctx.lineTo(x2+r2*Math.cos(a1), y2+r2*Math.sin(a1));
      ctx.lineTo(x2+r2*Math.cos(a2), y2+r2*Math.sin(a2));
      ctx.lineTo(x1+r1*Math.cos(a2), y1+r1*Math.sin(a2));
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
