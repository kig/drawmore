LayerWidget = Klass({

  initialize : function(app, container) {
    this.app = app;
    this.element = DIV();
    this.element.className = 'layerWidget';
    this.layers = OL();
    this.layers.className = 'layers';
    this.element.appendChild(this.layers);
    var self = this;
    this.element.appendChild(
      DIV(
        BUTTON("+", {onclick: function(ev) {self.app.newLayer();}}),
        BUTTON("-", {onclick: function(ev) {self.app.deleteCurrentLayer();}})
      )
    );
    this.container = container;
    this.container.appendChild(this.element);
    window.addEventListener('mouseup', function(ev){
      if (self.active) {
        var dropped = false;
        var srcIdx,dstIdx;
        var c = self.active;
        self.active = null;
        if (c.dragging) {
          dropped = true;
          var cc = toArray(self.layers.childNodes);
          var i = cc.indexOf(c);
          var clen = cc.length;
          srcIdx = clen-1-i;
          var dy = (ev.clientY-c.downY);
          var myTop = c.offsetTop;
          var myBottom = c.offsetTop + c.offsetHeight;
          dstIdx = srcIdx;
          for (var j=0; j<cc.length; j++) {
            var mid = (cc[j].offsetTop+cc[j].offsetHeight/2);
            if (dy < 0) { // going upwards, compare top to mid
              if (myTop < mid) {
                dstIdx = clen-1-j;
                break;
              }
            } else { // going down
              if (mid > myBottom) {
                dstIdx = clen-1-j+1;
                break;
              }
              if (j == cc.length-1) dstIdx = 0;
            }
          }
          dstIdx = Math.clamp(dstIdx, 0, clen-1);
          ev.preventDefault();
        }
        c.style.top = '0px';
        c.dragging = c.down = false;
        if (dropped)
          self.app.moveLayer(srcIdx, dstIdx);
      }
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (self.active) {
        var y = ev.clientY;
        var dy = y-self.active.downY;
        if (Math.abs(dy) > 3) {
          self.active.dragging = true;
          self.active.eatClick = true;
        }
        if (self.active.dragging) {
          self.active.style.top = dy + 'px';
        }
      }
      ev.preventDefault();
    }, false);
  },

  clear : function() {
    while (this.layers.firstChild)
      this.layers.removeChild(this.layers.firstChild);
  },

  indexOf : function(layer) {
    var cc = toArray(this.layers.childNodes);
    var idx = cc.length-1-cc.indexOf(layer);
    return idx;
  },

  __newLayer : function(layer) {
    var self = this;
    var li = LI(
      CHECKBOX({
        checked: layer.display,
        onclick: function(ev) {
          self.app.toggleLayer(self.indexOf(this.parentNode));
          ev.stopPropagation();
        }
      }),
      SPAN(layer.name, {
        contentEditable: true,
        tabIndex: -1,
        style: {cursor: 'text'},
        onchange: function(ev) {
          self.app.renameLayer(self.indexOf(this.parentNode), this.textContent);
        },
        onblur : function(ev) {
          self.app.renameLayer(self.indexOf(this.parentNode), this.textContent);
        },
        onmousedown : function(ev) {
          this.focus();
          ev.stopPropagation();
        },
        onkeydown : function(ev) {
          if (Key.match(ev, [Key.ENTER, Key.ESC])) {
            this.blur();
          }
          ev.stopPropagation();
        },
        onkeyup : function(ev) {
          ev.stopPropagation();
        },
        onclick : function(ev) {
          ev.stopPropagation();
        }
      }), {
      onmousedown : function(ev) {
        this.down = true;
        this.eatClick = false;
        this.downY = ev.clientY;
        if (self.active == null)
          self.active = this;
        ev.preventDefault();
      },
      onclick : function(ev) {
        if (this.eatClick) {
          this.eatClick = false;
        } else {
          self.app.setCurrentLayer(self.indexOf(this));
        }
        ev.preventDefault();
      }
    });
    li.style.position = 'relative';
    li.name = layer.name;
    if (this.layers.firstChild)
      this.layers.insertBefore(li, this.layers.firstChild);
    else
      this.layers.appendChild(li);
    return li;
  },

  requestRedraw : function() {
    this.needRedraw = true;
  },

  updateDisplay : function() {
    var layers = this.app.layers;
    this.clear();
    for (var i=0; i<layers.length; i++) {
      var layer = layers[i];
      this.__newLayer(layer);
      if (this.app.currentLayerIndex == i)
        this.layers.firstChild.className = 'current';
    }
  },

  redraw : function() {
    if (this.needRedraw) {
      this.updateDisplay();
      this.needRedraw = false;
    }
  }
});


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

  getBoundingBox : function() {
    return null;
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
  initialize : function(w,h){
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
      ctx.arc(x-ox,y-oy,r,a1,a2, false);
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

