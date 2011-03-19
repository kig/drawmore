
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
    layer.layerManager = this;
  },

  deleteLayer : function(layer) {
    delete this.layerIndex[layer.uid];
    layer.layerManager = null;
  },

  rebuild : function(layers) {
    this.layerIndex = {};
    for (var i=0; i<layers.length; i++) {
      this.addLayer(layers[i]);
    }
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

  rebuildCopy : function(layers) {
    this.rebuild(layers.map(function(l){ return l.copy(true); }));
  },

  getLayerByUID : function(uid) {
    return this.layerIndex[uid];
  },

  copyLayers : function() {
    var a = [];
    for (var i in this.layerIndex) {
      a.push(this.layerIndex[i].copy(true));
    }
    return a;
  }

});

Layer = Klass({
  showCompositeDepth : false,

  initCompositeDepthCanvas : function(w,h) {
    if (!this.compositeDepthCanvas) {
      this.compositeDepthCanvas = E.canvas(w,h);
      this.compositeDepthCtx = this.compositeDepthCanvas.getContext('2d');
      this.compositeDepthCtx.globalAlpha = 0.1;
      this.compositeDepthCtx.fillStyle = 'magenta';
    }
    if (this.compositeDepthCanvas.width != w || this.compositeDepthCanvas.height != h) {
      this.compositeDepthCanvas.width = w;
      this.compositeDepthCanvas.height = h;
    } else {
      this.compositeDepthCtx.clearRect(0,0,w,h);
    }
  },

  display : true,
  isLayer : true,
  x : 0,
  y : 0,
  opacity : 1,
  zIndex : 0,
  globalAlpha : 1,
  globalCompositeOperation : 'source-over',
  parentNodeUID : null,

  directCompositeCount : 0,
  tempStackOverflowCount : 0,
  tempStackUseCount : 0,
  skipTempCount : 0,
  copyCount : 0,
  deepCopyCount : 0,

  printStats : function(msg) {
    Magi.console.spam(msg+
      ' :: copies: '+this.copyCount+
      ', deepCopies: '+this.deepCopyCount+
      ', tempOverflows: '+this.tempStackOverflowCount+
      ', tempUses: '+this.tempStackUseCount+
      ', skipTemps: '+this.skipTempCount+
      ', directComposites: '+this.directCompositeCount
    );
  },

  resetStats : function() {
    this.directCompositeCount = 0;
    this.tempStackOverflowCount = 0;
    this.tempStackUseCount = 0;
    this.skipTempCount = 0;
    this.copyCount = 0;
    this.deepCopyCount = 0;
  },

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
    this.clear();
    var cc = this.childNodes;
    for (var i=0; i<cc.length; i++) {
      this.layerManager.getLayerByUID(cc[i]).destroy();
    }
    var props = [];
    for (var p in this.linkedProperties)
      props.push(p);
    for (var i=0; i<props.length; i++)
      this.unlinkProperty(props[i]);
    if (this.hasParentNode())
      this.getParentNode().removeChild(this);
    if (this.layerManager)
      this.layerManager.deleteLayer(this);
  },

  copy : function(deepCopy) {
    Layer.copyCount++;
    var l = Object.extend({}, this);
    l.linkedProperties = {};
    l.childNodes = [];
    if (deepCopy != false) {
      Layer.deepCopyCount++;
      for (var p in this.linkedProperties)
        l.linkedProperties[p] = this.linkedProperties[p].slice(0);
      l.childNodes = this.childNodes.slice(0);
    }
    this.copyProperties(l);
    return l;
  },

  copyProperties : function(tgt) {
  },

  getBoundingBox : function() {
    var bbox = this.getLayerBoundingBox();
    for (var i=0; i<this.childNodes.length; i++) {
      var c = this.getChildNode(i);
      var cb = c.getBoundingBox();
      this.bboxMerge(cb, bbox);
    }
    return bbox;
  },

  bboxMerge : function(src, dst) {
    if (src.top < dst.top) dst.top = src.top;
    if (src.bottom > dst.bottom) dst.bottom = src.bottom;
    if (src.left < dst.left) dst.left = src.left;
    if (src.right > dst.right) dst.right = src.right;
    dst.width = dst.right-dst.left;
    dst.height = dst.bottom-dst.top;
  },

  getLayerBoundingBox : function() {
    return {top:1/0, left:1/0, right:-1/0, bottom:-1/0, width:0, height:0};
  },

  flipX : function() {},
  flipY : function() {},

  applyTo : function(ctx, composite, tempLayerStack, skipTemp){
    if (this.display) {
      var alpha = ctx.globalAlpha;
      var gco = ctx.globalCompositeOperation;
      if (this.childNodes.length > 0) {
        var tempLayer;
        var tail = null;
        if (skipTemp) {
          Layer.skipTempCount++;
          tempLayer = ctx;
          tail = tempLayerStack;
        } else if (tempLayerStack == null || tempLayerStack.length == 0) {
          Layer.tempStackOverflowCount++;
          Magi.console.spam('temp overflow for '+this.name);
          tempLayer = new TiledLayer();
          this.compositeTo(tempLayer, 1, 'source-over');
        } else {
          Layer.tempStackUseCount++;
          tempLayer = tempLayerStack[0];
          tempLayer.clear();
          tail = tempLayerStack.slice(1);
          this.compositeTo(tempLayer, 1, 'source-over');
        }
        for (var i=0; i<this.childNodes.length; i++) {
          this.layerManager.getLayerByUID(this.childNodes[i]).applyTo(tempLayer, null, tail);
        }
        if (!skipTemp)
          tempLayer.compositeTo(ctx, this.opacity, composite||this.globalCompositeOperation);
      } else {
        Layer.directCompositeCount++;
        this.compositeTo(ctx, this.opacity, composite||this.globalCompositeOperation);
      }
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = gco;
    }
  },

  compositeTo : function(ctx, opacity, composite) {
  },

  getParentNode : function() {
    return (this.layerManager.getLayerByUID(this.parentNodeUID));
  },

  hasParentNode : function() {
    return (this.parentNodeUID != null);
  },

  getChildNode : function(i) {
    return this.layerManager.getLayerByUID(this.childNodes[i]);
  },

  getNextNode : function(goingUp) {
    if (this.parentNodeUID == null)
      return null;
    if (!goingUp) {
      if (this.childNodes.length > 0)
        return this.getChildNode(0);
    }
    var pn = this.getParentNode();
    var nextIdx = pn.childNodes.indexOf(this.uid)+1;
    if (nextIdx < pn.childNodes.length)
      return pn.getChildNode(nextIdx);
    else
      return pn.getNextNode(true);
  },

  getPreviousNode : function(goingDown) {
    if (this.parentNodeUID == null)
      return null;
    if (goingDown) {
      if (this.childNodes.length > 0)
        return this.getChildNode(this.childNodes.length-1);
      else
        return this;
    }
    var pn = this.getParentNode();
    var prevIdx = pn.childNodes.indexOf(this.uid)-1;
    if (prevIdx >= 0)
      return pn.getChildNode(prevIdx).getPreviousNode(true);
    else
      return pn;
  },

  appendChild : function(node) {
    if (node.parentNodeUID == this.uid && this.childNodes.last() == node.uid)
      return;
    if (node.hasParentNode())
      node.getParentNode().removeChild(node);
    node.parentNodeUID = this.uid;
    this.childNodes.push(node.uid);
  },

  prependChild : function(node) {
    if (node.parentNodeUID == this.uid && this.childNodes[0] == node.uid)
      return;
    if (node.hasParentNode())
      node.getParentNode().removeChild(node);
    node.parentNodeUID = this.uid;
    this.childNodes.unshift(node.uid);
  },

  insertChildBefore : function(node, sibling) {
    if (node.hasParentNode())
      node.getParentNode().removeChild(node);
    node.parentNodeUID = this.uid;
    var i = this.childNodes.indexOf(sibling.uid);
    this.childNodes.splice(i, 0, node.uid);
  },

  insertChildAfter : function(node, sibling) {
    if (node.hasParentNode())
      node.getParentNode().removeChild(node);
    node.parentNodeUID = this.uid;
    var i = this.childNodes.indexOf(sibling.uid);
    this.childNodes.splice(i+1, 0, node.uid);
  },

  removeChild : function(node) {
    var cc = this.childNodes;
    for (var i=0; i<cc.length;) {
      if (cc[i] == node.uid) {
        this.childNodes.splice(i,1);
      } else {
        i++;
      }
    }
    node.parentNodeUID = null;
  },

  isChildOf : function(layer) {
    var o = this;
    while (o) {
      if (layer.uid == o.parentNodeUID)
        return true;
      o = this.layerManager.getLayerByUID(o.parentNodeUID);
    }
    return false;
  },

  isParentOf : function(layer) {
    return layer.isChildOf(this);
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

  drawImage : function(image, x, y, w, h, composite) {},

  rect : function(x,y,w,h) {
    this.subPolygon([
      {x:x, y:y}, {x:x, y:y+h}, {x:x+w, y:y+h}, {x:x+w, y:y}
    ]);
  },

  fillRect : function(x,y,w,h,color) {
    this.beginPath();
    this.rect(x,y,w,h);
    this.fill(color);
  }

});


