
// a Layer is a composite node
// it can have subnodes

// when a layer has subnodes, the subnodes are evaluated first,
// using a temporary layer as the composition target

LayerManager = Klass({

  initialize : function() {
    this.layerIndex = {};
  },

  addLayer : function(layer) {
    this.layerIndex[layer.uid] = layer;
    for (var i=0; i<layer.childNodes.length; i++)
      this.addLayer(layer.childNodes[i]);
  },

  deleteLayer : function(layer) {
    delete this.layerIndex[layer.uid];
  },

  rebuild : function(layers) {
    this.layerIndex = {};
    for (var i=0; i<layers.length; i++)
      this.addLayer(layers[i]);
    var processedLinks = [];
    for (var i=0; i<layers.length; i++) {
      var layer = layers[i];
      for (var p in layer.linkedProperties) {
        var links = layer.linkedProperties[p];
        if (!links.processed) {
          for (var j=0; j<links.length; j++) {
            this.getLayerByUID(links[j]).linkedProperties[p] = links;
          }
          links.processed = true;
          processedLinks.push(links);
        }
      }
    }
    for (var i=0; i<processedLinks.length; i++)
      delete processedLinks[i].processed;
  },

  getLayerByUID : function(uid) {
    return this.layerIndex[uid];
  }

});

Layer = Klass({
  display : true,
  isLayer : true,
  x : 0,
  y : 0,
  opacity : 1,
  zIndex : 0,
  globalAlpha : 1,
  globalCompositeOperation : 'source-over',

  initialize : function(){
    this.childNodes = [];
    this.linkedProperties = {};
    this.initializeLayer.apply(this, arguments);
  },

  initializeLayer : function() {},

  linkProperty : function(propertyName, layer) {
    var p = this.linkedProperties[propertyName] || layer.linkedProperties[propertyName];
    if (!p)
      p = [layer.uid];
    if (p.indexOf(this.uid) == -1)
      p.push(this.uid);
    if (p.indexOf(layer.uid) == -1)
      p.push(layer.uid);
    layer.linkedProperties[propertyName] = this.linkedProperties[propertyName] = p;
  },

  unlinkProperty : function(propertyName) {
    var p = this.linkedProperties[propertyName];
    if (p) p.deleteFirst(this.uid);
    delete this.linkedProperties[propertyName];
  },

  isPropertyLinkedWith : function(propertyName, layer) {
    if (layer === this) return true;
    var p = this.linkedProperties[propertyName];
    return layer && p != null && p === layer.linkedProperties[propertyName];
  },

  modify : function(propertyName, delta) {
    this[propertyName] += delta;
    var p = this.linkedProperties[propertyName];
    if (p) {
      var uid = this.uid;
      for (var i=0; i<p.length; i++) {
        if (p[i] != uid)
          this.layerManager.getLayerByUID(p[i])[propertyName] += delta;
      }
    }
  },

  set : function(propertyName, value) {
    this[propertyName] = value;
    var p = this.linkedProperties[propertyName];
    if (p) {
      var uid = this.uid;
      for (var i=0; i<p.length; i++) {
        if (p[i] != uid)
          this.layerManager.getLayerByUID(p[i])[propertyName] = value;
      }
    }
  },

  destroy : function() {
    var props = [];
    for (var p in this.linkedProperties)
      props.push(p);
    for (var i=0; i<props.length; i++)
      this.unlinkProperty(props[i]);
  },

  copy : function() {
    var l = Object.extend({}, this);
    l.linkedProperties = {};
    for (var p in this.linkedProperties)
      l.linkedProperties[p] = this.linkedProperties[p].slice(0);
    this.copyProperties(l);
    return l;
  },

  copyProperties : function(tgt) {
  },

  getBoundingBox : function() {
    return null;
  },

  flipX : function() {},
  flipY : function() {},

  applyTo : function(ctx, composite, tempLayer){
    if (this.display) {
      var alpha = ctx.globalAlpha;
      var gco = ctx.globalCompositeOperation;
      if (this.childNodes.length > 0) {
        tempLayer = tempLayer || new TiledLayer();
        this.compositeTo(tempLayer, 1);
        for (var i=0; i<this.childNodes.length; i++) {
          this.childNodes[i].applyTo(tempLayer);
        }
        tempLayer.compositeTo(ctx, this.opacity, composite||this.globalCompositeOperation);
      } else {
        this.compositeTo(ctx, this.opacity, composite);
      }
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = gco;
    }
  },

  appendChild : function(node) {
    if (node.parentNode)
      node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
  },

  removeChild : function(node) {
    this.childNodes.deleteFirst(node);
    node.parentNode = null;
  },

  compositeTo : function(ctx, opacity, composite) {
  },

  show : function(){
    this.display = true;
  },

  hide : function(){
    this.display = false;
  },

  clear : function(){},

  drawPolygon : function(path, color, composite) {},

  drawArc : function(x,y,r,a1,a2, color, composite, lineWidth, stroke, closed) {},

  drawImage : function(image, x, y, w, h, composite) {}

});


