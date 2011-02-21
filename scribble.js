Scribble = Klass(Undoable, ColorUtils, {

  keyBindings : {
    brushResize: ['f', 'j'],
    brushSizeUp: ['e','i'],
    brushSizeDown: ['d','k'],
    opacityUp: ['w','o'],
    opacityDown: ['s','l'],
    clear : [Key.DELETE, Key.BACKSPACE],
    undo: ['z', 'n'],
    nextBrush: ['t','y'],
    previousBrush: ['g','h'],
    flip: ['x'],
    pickColor: ['r', 'u'],
    paletteKeys: ['1','2','3','4','5','6','7','8','9'],
    toggleUI: [Key.TAB, '0'],
    toggleHelp: [191] // question mark
  },

  lineWidth : 1,
  opacity : 1,
  color : [0,0,0,1],
  background : [1,1,1,1],
  pickRadius : 1,
  current : null,
  prev : null,

  defaultLineWidth : 0.5,
  defaultColor : [0,0,0,1],
  defaultBackground : [1,1,1,1],

  brushIndex : 0,

  minimumBrushSize : 0.5,
  maximumBrushSize : 1000,

  strokeInProgress : false,

  width: 1,
  height: 1,

  lastUpdateTime : 0,

  disableColorPick : true,

  initialize : function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.style.cursor = 'url('+E.canvas(1,1).toDataURL()+'),crosshair';
    Undoable.initialize.call(this);
    this.current = {x:0,y:0};
    this.cursor = new RoundBrushCursor();
    this.cursor.update(this.lineWidth);
    this.cursor.moveTo(this.current.x, this.current.y);
    this.setupDefaultState();
    this.listeners = {};
    this.createListeners();
    this.addListeners();
    var self = this;
    setTimeout(function() {
      // ctrl-R messes with the r key when reloading
      self.disableColorPick = false;
    }, 1000);
  },


  // Draw loop

  updateDisplay : function() {
    this.ctx.save();
      this.ctx.fillStyle = this.colorToStyle(this.background);
      this.ctx.fillRect(0,0,this.width,this.height);
      for (var i=0; i<this.layers.length; i++) {
        this.layers[i].applyTo(this.ctx, this.width, this.height);
      }
    this.ctx.restore();
    this.lastUpdateTime = (new Date()).getTime();
    this.redrawRequested = false;
  },

  setBackground : function(color) {
    if (typeof color == 'string')
      this.background = this.styleToColor(color);
    else
      this.background = color;
    byId('backgroundColor').style.backgroundColor = this.colorToStyle(this.background);
    this.addHistoryState({methodName: 'setBackground', args:[this.background]});
    this.requestRedraw();
  },

  requestRedraw : function() {
    if (this.redrawRequested)
      return;
    this.redrawRequested = true;
    var self = this;
    var update = function(){ self.updateDisplay(); };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(update);
    } else if (window.mozRequestAnimationFrame) {
      window.mozRequestAnimationFrame(update);
    } else if (window.webkitRequestAnimationFrame) {
      window.webkitRequestAnimationFrame(update);
    } else {
      setTimeout(update, 16-Math.min(16, (new Date()).getTime()-this.lastUpdateTime));
    }
  },


  // File IO

  exportImage : function() {
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
  },


  // Document state management

  newDocument : function() {
    this.clearHistory();
    this.setupDefaultState();
  },

  setupDefaultState : function() {
    this.layers = [];
    this.palette = [];
    this.constraints = [];
    this.brushes = [];
    this.addRoundBrush();
    this.addPolygonBrush([{x:1, y:-0.1}, {x:1, y:0}, {x:-1, y:0.5}, {x:-1, y:0.4}]);
    this.setBrush(0);
    this.setupPalette();
    this.resize(this.canvas.width, this.canvas.height);
    this.newLayer(0);
    this.setCurrentLayer(0);
    this.strokeLayer = this.newLayer(10);
    this.setColor(this.defaultColor);
    this.setBackground(this.defaultBackground);
    this.setLineWidth(this.defaultLineWidth);
    this.setOpacity(1);
    this.clear();
    this.addHistoryBarrier();
  },

  resize : function(w,h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.requestRedraw();
  },


  // Undo history management

  getState : function() {
    var cs = this.constraints.slice(0);
    cs.deleteFirst(this.constraint);
    return {
      pickRadius : this.pickRadius,
      brushIndex : this.brushIndex,
      brushes : this.brushes.map(function(l){ return l.copy(); }),
      color : this.color,
      background : this.background,
      lineWidth : this.lineWidth,
      opacity : this.opacity,
      palette : this.palette.slice(0),
      constraints: cs,
      strokeInProgress : this.strokeInProgress,
      layers : this.layers.map(function(l){ return l.copy(); }),
      currentLayerIndex : this.currentLayerIndex,
      strokeLayerIndex : this.layers.indexOf(this.strokeLayer)
    };
  },

  applyState : function(state) {
    this.constraints = state.constraints;
    this.strokeInProgress = state.strokeInProgress;
    this.pickRadius = state.pickRadius;
    this.brushes = state.brushes.map(function(l){ return l.copy(); });
    this.setBrush(state.brushIndex);
    this.layers = state.layers.map(function(l){ return l.copy(); });
    this.setCurrentLayer(state.currentLayerIndex);
    this.strokeLayer = this.layers[state.strokeLayerIndex];
    for (var i=0; i<state.palette.length; i++)
      this.setPaletteColor(i, state.palette[i]);
    this.palette.splice(state.palette.length, this.palette.length);
    this.setColor(state.color);
    this.setBackground(state.background);
    this.setLineWidth(state.lineWidth);
    this.setOpacity(state.opacity);
  },

  createSnapshot : function() {
    return {
      state: this.getState()
    };
  },

  applySnapshot : function(snapshot) {
    this.applyState(snapshot.state);
    this.requestRedraw();
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
    this.newDocument();
    this.clearHistory();
    this.resize(obj.width, obj.height);
    for (var i=0; i<obj.history.length; i++) {
      if (obj.history[i] != null) {
        this.applyHistoryState(obj.history[i]);
        this.history.last().breakpoint = obj.history[i].breakpoint;
      }
    }
    this.gotoHistoryState(obj.historyIndex);
  },


  // UI Event listeners

  addListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.addEventListener(i, this.listeners[i], false);
      }
    }
    var self = this;
  },

  removeListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.removeEventListener(i, this.listeners[i], false);
      }
    }
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
            draw.removeTemporaryConstraint(draw.constraint);
            draw.constraint = null;
          }
          if (ev.shiftKey && draw.constraint == null) {
            var dx = draw.current.x - draw.prev.x;
            var dy = draw.current.y - draw.prev.y;
            if (Math.abs(dx) > Math.abs(dy))
              draw.constraint = new Constraints.ConstantY(draw.prev.y);
            else
              draw.constraint = new Constraints.ConstantX(draw.prev.x);
            draw.addTemporaryConstraint(draw.constraint);
          }
          draw.applyConstraints(draw.current);
          draw.drawLine(draw.prev, draw.current);
        }
        draw.prev = draw.current;
        Event.stop(ev);
      }
    };

    this.listeners['mousedown'] = function(ev) {
      draw.stopResizingBrush();
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.cursor.moveTo(draw.current.x, draw.current.y);
      if (Mouse.state[Mouse.LEFT] && ev.target == draw.canvas) {
        draw.mousedown = true;
        draw.beginStroke();
        if (ev.shiftKey && draw.mouseup) {
          if (draw.constraint != null) {
            draw.removeTemporaryConstraint(draw.constraint);
            draw.constraint = null;
          }
          draw.drawLine(draw.mouseup, draw.current);
          draw.prev = null;
        } else {
          draw.drawPoint(draw.current);
          draw.prev = draw.current;
        }
        ev.preventDefault();
      }
    };

    this.listeners['mouseup'] = function(ev) {
      draw.stopResizingBrush();
      if (draw.mousedown)
        ev.preventDefault();
      draw.mousedown = false;
      draw.mouseup = Mouse.getRelativeCoords(draw.canvas, ev);
      if (!Mouse.state[Mouse.LEFT]) {
        draw.prev = null;
      }
      draw.endStroke();
    };

    this.listeners['touchmove'] = function(ev) {
      if (ev.touches.length == 1) {
        draw.current = Mouse.getRelativeCoords(draw.canvas, ev.touches[0]);
        if (draw.resizingBrush) {
          draw.keepResizingBrush();
        } else {
          draw.cursor.moveTo(draw.current.x, draw.current.y);
        }
        if (draw.mousedown) {
          if (draw.prev != null) {
            if (!ev.shiftKey && draw.constraint != null) {
              draw.removeTemporaryConstraint(draw.constraint);
              draw.constraint = null;
            }
            if (ev.shiftKey && draw.constraint == null) {
              var dx = draw.current.x - draw.prev.x;
              var dy = draw.current.y - draw.prev.y;
              if (Math.abs(dx) > Math.abs(dy))
                draw.constraint = new Constraints.ConstantY(draw.prev.y);
              else
                draw.constraint = new Constraints.ConstantX(draw.prev.x);
              draw.addTemporaryConstraint(draw.constraint);
            }
            draw.applyConstraints(draw.current);
            draw.drawLine(draw.prev, draw.current);
          }
          draw.prev = draw.current;
          Event.stop(ev);
        }
      }
    };

    this.listeners['touchstart'] = function(ev) {
      if (ev.touches.length == 1) {
        draw.current = Mouse.getRelativeCoords(draw.canvas, ev.touches[0]);
        draw.cursor.moveTo(draw.current.x, draw.current.y);
        if (ev.target == draw.canvas) {
          draw.mousedown = true;
          draw.beginStroke();
          if (ev.shiftKey && draw.mouseup) {
            if (draw.constraint != null) {
              draw.removeTemporaryConstraint(draw.constraint);
              draw.constraint = null;
            }
            draw.drawLine(draw.mouseup, draw.current);
            draw.prev = null;
          } else {
            draw.drawPoint(draw.current);
            draw.prev = draw.current;
          }
          ev.preventDefault();
        }
      }
    };

    this.listeners['touchend'] = function(ev) {
      if (ev.touches.length == 1) {
        if (draw.mousedown)
          ev.preventDefault();
        draw.mousedown = false;
        draw.mouseup = Mouse.getRelativeCoords(draw.canvas, ev.touches[0]);
        draw.prev = null;
        draw.endStroke();
      }
    };

    this.listeners['keydown'] = function(ev) {
      if (Key.match(ev, Key.ESC)) {
        draw.stopResizingBrush();
      }
      if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.startResizingBrush();

        } else if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.redo();
          else
            draw.undo();

        } else if (Key.match(ev, draw.keyBindings.pickColor) && !ev.ctrlKey && !draw.disableColorPick) {
          draw.pickColor(draw.current, draw.pickRadius);

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          Event.stop(ev);
        }
      }
    };

    this.listeners['keyup'] = function(ev) {
      draw.stopResizingBrush();
      if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.clear)) {
          draw.clear();

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          draw.toggleUI();
          Event.stop(ev);

        } else if (Key.match(ev, draw.keyBindings.toggleHelp)) {
          draw.toggleHelp();

        } else if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.stopResizingBrush();

        } else if (Key.match(ev,  draw.keyBindings.opacityUp)) {
          draw.opacityUp();

        } else if (Key.match(ev,  draw.keyBindings.opacityDown)) {
          draw.opacityDown();

        } else if (Key.match(ev,  draw.keyBindings.brushSizeUp)) {
          draw.brushSizeUp();

        } else if (Key.match(ev,  draw.keyBindings.brushSizeDown)) {
          draw.brushSizeDown();

        } else if (Key.match(ev,  draw.keyBindings.previousBrush)) {
          draw.previousBrush();

        } else if (Key.match(ev,  draw.keyBindings.nextBrush)) {
          draw.nextBrush();

        } else if (Key.match(ev, draw.keyBindings.flip)) {
          draw.flip();

        } else if (Key.match(ev, draw.keyBindings.paletteKeys)) {
          for (var i=0; i<draw.keyBindings.paletteKeys.length; i++) {
            if (Key.match(ev, draw.keyBindings.paletteKeys[i])) {
              draw.setColor(draw.palette[i]);
              break;
            }
          }
        }
      }
    };
  },


  // Interactive brush resizing

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

  brushSizeUp : function() {
    this.setLineWidth(Math.clamp(this.lineWidth*1.5, this.minimumBrushSize, this.maximumBrushSize));
  },

  brushSizeDown : function() {
    this.setLineWidth(Math.clamp(this.lineWidth/1.5, this.minimumBrushSize, this.maximumBrushSize));
  },


  // Opacity keyboard control

  opacityUp : function() {
    if (this.opacity < 0.25) {
      this.setOpacity(0.25);
    } else if (this.opacity < 0.5) {
      this.setOpacity(0.5);
    } else {
      this.setOpacity(1);
    }
  },

  opacityDown : function() {
    if (this.opacity > 0.5) {
      this.setOpacity(0.5);
    } else if (this.opacity > 0.25) {
      this.setOpacity(0.25);
    } else {
      this.setOpacity(0.125);
    }
  },


  // UI toggles

  toggleUI : function() {
    // overwrite with a version that does something
  },

  toggleHelp : function() {
    // overwrite with a version that does something
  },


  // Layers

  newLayer : function(zIndex) {
    var layer = new TiledLayer();
    layer.zIndex = zIndex || 0;
    this.pushLayer(layer);
    this.addHistoryState({methodName:'newLayer', args:[zIndex], breakpoint:true});
    return layer;
  },

  pushLayer : function(layer) {
    var i=0;
    for (; i<this.layers.length; i++) {
      if (this.layers[i].zIndex > layer.zIndex)
        break;
    }
    this.layers.splice(i,0, layer);
  },

  moveLayer : function(srcIdx, dstIdx) {
    var tmp = this.layers[srcIdx];
    this.layers[srcIdx] = this.layers[dstIdx];
    this.layers[dstIdx] = tmp;
    this.addHistoryState({methodName:'moveLayer', args:[srcIdx, dstIdx], breakpoint:true});
    this.requestRedraw();
  },

  deleteLayer : function(i) {
    this.layers.splice(i,1);
    if (i < this.currentLayerIndex) {
      this.currentLayerIndex--;
    }
    this.currentLayerIndex = Math.clamp(this.currentLayerIndex, 0, this.layers.length-1);
    this.currentLayer = this.layers[this.currentLayerIndex];
    this.addHistoryState({methodName:'deleteLayer', args:[i], breakpoint:true});
    this.requestRedraw();
  },

  setCurrentLayer : function(i) {
    this.currentLayer = this.layers[i];
    this.currentLayerIndex = i;
    this.addHistoryState({methodName:'setCurrentLayer', args:[i], breakpoint:true});
    this.requestRedraw();
  },

  clear : function() {
    this.currentLayer.clear();
    this.addHistoryState({methodName: 'clear', args: [], breakpoint: true});
    this.requestRedraw();
  },

  flip : function() {
    this.layers.forEach(function(l) { l.flip(); });
    this.requestRedraw();
    this.addHistoryState({methodName: 'flip', args: [], breakpoint: true});
  },


  // Brush strokes

  beginStroke : function() {
    if (this.strokeInProgress || this.currentLayer.notDrawable) return;
    this.strokeInProgress = true;
    this.strokeLayer.clear();
    this.strokeLayer.show();
    this.addHistoryState({methodName: 'beginStroke', args: [], breakpoint: true});
    this.requestRedraw();
  },

  endStroke : function() {
    if (!this.strokeInProgress) return;
    this.strokeInProgress = false;
    this.strokeLayer.applyTo(this.currentLayer);
    this.strokeLayer.hide();
    this.addHistoryState({methodName: 'endStroke', args: []});
    this.requestRedraw();
  },

  drawPoint : function(xy) {
    if (!this.strokeInProgress) return;
    this.brush.drawPoint(
      this.strokeLayer, this.colorStyle,
      xy.x, xy.y, this.lineWidth/2
    );
    this.addHistoryState({methodName: 'drawPoint', args:[xy]});
    this.requestRedraw();
  },

  drawLine : function(prev, current) {
    if (!this.strokeInProgress) return;
    this.brush.drawLine(
      this.strokeLayer, this.colorStyle,
      prev.x, prev.y, this.lineWidth/2,
      current.x, current.y, this.lineWidth/2
    );
    var s = {methodName: 'drawLine', args:[prev, current]}
    this.addHistoryState(s);
    this.requestRedraw();
  },


  // Brush state

  addRoundBrush : function() {
    this.brushes.push(new RoundBrush);
    this.addHistoryState({methodName: 'addRoundBrush', args: [], breakpoint:true});
  },

  addPolygonBrush : function(path) {
    this.brushes.push(new PolygonBrush(path));
    this.addHistoryState({methodName: 'addPolygonBrush', args: [path], breakpoint:true});
  },

  addImageBrush : function(src) {
    var img = new Image();
    img.src = src;
    this.brushes.push(new ImageBrush(img));
    this.addHistoryState({methodName: 'addImageBrush', args: [src], breakpoint:true});
  },

  setBrush : function(idx) {
    this.brushIndex = idx;
    this.brush = this.brushes[idx];
    this.addHistoryState({methodName: 'setBrush', args: [idx], breakpoint:true});
  },

  nextBrush : function() {
    this.setBrush((this.brushIndex + 1) % this.brushes.length);
  },

  previousBrush : function() {
    if (this.brushIndex == 0)
      this.setBrush(this.brushes.length-1);
    else
      this.setBrush(this.brushIndex - 1);
  },

  deleteBrush : function(idx) {
    if (idx < 0 || idx >= this.brushes.length)
      throw (new Error('Bad brush index'));
    if (idx <= this.brushIndex)
      this.brushIndex--;
    this.setBrush(this.brushIndex);
    this.brushes.splice(idx, 1);
    this.addHistoryState({methodName: 'deleteBrush', args: [idx]});
  },

  setColor : function(color) {
    if (typeof color == 'string')
      this.color = this.styleToColor(color);
    else
      this.color = color;
    var s = this.colorToStyle(this.color);
    byId('foregroundColor').style.backgroundColor = s
    this.colorStyle = s;
    this.addHistoryState({methodName: 'setColor', args:[this.color]});
  },

  setOpacity : function(o) {
    o = Math.clamp(o, 0, 1);
    this.opacity = o;
    this.strokeLayer.opacity = o;
    var s = [];
    for (var i=0; i<Math.round(o*8); i++){
      s.push("`");
    }
    byId('foregroundColor').textContent = s.join("");
    this.addHistoryState({methodName: 'setOpacity', args:[this.opacity]});
  },

  setLineWidth : function(w) {
    this.lineWidth = w;
    this.cursor.update(this.lineWidth);
    // collapse multiple setLineWidth calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setLineWidth')
      last.args[0] = this.lineWidth;
    else
      this.addHistoryState({methodName: 'setLineWidth', args:[this.lineWidth]});
  },


  // Palette

  setupPalette : function() {
    var cc = byClass('paletteColor');
    for (var i=0; i<cc.length; i++) {
      this.setPaletteColor(i, cc[i].getAttribute('color'));
    }
  },

  setPaletteColor : function(idx, color) {
    var c = color;
    if (typeof color == 'string')
      c = this.styleToColor(color);
    byClass('paletteColor')[idx].style.backgroundColor = this.colorToStyle(c);
    this.palette[idx] = c;
    this.addHistoryState({methodName: 'setPaletteColor', args:[idx, c], breakpoint: true});
  },


  // Picking

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


  // Constraints

  addTemporaryConstraint : function(c) {
    this.constraints.push(c);
  },

  removeTemporaryConstraint : function(c) {
    this.constraints.deleteFirst(c);
  },

  addConstraint : function(c) {
    this.constraints.push(c);
    this.addHistoryState({methodName: 'addConstraint', args:[c]});
  },

  removeConstraint : function(c) {
    var idx = this.constraints.indexOf(c);
    if (idx >= 0)
      this.removeConstraintAt(idx);
  },

  removeConstraintAt : function(idx) {
    this.constraints.splice(idx,1);
    this.addHistoryState({methodName: 'removeConstraintAt', args:[idx]});
  },

  applyConstraints : function(p) {
    for (var i=0; i<this.constraints.length; i++) {
      this.constraints[i].applyTo(p);
    }
    return p;
  }


});
