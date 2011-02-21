Layer = Klass({
  display : true,
  x : 0,
  y : 0,
  opacity : 1,
  zIndex : 0,
  globalAlpha : 1,

  initialize : function(){},

  copy : function() {
    var l = Object.extend({}, this);
    this.copyProperties(l);
    return l;
  },

  copyProperties : function(tgt) {
  },

  flip : function() {},

  applyTo : function(ctx){
    if (this.display) {
      ctx.globalAlpha = this.opacity;
      this.compositeTo(ctx);
    }
  },

  compositeTo : function(ctx) {
  },

  show : function(){
    this.display = true;
  },

  hide : function(){
    this.display = false;
  },

  clear : function(){},

  drawPolygon : function(path, color) {},

  drawArc : function(x,y,r,a1,a2, color, lineWidth, stroke, closed) {}

});


CanvasLayer = Klass(Layer, {
  initialize : function(){
    this.canvas = E.canvas(window.innerWidth,window.innerHeight);
    this.ctx = this.canvas.getContext('2d');
  },

  copyProperties : function(tgt) {
    tgt.canvas = E.canvas(this.canvas.width, this.canvas.height);
    tgt.ctx = tgt.canvas.getContext('2d');
    tgt.ctx.globalCompositeOperation = 'copy';
    tgt.ctx.drawImage(this.canvas, 0, 0);
    tgt.ctx.globalCompositeOperation = 'source-over';
  },

  compositeTo : function(ctx, opacity) {
    ctx.drawImage(this.canvas, 0, 0);
  },

  beginPath : function() {
    this.ctx.beginPath();
  },

  endPath : function() {
    this.ctx.beginPath();
  },

  fill : function(color) {
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.fill();
  },

  stroke : function(color, lineWidth) {
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.stroke();
  },

  subPolygon : function(path) {
    var ctx = this.ctx;
    ctx.moveTo(path[0].x, path[0].y);
    for (var i=1; i<path.length; i++) {
      var u = path[i];
      ctx.lineTo(u.x, u.y);
    }
    ctx.closePath();
  },

  subArc : function(x,y,r,a1,a2,closed) {
    this.ctx.arc(x,y,r,a1,a2);
    if (closed)
      this.ctx.closePath();
  },

  drawPolygon : function(path, color) {
    this.beginPath();
    this.subPolygon(path);
    this.fill(color);
  },

  drawArc : function(x,y,r,a1,a2, color, lineWidth, stroke, closed) {
    this.beginPath();
    this.subArc(x,y,r,a1,a2,closed);
    if (stroke) {
      this.stroke(color, lineWidth);
    } else {
      this.fill(color);
    }
  },

  drawImage : function(image, x, y) {
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.drawImage(image,x,y);
  },

  flip : function() {
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'copy';
    this.ctx.translate(this.canvas.width,0);
    this.ctx.scale(-1,1);
    this.ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  },

  clear : function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
  }
});