CanvasLayer = Klass(Layer, {
  initializeLayer : function(w,h){
    this.canvas = E.canvas(w,h);
    this.ctx = this.canvas.getContext('2d');
  },

  getBoundingBox : function() {
    var w = this.canvas.width;
    var h = this.canvas.height;
    return {left: this.x, top: this.y, right: this.x+w, bottom: this.y+h, width: w, height: h};
  },

  copyProperties : function(tgt) {
    tgt.canvas = E.canvas(this.canvas.width, this.canvas.height);
    tgt.ctx = tgt.canvas.getContext('2d');
    tgt.ctx.globalCompositeOperation = 'copy';
    tgt.ctx.drawImage(this.canvas, 0, 0);
    tgt.ctx.globalCompositeOperation = 'source-over';
  },

  compositeTo : function(ctx, opacity, composite) {
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    var s = this.compensateZoom || 1;
    if (s != 1) { ctx.save(); ctx.scale(1/s, 1/s); }
    ctx.drawImage(this.canvas, this.x, this.y);
    if (s != 1) { ctx.restore(); }
  },

  beginPath : function() {
    this.ctx.beginPath();
  },

  endPath : function() {
    this.ctx.beginPath();
  },

  fill : function(color, composite) {
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    this.ctx.fill();
  },

  stroke : function(color, lineWidth, composite) {
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
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

  drawPolygon : function(path, color, composite) {
    this.beginPath();
    this.subPolygon(path);
    this.fill(color, composite);
  },

  drawArc : function(x,y,r,a1,a2, color, composite, lineWidth, stroke, closed) {
    this.beginPath();
    this.subArc(x,y,r,a1,a2,closed);
    if (stroke) {
      this.stroke(color, lineWidth, composite);
    } else {
      this.fill(color, composite);
    }
  },

  drawImage : function(image, x, y, w, h, composite) {
    this.ctx.save();
    var s = this.compensateZoom || 1;
    this.ctx.scale(s, s);
    this.ctx.globalAlpha = this.globalAlpha;
    this.ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    if (w && h)
      this.ctx.drawImage(image, (x-1/s*this.x), (y-1/s*this.y), w, h);
    else
      this.ctx.drawImage(image, (x-1/s*this.x), (y-1/s*this.y));
    this.ctx.restore();
  },

  flipX : function() {
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'copy';
    this.ctx.translate(this.canvas.width,0);
    this.ctx.scale(-1,1);
    this.ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  },

  flipY : function() {
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'copy';
    this.ctx.translate(0,this.canvas.height);
    this.ctx.scale(1,-1);
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

  initializeLayer: function() {
    this.tiles = {};
  },

  getBoundingBox : function() {
    var top=1/0, left=1/0, bottom=-1/0, right=-1/0;
    for (var f in this.tiles) {
      var tile = this.tiles[f];
      if (tile.y < top) top = tile.y;
      if (tile.x < left) left = tile.x;
      if (tile.y+1 > bottom) bottom = tile.y+1;
      if (tile.x+1 > right) right = tile.x+1;
    }
    return {
      left: this.x+left*this.tileSize, top: this.y+top*this.tileSize,
      right: this.x+right*this.tileSize, bottom: this.y+bottom*this.tileSize,
      width: (right-left+1)*this.tileSize, height: (bottom-top+1)*this.tileSize
    };
  },

  flipX : function() {
    var newTiles = {};
    var bbox = this.getBoundingBox();
    var cx = (bbox.left-this.x) + 0.5*((bbox.right-this.x)-(bbox.left-this.x));
    var tcx = Math.floor(cx / this.tileSize);
    var dx = cx % this.tileSize;
    this.x -= dx ? this.tileSize-dx : 0;
    // flip individual tiles
    // flip tile coords around bbox center
    for (var f in this.tiles) {
      var tile = this.tiles[f];
      tile.x = Math.floor(-(tile.x - tcx) + tcx)-1;
      var ctx = tile.context;
      var canvas = tile.canvas;
      if (tile.snapshotted) {
        tile.canvas = E.canvas(this.tileSize, this.tileSize);
        tile.context = tile.canvas.getContext('2d');
        ctx = tile.context;
      }
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'copy';
      ctx.translate(this.tileSize,0);
      ctx.scale(-1,1);
      ctx.drawImage(canvas,0,0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      var p=((tile.x + 0x8000) & 0xffff) | (((tile.y + 0x8000) & 0xffff) << 16);
      newTiles[p] = tile;
    }
    this.tiles = newTiles;
  },

  flipY : function() {
    var newTiles = {};
    var bbox = this.getBoundingBox();
    var cy = (bbox.top-this.y) + 0.5*((bbox.bottom-this.y)-(bbox.top-this.y));
    var tcy = Math.floor(cy / this.tileSize);
    var dy = cy % this.tileSize;
    this.y -= dy ? this.tileSize-dy : 0;
    // flip individual tiles
    // flip tile coords around bbox center
    for (var f in this.tiles) {
      var tile = this.tiles[f];
      tile.y = Math.floor(-(tile.y - tcy) + tcy)-1;
      var ctx = tile.context;
      var canvas = tile.canvas;
      if (tile.snapshotted) {
        tile.canvas = E.canvas(this.tileSize, this.tileSize);
        tile.context = tile.canvas.getContext('2d');
        ctx = tile.context;
      }
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'copy';
      ctx.translate(0,this.tileSize);
      ctx.scale(1,-1);
      ctx.drawImage(canvas,0,0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      var p=((tile.x + 0x8000) & 0xffff) | (((tile.y + 0x8000) & 0xffff) << 16);
      newTiles[p] = tile;
    }
    this.tiles = newTiles;
  },

  copyProperties : function(tgt) {
    tgt.tiles = {};
    for (var f in this.tiles) {
      this.tiles[f].snapshotted = true;
      tgt.tiles[f] = Object.extend({}, this.tiles[f]);
    }
  },

  drawImage: function(img, x, y, w, h, composite) {
    composite = composite || this.globalCompositeOperation;
    x-=this.x;
    y-=this.y;
    var ftx = Math.floor(x / this.tileSize);
    var fty = Math.floor(y / this.tileSize);
    var ltx = Math.floor((x+img.width) / this.tileSize);
    var lty = Math.floor((y+img.height) / this.tileSize);
    for (var tx=ftx; tx <= ltx; tx++) {
      for (var ty=fty; ty <= lty; ty++) {
        // optimize: skip if img is transparent here
        var ctx = this.getTileCtx(tx,ty);
        ctx.globalAlpha = this.globalAlpha;
        ctx.globalCompositeOperation = composite;
        if (w && h)
          ctx.drawImage(img,x-tx*this.tileSize,y-ty*this.tileSize,w,h);
        else
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

  compositeTo : function(ctx, opacity, composite) {
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    for (var f in this.tiles) {
      var t = this.tiles[f];
      ctx.drawImage(t.canvas, this.x+t.x*this.tileSize, this.y+t.y*this.tileSize);
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

  fill : function(color, composite) {
    composite = composite || this.globalCompositeOperation;
    for (var f in this.tiles) {
      var t = this.tiles[f];
      if (t.hasNewPath) {
        var c = t.context;
        c.fillStyle = color;
        c.globalAlpha = this.globalAlpha;
        c.globalCompositeOperation = composite;
        c.fill();
        t.hasNewPath = false;
      }
      t.useNewPath = true;
    }
  },

  stroke : function(color, lineWidth, composite) {
    composite = composite || this.globalCompositeOperation;
    for (var f in this.tiles) {
      var t = this.tiles[f];
      if (t.hasNewPath) {
        var c = t.context;
        c.strokeStyle = color;
        c.lineWidth = lineWidth;
        c.globalAlpha = this.globalAlpha;
        c.globalCompositeOperation = composite;
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
      ctx.arc(x-ox,y-oy,r,a1,a2, false);
      if (closed)
        ctx.closePath();
      t.hasNewPath = true;
    }
  },

  drawPolygon : function(path, color, composite) {
    this.beginPath();
    this.subPolygon(path);
    this.fill(color, composite);
  },

  drawArc : function(x,y,r,a1,a2, color, composite, lineWidth, stroke, closed) {
    this.beginPath();
    this.subArc(x,y,r,a1,a2,closed);
    if (stroke) {
      this.stroke(color, lineWidth, composite);
    } else {
      this.fill(color, composite);
    }
  }

});

