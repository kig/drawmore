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
  
  drawQuad : function(ctx, color, x1,y1, x2,y2, x3,y3, x4,y4) {
    var cx = (x1+x2+x3+x4) / 4;
    var cy = (y1+y2+y3+y4) / 4;
    var points = [{x:x1,y:y1}, {x:x2,y:y2}, {x:x3,y:y3}, {x:x4,y:y4}];
    ctx.drawPolygon(points, color);
  },

  // draw brush at each endpoint
  // for each brush path segment, draw a quad from
  // one endpoint to the other
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    ctx.drawPolygon(this.path.map(function(p){
      return {x: p.x*r1+x1, y: p.y*r1+y1};
    }), color);
    ctx.drawPolygon(this.path.map(function(p){
      return {x: p.x*r2+x2, y: p.y*r2+y2};
    }), color);
    var u = this.path[this.path.length-1];
    var v = this.path[0];
    this.drawQuad(ctx, color,
      x1+u.x*r1, y1+u.y*r1,
      x1+v.x*r1, y1+v.y*r1,
      x2+v.x*r2, y2+v.y*r2,
      x2+u.x*r2, y2+u.y*r2
    );
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i-1];
      var v = this.path[i];
      this.drawQuad(ctx, color,
        x1+u.x*r1, y1+u.y*r1,
        x1+v.x*r1, y1+v.y*r1,
        x2+v.x*r2, y2+v.y*r2,
        x2+u.x*r2, y2+u.y*r2
      );
    }
  }  
});


RoundBrush = Klass(Brush, {
  drawPoint : function(ctx, color, x1, y1, r1) {
    ctx.drawArc(x1, y1, r1, 0, Math.PI*2, color);
  },
  
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    ctx.drawArc(x1, y1, r1, 0, Math.PI*2, color);
    ctx.drawArc(x2, y2, r2, 0, Math.PI*2, color);
    var a = Math.atan2(y2-y1, x2-x1);
    var dx = x2-x1, dy = y2-y1;
    var d = Math.sqrt(dx*dx + dy*dy);
    var ada = Math.asin(Math.abs(r2-r1) / d);
    if (r1 > r2) ada = -ada;
    var da = Math.PI*0.5 + ada;
    var points = [
      {x: Math.cos(a+da)*r1+x1, y: Math.sin(a+da)*r1+y1},
      {x: x1, y: y1},
      {x: Math.cos(a-da)*r1+x1, y: Math.sin(a-da)*r1+y1},
      {x: Math.cos(a-da)*r2+x2, y: Math.sin(a-da)*r2+y2},
      {x: x2, y: y2},
      {x: Math.cos(a+da)*r2+x2, y: Math.sin(a+da)*r2+y2}
    ];
    ctx.drawPolygon(points, color);
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