CanvasLayer = Klass(Layer, {
  initializeLayer : function(w,h) {
    if (h == null) {
      this.canvas = w;
    } else {
      this.canvas = E.canvas(w,h);
    }
    if (typeof WebGL2D != 'undefined') {
      WebGL2D.enable(this.canvas);
      this.ctx = this.canvas.getContext('webgl-2d');
    } else {
      this.ctx = this.canvas.getContext('2d');
    }
  },

  resize : function(w,h) {
    this.canvas.width = w;
    this.canvas.height = h;
  },

  upsize : function(w, h) {
    if (w>this.canvas.width || h>this.canvas.height) {
      this.resize(w,h);
    }
  },

  getLayerBoundingBox : function() {
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
    if (Layer.showCompositeDepth) {
      Layer.compositeDepthCtx.fillRect(this.x, this.y, this.canvas.width, this.canvas.height);
    }
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    var s = this.compensateZoom || 1;
    if (s != 1) { ctx.save(); ctx.scale(1/s, 1/s); }
    ctx.drawImage(this.canvas, this.x, this.y);
    if (s != 1) { ctx.restore(); }
  },

  save : function() {
    this.ctx.save();
  },

  restore : function() {
    this.ctx.restore();
  },

  scale : function(x,y) {
    this.ctx.scale(x,y);
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

  subQuadratic : function(path) {
    var ctx = this.ctx;
    ctx.moveTo(path[0].x, path[0].y);
    for (var i=1; i<path.length; i++) {
      var u = path[i];
      ctx.quadraticCurveTo(u.cx, u.cy, u.x, u.y);
    }
    ctx.closePath();
  },

  subCubic : function(path) {
    var ctx = this.ctx;
    ctx.moveTo(path[0].x, path[0].y);
    for (var i=1; i<path.length; i++) {
      var u = path[i];
      ctx.cubicCurveTo(u.c1x, u.c1y, u.c2x, u.c2y, u.x, u.y);
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
  allocPool : [],
  totalAllocCount : 0,
  allocCount : 0,
  recycleCount : 0,
  returnCount : 0,
  COWCount : 0,

  doNotPoolTiles : navigator.userAgent.match(/Firefox\/4/), //FIXME UGH

  prefillAllocPool : function(count) {
    for (var i=0; i<count; i++) {
      TiledLayer.allocPool.push(E.canvas(this.tileSize, this.tileSize));
      TiledLayer.allocCount++;
      TiledLayer.totalAllocCount++;
    }
  },

  printAllocStats : function(msg) {
    Magi.console.spam(msg+
      ' :: allocs: '+this.allocCount+
      ', COW copies: '+this.COWCount+
      ', recycled: '+this.recycleCount+
      ', returned: '+this.returnCount+
      ', pool size: '+this.allocPool.length+
      ', total allocs: '+this.totalAllocCount
    );
  },
  resetAllocStats : function() {
    this.COWCount = this.allocCount = this.recycleCount = this.returnCount = 0;
  },

  getNewCanvas : function() {
    if (TiledLayer.allocPool.length == 0) {
      TiledLayer.prefillAllocPool(TiledLayer.doNotPoolTiles ? 1 : 64);
    } else {
      TiledLayer.recycleCount++;
    }
    return TiledLayer.allocPool.shift();
  },

  returnCanvas : function(c) {
    if (TiledLayer.doNotPoolTiles)
      return;
    var ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0,0,this.tileSize,this.tileSize);
    c.recycled = true;
    TiledLayer.returnCount++;
    TiledLayer.allocPool.push(c);
  },



  initializeLayer: function() {
    this.tiles = {};
  },

  isEmpty : function() {
    for (var i in this.tiles)
      return false;
    return true;
  },

  getLayerBoundingBox : function() {
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
      width: (right-left)*this.tileSize, height: (bottom-top)*this.tileSize
    };
  },

  flipX : function() {
    var newTiles = {};
    var bbox = this.getBoundingBox();
    var cx = (bbox.left-this.x) + 0.5*bbox.width;
    var tcx = Math.floor(cx / this.tileSize);
    var dx = cx-bbox.left;
    // flip individual tiles
    // flip tile coords around bbox center
    for (var f in this.tiles) {
      var tile = this.tiles[f];
      tile.x = Math.floor(tcx-(tile.x - tcx));
      var ctx = tile.context;
      var canvas = tile.canvas;
      if (tile.snapshotted) {
        tile.canvas = this.getNewCanvas();
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
    var bbox = this.getBoundingBox();
    var ddx = dx - (cx-bbox.left);
    this.x -= ddx;
  },

  flipY : function() {
    var newTiles = {};
    var bbox = this.getBoundingBox();
    var cy = (bbox.top-this.y) + 0.5*bbox.height;
    var tcy = Math.floor(cy / this.tileSize);
    var dy = cy-bbox.top;
    // flip individual tiles
    // flip tile coords around bbox center
    for (var f in this.tiles) {
      var tile = this.tiles[f];
      tile.y = Math.floor(tcy-(tile.y - tcy));
      var ctx = tile.context;
      var canvas = tile.canvas;
      if (tile.snapshotted) {
        tile.canvas = this.getNewCanvas();
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
    var bbox = this.getBoundingBox();
    var ddy = dy - (cy-bbox.top);
    this.y -= ddy;
  },

  copyProperties : function(tgt) {
    tgt.tiles = {};
    for (var f in this.tiles) {
      this.tiles[f].snapshotted = true;
      tgt.tiles[f] = Object.extend({}, this.tiles[f]);
    }
  },

  startDrawOp : function() {
    if (this.globalCompositeOperation == 'source-in') {
      for (var i in this.tiles)
        delete this.tiles[i].touched;
    }
  },

  endDrawOp : function() {
    if (this.globalCompositeOperation == 'source-in') {
      var deletes = [];
      for (var i in this.tiles) {
        if (this.tiles[i].touched)
          delete this.tiles[i].touched;
        else
          deletes.push(i);
      }
      for (var i=0; i<deletes.length; i++) {
        var t = this.tiles[ deletes[i] ];
        this.returnCanvas(t.canvas);
        delete this.tiles[deletes[i]];
      }
    }
  },

  drawImage: function(img, x, y, w, h, composite) {
    composite = composite || this.globalCompositeOperation;
    x-=this.x;
    y-=this.y;
    var ftx = Math.floor(x / this.tileSize);
    var fty = Math.floor(y / this.tileSize);
    var ltx = Math.floor((x+img.width-1) / this.tileSize);
    var lty = Math.floor((y+img.height-1) / this.tileSize);
    for (var tx=ftx; tx <= ltx; tx++) {
      for (var ty=fty; ty <= lty; ty++) {
        // optimize: skip if img is transparent here
        var tile = this.getTile(tx,ty,true);
        tile.touched = true;
        var ctx = tile.context;
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
        canvas: this.getNewCanvas(),
        x: x, y: y, snapshotted: false,
        useNewPath: true
      };
      if (c && c.snapshotted) {
        TiledLayer.COWCount++
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
    for (var f in this.tiles) {
      var t = this.tiles[f];
      if (!t.snapshotted)
        this.returnCanvas(t.canvas);
    }
    this.tiles = {};
  },

  compositeTo : function(ctx, opacity, composite) {
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite || this.globalCompositeOperation;
    if (ctx.startDrawOp) ctx.startDrawOp();
    for (var f in this.tiles) {
      var t = this.tiles[f];
      ctx.drawImage(t.canvas, this.x+t.x*this.tileSize, this.y+t.y*this.tileSize);
      if (Layer.showCompositeDepth) {
        Layer.compositeDepthCtx.fillRect(this.x+t.x*this.tileSize, this.y+t.y*this.tileSize, this.tileSize, this.tileSize);
      }
    }
    if (ctx.endDrawOp) ctx.endDrawOp();
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
    // FIXME stroke needs lineWidth/2 border of tiles
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
    if (path.length == 0) return;
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

  subQuadratic : function(path) {
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
        ctx.quadraticCurveTo(u.cx-ox, u.cy-oy, u.x-ox, u.y-oy);
      }
      ctx.closePath();
      t.hasNewPath = true;
    }
  },

  subCubic : function(path) {
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
        ctx.cubicCurveTo(u.c1x-ox, u.c1y-oy, u.c2x-ox, u.c2y-oy, u.x-ox, u.y-oy);
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

TiledLayer.prefillAllocPool(128);