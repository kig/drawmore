Scribble = Klass(Undoable, ColorUtils, {
  lineWidth : 1,
  opacity : 1,
  color : [0,0,0,1],
  background : [1,1,1,1],
  lineCap : 'round',
  pickRadius : 1,
  current : null,
  prev : null,

  minimumBrushSize : 0.75,
  maximumBrushSize : 1000,

  initialize : function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.style.cursor = 'url('+E.canvas(1,1).toDataURL()+'),crosshair';
    Undoable.initialize.call(this);
    this.current = {x:0,y:0};
    this.cursor = new RoundBrushCursor();
    this.cursor.update(this.lineWidth);
    this.cursor.moveTo(this.current.x, this.current.y);
    this.palette = [];
    this.setupPalette();
    this.constraints = [];
    this.setColor(this.color);
    this.setBackground(this.background);
    this.setLineCap(this.lineCap);
    this.setLineWidth(this.lineWidth);
    this.clear();
    this.listeners = {};
    this.createListeners();
    this.addListeners();
  },

  getState : function() {
    return {
      pickRadius : this.pickRadius,
      color : this.color,
      background : this.background,
      lineWidth : this.lineWidth,
      opacity : this.opacity,
      lineCap : this.lineCap,
      palette : this.palette.slice(0)
    };
  },

  applyState : function(state) {
    this.pickRadius = state.pickRadius;
    this.setColor(state.color);
    this.setBackground(state.background);
    this.setLineCap(state.lineCap);
    this.setLineWidth(state.lineWidth);
    this.setOpacity(state.opacity);
    for (var i=0; i<state.palette.length; i++)
      this.setPaletteColor(i, state.palette[i]);
    this.palette.splice(state.palette.length, this.palette.length);
  },

  createSnapshot : function() {
    return {
      state: this.getState(),
      imageData: this.ctx.getImageData(0,0,this.canvas.width, this.canvas.height)
    }
  },

  applySnapshot : function(snapshot) {
    this.ctx.putImageData(snapshot.imageData,0,0);
    this.applyState(snapshot.state);
  },

  applyHistoryState : function(state) {
    this[state.methodName].apply(this, state.args);
  },

  createSaveObject : function() {
    return {
      history: this.history,
      historyIndex : this.historyIndex,
      width: this.canvas.width,
      height: this.canvas.height
    };
  },

  applySaveObject : function(obj) {
    this.clear();
    this.clearHistory();
    this.canvas.width = obj.width;
    this.canvas.height = obj.height;
    for (var i=0; i<obj.history.length; i++) {
      this.applyHistoryState(obj.history[i]);
      this.history.last().breakpoint = obj.history[i].breakpoint;
    }
    this.gotoHistoryState(obj.historyIndex);
  },

  addListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.addEventListener(i, this.listeners[i], false);
      }
    }
  },

  removeListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.removeEventListener(i, this.listeners[i], false);
      }
    }
  },

  setupPalette : function() {
    var cc = byClass('paletteColor');
    for (var i=0; i<cc.length; i++) {
      this.setPaletteColor(i, cc[i].getAttribute('color'));
    }
  },

  addConstraint : function(c) {
    this.constraints.push(c);
  },

  removeConstraint : function(c) {
    this.constraints.deleteFirst(c);
  },

  applyConstraints : function(p) {
    for (var i=0; i<this.constraints.length; i++) {
      this.constraints[i].applyTo(p);
    }
    return p;
  },

  createListeners : function() {
    var draw = this;
    this.listeners['mousemove'] = function(ev) {
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      if (draw.resizingBrush) {
        draw.keepResizingBrush();
      } else {
        draw.cursor.moveTo(draw.current.x, draw.current.y);
      }
      if (Mouse.state[Mouse.LEFT] && draw.mousedown) {
        if (draw.prev != null) {
          if (!ev.shiftKey && draw.constraint != null) {
            draw.removeConstraint(draw.constraint);
            draw.constraint = null;
          }
          if (ev.shiftKey && draw.constraint == null) {
            var dx = draw.current.x - draw.prev.x;
            var dy = draw.current.y - draw.prev.y;
            if (Math.abs(dx) > Math.abs(dy))
              draw.constraint = new Constraints.ConstantY(draw.prev.y);
            else
              draw.constraint = new Constraints.ConstantX(draw.prev.x);
            draw.addConstraint(draw.constraint);
          }
          draw.applyConstraints(draw.current);
          draw.drawLine(draw.prev, draw.current);
        }
        draw.prev = draw.current;
        Event.stop(ev);
      }
    }
    this.listeners['mousedown'] = function(ev) {
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.cursor.moveTo(draw.current.x, draw.current.y);
      draw.stopResizingBrush();
      if (Mouse.state[Mouse.LEFT] && ev.target == draw.canvas) {
        draw.mousedown = true;
        if (ev.shiftKey && draw.mouseup) {
          if (draw.constraint != null) {
            draw.removeConstraint(draw.constraint);
            draw.constraint = null;
          }
          draw.drawLine(draw.mouseup, draw.current, true);
          draw.prev = null;
        } else {
          draw.drawPoint(draw.current);
          draw.prev = draw.current;
        }
        ev.preventDefault();
      }
    }
    this.listeners['mouseup'] = function(ev) {
      draw.stopResizingBrush();
      if (draw.mousedown)
        ev.preventDefault();
      draw.mousedown = false;
      draw.mouseup = Mouse.getRelativeCoords(draw.canvas, ev);
      if (!Mouse.state[Mouse.LEFT]) {
        draw.prev = null;
      }
    };
    this.listeners['keydown'] = function(ev) {
      if (Key.match(ev, ['f','j'])) {
        draw.startResizingBrush();
      } else if (Key.match(ev, ['z','n'])) {
        if (ev.shiftKey)
          draw.redo();
        else
          draw.undo();
      } else if (Key.match(ev, ['r','u'])) {
        draw.pickColor(draw.current, draw.pickRadius);
      } else if (Key.match(ev, [Key.TAB, '0'])) {
        Event.stop(ev);
      }
    };
    this.listeners['keyup'] = function(ev) {
      draw.stopResizingBrush();
      if (Key.match(ev, [Key.DELETE, Key.BACKSPACE])) {
        draw.clear();
      } else if (Key.match(ev, [Key.TAB, '0'])) {
        draw.toggleUI();
        Event.stop(ev);
      } else if (Key.match(ev, [191])) {
        draw.toggleHelp();
      } else if (Key.match(ev, ['f','j'])) {
        // stopped resize above
      } else if (Key.match(ev, ['d','k'])) {
        draw.setLineWidth(Math.clamp(draw.lineWidth/1.5, draw.minimumBrushSize, draw.maximumBrushSize));
      } else if (Key.match(ev, ['e','i'])) {
        draw.setLineWidth(Math.clamp(draw.lineWidth*1.5, draw.minimumBrushSize, draw.maximumBrushSize));
      } else if (Key.match(ev, ['1','2','3','4','5','6','7','8','9'])) {
        draw.setColor(draw.palette[ev.which - 49]);
      }
    };
  },

  toggleUI : function() {
    // overwrite with a version that does something
  },

  toggleHelp : function() {
    // overwrite with a version that does something
  },

  startResizingBrush : function() {
    if (this.resizingBrush) return;
    this.resizingBrush = true;
    this.brushResizeX = this.current.x - this.lineWidth;
  },

  keepResizingBrush : function() {
    if (!this.resizingBrush) return;
    var d = Math.max(this.current.x - this.brushResizeX, 0);
    var dx = Math.clamp(d, this.minimumBrushSize, this.maximumBrushSize)
    this.setLineWidth(dx);
  },

  stopResizingBrush : function() {
    if (!this.resizingBrush) return;
    this.resizingBrush = false;
    var d = Math.max(this.current.x - this.brushResizeX, 0);
    var dx = Math.clamp(d, this.minimumBrushSize, this.maximumBrushSize)
    this.setLineWidth(dx);
  },

  clear : function() {
    this.ctx.fillStyle = this.colorToStyle(this.background);
    this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height);
    this.addHistoryState({methodName: 'clear', args: [], breakpoint: true});
  },

  drawPoint : function(xy) {
    this.ctx.beginPath();
    this.ctx.arc(xy.x, xy.y, this.lineWidth/2, 0, Math.PI*2);
    this.ctx.fillStyle = this.tweenColor(this.background, this.color, this.opacity);
    this.ctx.fill();
    this.addHistoryState({methodName: 'drawPoint', args:[xy], breakpoint: true});
  },

  drawLine : function(prev, current, breakpoint) {
    this.ctx.beginPath();
    this.ctx.moveTo(prev.x, prev.y);
    this.ctx.lineTo(current.x, current.y);
    this.ctx.stroke();
    var s = {methodName: 'drawLine', args:[prev, current]}
    if (breakpoint) {
      s.breakpoint = true;
      s.args.push(true);
    }
    this.addHistoryState(s);
  },

  setColor : function(color) {
    if (typeof color == 'string')
      this.color = this.styleToColor(color);
    else
      this.color = color;
    byId('foregroundColor').style.backgroundColor = this.colorToStyle(this.color);
    this.ctx.strokeStyle = this.tweenColor(this.background, this.color, this.opacity);
    this.addHistoryState({methodName: 'setColor', args:[this.color]});
  },

  setBackground : function(color) {
    if (typeof color == 'string')
      this.background = this.styleToColor(color);
    else
      this.background = color;
    byId('backgroundColor').style.backgroundColor = this.colorToStyle(this.background);
    this.ctx.strokeStyle = this.tweenColor(this.background, this.color, this.opacity);
    this.addHistoryState({methodName: 'setBackground', args:[this.background]});
  },

  setOpacity : function(o) {
    o = Math.clamp(o, 0, 1);
    this.opacity = o;
    this.setColor(this.color);
    this.addHistoryState({methodName: 'setOpacity', args:[this.opacity]});
  },

  setLineCap : function(lineCap) {
    this.ctx.lineCap = lineCap;
    this.lineCap = this.ctx.lineCap;
    this.addHistoryState({methodName: 'setLineCap', args:[this.lineCap]});
  },

  setLineWidth : function(w) {
    this.ctx.lineWidth = w;
    this.lineWidth = this.ctx.lineWidth;
    this.cursor.update(this.lineWidth);
    // collapse multiple setLineWidth calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setLineWidth')
      last.args[0] = this.lineWidth;
    else
      this.addHistoryState({methodName: 'setLineWidth', args:[this.lineWidth]});
  },

  setPaletteColor : function(idx, color) {
    var c = color;
    if (typeof color == 'string')
      c = this.styleToColor(color);
    byClass('paletteColor')[idx].style.backgroundColor = this.colorToStyle(c);
    this.palette[idx] = c;
    this.addHistoryState({methodName: 'setPaletteColor', args:[idx, c], breakpoint: true});
  },

  pickColor : function(xy, radius) {
    if (xy) {
      var c = this.colorAt(this.ctx, xy.x, xy.y, radius);
      this.setColor(c);
    }
  },

  pickBackground : function(xy, radius) {
    if (xy) {
      var c = this.colorAt(this.ctx, xy.x, xy.y, radius);
      this.setBackground(c);
    }
  },

  export : function() {
    var dataURL = this.canvas.toDataURL('image/png');
    window.open(dataURL);
  },

  load : function(string) {
    var obj = ScribbleFile.parse(string);
    this.applySaveObject(obj);
  },

  getSaveString : function() {
    return ScribbleFile.stringify(this.createSaveObject());
  },

  save : function() {
    var string = this.getSaveString();
    var b64 = btoa(string);
    window.open('data:image/x-scribble;base64,'+b64);
  }

});


Constraint = Klass({
  initialize: function() {},

  withinRange : function(point) {
    return true;
  },

  edit : function(point) {
    return point;
  },

  applyTo : function(point) {
    if (this.withinRange(point))
      this.edit(point);
    return point;
  }
});

Constraints = {};

Constraints.ConstantX = Klass(Constraint, {
  initialize : function(x) {
    this.x = x;
  },

  edit : function(point) {
    point.x = this.x;
    return point;
  }
});

Constraints.ConstantY = Klass(Constraint, {
  initialize : function(y) {
    this.y = y;
  },

  edit : function(point) {
    point.y = this.y;
    return point;
  }
});

