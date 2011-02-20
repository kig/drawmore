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

  stipple : false,

  initialize : function(path) {
    this.path = path;
  },

  drawPoint : function(ctx, color, x, y, r) {
    ctx.beginPath();
    ctx.subPolygon(this.path.map(function(p){
      return {x: p.x*r+x, y: p.y*r+y};
    }));
    ctx.fill(color);
  },

  ccwSort : function(points) {
    var cx=0,cy=0;
    for (var i=0; i<points.length; i++) {
      var p = points[i];
      cx += p.x;
      cy += p.y;
    }
    cx /= points.length;
    cy /= points.length;
    for (var i=0; i<points.length; i++) {
      var p = points[i];
      p.a = Math.atan2(p.y-cy, p.x-cx);
    }
    points.sort(function(a,b) {
      return a.a - b.a;
    });
    return points;
  },

  // draw brush at each endpoint
  // for each brush path segment, draw a quad from
  // one endpoint to the other
  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    if (this.stipple) {
      this.drawPoint(ctx, color, x2, y2, r2);
      return;
    }
    ctx.beginPath();
    var u = this.path[this.path.length-1];
    var v = this.path[0];
    ctx.subPolygon(this.ccwSort([
      {x:x1+u.x*r1, y:y1+u.y*r1},
      {x:x1+v.x*r1, y:y1+v.y*r1},
      {x:x2+v.x*r2, y:y2+v.y*r2},
      {x:x2+u.x*r2, y:y2+u.y*r2}
    ]));
    for (var i=1; i<this.path.length; i++) {
      var u = this.path[i-1];
      var v = this.path[i];
      ctx.subPolygon(this.ccwSort([
        {x:x1+u.x*r1, y:y1+u.y*r1},
        {x:x1+v.x*r1, y:y1+v.y*r1},
        {x:x2+v.x*r2, y:y2+v.y*r2},
        {x:x2+u.x*r2, y:y2+u.y*r2}
      ]));
    }
    ctx.subPolygon(this.path.map(function(p){
      return {x: p.x*r1+x1, y: p.y*r1+y1};
    }));
    ctx.subPolygon(this.path.map(function(p){
      return {x: p.x*r2+x2, y: p.y*r2+y2};
    }));
    ctx.fill(color);
  }
});


RoundBrush = Klass(Brush, {
  drawPoint : function(ctx, color, x1, y1, r1) {
    ctx.drawArc(x1, y1, r1, 0, Math.PI*2, color);
  },

  drawLine : function(ctx, color, x1, y1, r1, x2, y2, r2) {
    ctx.beginPath();
    ctx.subArc(x1, y1, r1, 0, Math.PI*2);
    ctx.subArc(x2, y2, r2, 0, Math.PI*2);
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
    ctx.subPolygon(points);
    ctx.fill(color);
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