TiledLayer = Klass(Layer, {

  tileSize: 64,

  initialize: function() {
    this.tiles = {};
  },

  copyProperties : function(tgt) {
    tgt.tiles = {};
    for (var f in this.tiles) {
      this.tiles[f].snapshotted = true;
      tgt.tiles[f] = Object.extend({}, this.tiles[f]);
    }
  },

  drawImage: function(img, x, y) {
    var ftx = Math.floor(x / this.tileSize);
    var fty = Math.floor(y / this.tileSize);
    var ltx = Math.floor((x+img.width) / this.tileSize);
    var lty = Math.floor((y+img.height) / this.tileSize);
    for (var tx=ftx; tx <= ltx; tx++) {
      for (var ty=fty; ty <= lty; ty++) {
        // optimize: skip if img is transparent here
        var ctx = this.getTileCtx(tx,ty);
        ctx.globalAlpha = this.globalAlpha;
        ctx.drawImage(img,x-tx*this.tileSize,y-ty*this.tileSize);
      }
    }
  },

  getTile : function(x,y, create) {
    var p=((x + 0x8000) & 0xffff) | (((y + 0x8000) & 0xffff) << 16);
    var t=this.tiles;
    var c=t[p];
    if (create && (c == null || c.snapshotted)) {
      var nc = {
        canvas: E.canvas(this.tileSize, this.tileSize),
        x: x, y: y, snapshotted: false,
        useNewPath: true
      };
      if (c && c.snapshotted) {
        var ctx = nc.canvas.getContext('2d');
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(c.canvas,0,0);
        ctx.globalCompositeOperation = 'source-over';
      }
      c = nc;
      t[p] = c;
      c.context = c.canvas.getContext('2d');
    }
    return c;
  },

  getTileCtx : function(x,y) {
    return this.getTile(x,y,true).context;
  },

  clear : function(){
    this.tiles = {};
  },

  compositeTo : function(ctx) {
    for (var f in this.tiles) {
      var t = this.tiles[f];
      ctx.drawImage(t.canvas, t.x*this.tileSize, t.y*this.tileSize);
    }
  },

  beginPath : function() {
    for (var f in this.tiles) {
      this.tiles[f].useNewPath = true;
      this.tiles[f].hasNewPath = false;
    }
  },

  endPath : function() {
    for (var f in this.tiles) {
      this.tiles[f].useNewPath = false;
    }
  },

  fill : function(color) {
    for (var f in this.tiles) {
      var t = this.tiles[f];
      if (t.hasNewPath) {
        var c = t.context;
        c.fillStyle = color;
        c.globalAlpha = this.globalAlpha;
        c.fill();
        t.hasNewPath = false;
      }
      t.useNewPath = true;
    }
  },

  stroke : function(color, lineWidth) {
    for (var f in this.tiles) {
      var t = this.tiles[f];
      if (t.hasNewPath) {
        var c = t.context;
        c.strokeStyle = color;
        c.lineWidth = lineWidth;
        c.globalAlpha = this.globalAlpha;
        c.stroke();
        t.hasNewPath = false;
      }
      t.useNewPath = true;
    }
  },

  subPolygon : function(path) {
    var hitTiles = [];
    var minX,maxX,minY,maxY;
    minX = maxX = path[0].x;
    minY = maxY = path[0].y;
    for (var i=1; i<path.length; i++) {
      var p = path[i];
      if (p.x < minX) minX = p.x;
      else if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      else if (p.y > maxY) maxY = p.y;
    }
    var fx = Math.floor(minX/this.tileSize);
    var fy = Math.floor(minY/this.tileSize);
    var lx = Math.floor(maxX/this.tileSize);
    var ly = Math.floor(maxY/this.tileSize);
    for (var tx=fx; tx <= lx; tx++)
      for (var ty=fy; ty <= ly; ty++)
        hitTiles.push({x:tx, y:ty});
    for (var j=0; j<hitTiles.length; j++) {
      var tile = hitTiles[j];
      var t = this.getTile(tile.x, tile.y, true);
      var ctx = t.context;
      var ox = tile.x*this.tileSize, oy = tile.y*this.tileSize;
      if (t.useNewPath) {
        ctx.beginPath();
        t.useNewPath = false;
      }
      ctx.moveTo(path[0].x-ox, path[0].y-oy);
      for (var i=1; i<path.length; i++) {
        var u = path[i];
        ctx.lineTo(u.x-ox, u.y-oy);
      }
      ctx.closePath();
      t.hasNewPath = true;
    }
  },

  subArc : function(x,y,r,a1,a2,closed) {
    var hitTiles = [];
    var fx = Math.floor((x-r)/this.tileSize);
    var fy = Math.floor((y-r)/this.tileSize);
    var lx = Math.floor((x+r)/this.tileSize);
    var ly = Math.floor((y+r)/this.tileSize);
    for (var tx=fx; tx <= lx; tx++)
      for (var ty=fy; ty <= ly; ty++)
        hitTiles.push({x:tx, y:ty});
    for (var j=0; j<hitTiles.length; j++) {
      var tile = hitTiles[j];
      var t = this.getTile(tile.x, tile.y, true);
      var ctx = t.context;
      var ox = tile.x*this.tileSize, oy = tile.y*this.tileSize;
      if (t.useNewPath) {
        ctx.beginPath();
        t.useNewPath = false;
      }
      ctx.arc(x-ox,y-oy,r,a1,a2);
      if (closed)
        ctx.closePath();
      t.hasNewPath = true;
    }
  },

  drawPolygon : function(path, color) {
    this.beginPath();
    this.subPolygon(path);
    this.fill(color);
  },

  drawArc : function(x,y,r,a1,a2, color, lineWidth, stroke, closed) {
    this.beginPath();
    this.subArc(x,y,r,a1,a2,closed);
    if (stroke) {
      this.stroke(color, lineWidth);
    } else {
      this.fill(color);
    }
  }

});

