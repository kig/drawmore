RoundBrushCursor = Klass({
  x : 0,
  y : 0,
  sz : 64,
  minSz : 64,

  initialize : function() {
    this.cursorCanvas = E.canvas(this.sz, this.sz);
    this.cursorCanvas.style.position = 'absolute';
    this.cursorCanvas.style.zIndex = '5';
    this.cursorCanvas.style.pointerEvents = 'none';
    document.body.appendChild(this.cursorCanvas);
  },

  update : function(diameter) {
    var ctx = this.cursorCanvas.getContext('2d');
    var w = this.sz;
    if (w > this.minSz && (w > diameter*4 || (w > 512 && w > diameter*2))) {
      while (w > this.minSz && (w > diameter*4 || (w > 512 && w > diameter*2)))
        w /= 2;
      this.cursorCanvas.width = this.cursorCanvas.height = w;
      // if (window.console) console.log('scale down to '+w);
    } else if (w < diameter+2) {
      while (w < diameter+2)
        w *= 2
      this.cursorCanvas.width = this.cursorCanvas.height = w;
      // if (window.console) console.log('scale up to '+w);
    }
    this.sz = w;
    ctx.clearRect(0,0,w,w);
    ctx.beginPath();
    ctx.lineWidth = 0.75;
    ctx.arc(w/2, w/2, diameter/2+0.25, 0, Math.PI*2, true);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.lineWidth = 0.5;
    ctx.arc(w/2, w/2, diameter/2, 0, Math.PI*2, true);
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    if (diameter < 3) {
      ctx.beginPath();
      ctx.moveTo(w/2+2, w/2);
      ctx.lineTo(w/2+4, w/2);
      ctx.moveTo(w/2-2, w/2);
      ctx.lineTo(w/2-4, w/2);
      ctx.moveTo(w/2, w/2-2);
      ctx.lineTo(w/2, w/2-4);
      ctx.moveTo(w/2, w/2+2);
      ctx.lineTo(w/2, w/2+4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    this.moveTo(this.x, this.y);
  },

  moveTo : function(x, y) {
    this.x = x;
    this.y = y;
    this.cursorCanvas.style.left = this.x - this.sz/2 + 'px';
    this.cursorCanvas.style.top = this.y - this.sz/2 + 'px';
  }
});


BrushCursor = Klass({
  x : -10,
  y : -10,
  sz : 64,
  minSz : 64,
  diameter : 1,

  initialize : function() {
    this.cursorCanvas = E.canvas(this.sz, this.sz);
    this.cursorCanvas.style.position = 'absolute';
    this.cursorCanvas.style.zIndex = '5';
    this.cursorCanvas.style.pointerEvents = 'none';
    document.body.appendChild(this.cursorCanvas);
  },

  hide : function() {
    this.cursorCanvas.style.visibility = 'hidden';
  },

  show : function() {
    this.cursorCanvas.style.visibility = 'visible';
  },

  setBrush : function(brush, transform, color, opacity) {
    this.brush = brush;
    this.update(this.diameter, transform, color, opacity);
  },

  update : function(diameter, transform, color, opacity) {
    var origDiameter = diameter;
    this.diameter = diameter;
    var diameter = this.brush.diameter * diameter;
    var ctx = this.cursorCanvas.getContext('2d');
    var w = this.sz;
    if (w > this.minSz && (w > diameter*4 || (w > 512 && w > diameter*2))) {
      while (w > this.minSz && (w > diameter*4 || (w > 512 && w > diameter*2)))
        w /= 2;
      this.cursorCanvas.width = this.cursorCanvas.height = w;
      // if (window.console) console.log('scale down to '+w);
    } else if (w < diameter+2) {
      while (w < diameter+2)
        w *= 2
      this.cursorCanvas.width = this.cursorCanvas.height = w;
      // if (window.console) console.log('scale up to '+w);
    }
    this.sz = w;
    ctx.clearRect(0,0,w,w);
    ctx.save();
      ctx.beginPath();
      ctx.translate(w/2, w/2);
      this.brush.brushPath(ctx, Math.max(0.5, origDiameter/2-0.5), transform);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.beginPath();
      this.brush.brushPath(ctx, Math.max(0.5, origDiameter/2), transform);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    ctx.restore();
    if (origDiameter < 3) {
      ctx.save();
        ctx.translate(w/2 + 8, w/2 - 8);
        ctx.font = '7px sans-serif';
        var s = origDiameter.toString().substring(0,4);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(s,5,2);
        ctx.fillStyle = '#000000';
        ctx.fillText(s,6,3);
        ctx.beginPath();
        this.brush.brushPath(ctx, 2.5, transform);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.beginPath();
        this.brush.brushPath(ctx, 3, transform);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(w/2+2, w/2);
      ctx.lineTo(w/2+4, w/2);
      ctx.moveTo(w/2-2, w/2);
      ctx.lineTo(w/2-4, w/2);
      ctx.moveTo(w/2, w/2-2);
      ctx.lineTo(w/2, w/2-4);
      ctx.moveTo(w/2, w/2+2);
      ctx.lineTo(w/2, w/2+4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.save();
      ctx.translate(w/2, w/2);
      ctx.rotate(+Math.PI/4);
      ctx.translate(0.5*origDiameter+5, 0);
      ctx.beginPath();
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0,-2,6,4);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.fillRect(2,-2,4,4);
      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      ctx.fillRect(0,-2,3,4);
    ctx.restore();
    this.moveTo(this.x, this.y);
  },

  moveTo : function(x, y) {
    this.x = x;
    this.y = y;
    this.cursorCanvas.style.left = this.x - this.sz/2 + 'px';
    this.cursorCanvas.style.top = this.y - this.sz/2 + 'px';
  }
});


