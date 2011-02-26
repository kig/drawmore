Drawmore = Klass(Undoable, ColorUtils, {

  keyBindings : {
    resetView : [Key.ESC],
    pan : [Key.SPACE],
    zoom : ['v', 'm'],
    flip: ['x'],

    undo: ['z', 'n'],
    clear : [Key.DELETE, Key.BACKSPACE],

    nextBrush: ['t','y'],
    previousBrush: ['g','h'],
    brushResize: ['f', 'j'],
    brushSizeUp: ['e', 'i'],
    brushSizeDown: ['d','k'],

    opacityUp: ['w','o'],
    opacityDown: ['s','l'],
    opacity1: null,
    opacity2: null,
    opacity3: null,
    opacity4: null,

    pickColor: ['r', 'u'],
    nextColor: null,
    previousColor: null,
    palette1: ['1'],
    palette2: ['2'],
    palette3: ['3'],
    palette4: ['4'],
    palette5: ['5'],
    palette6: ['6'],
    palette7: ['7'],
    palette8: ['8'],
    palette9: ['9'],

    toggleUI: [Key.TAB, '0'],
    toggleHelp: [191] // question mark
  },

  panX : 0,
  panY : 0,
  zoom : 1,

  lineWidth : 1,
  opacity : 1,
  color : ColorUtils.colorVec(0,0,0,1),
  background : ColorUtils.colorVec(1,1,1,1),
  pickRadius : 1,
  current : null,
  prev : null,

  defaultLineWidth : 0.75,
  defaultColor : ColorUtils.colorVec(0,0,0,1),
  defaultBackground : ColorUtils.colorVec(1,1,1,1),

  brushIndex : 0,

  minimumBrushSize : 0.75,
  maximumBrushSize : 1000,

  strokeInProgress : false,

  width: 1,
  height: 1,

  lastUpdateTime : 0,

  disableColorPick : true,
  flippedX : false,
  flippedY : false,

  initialize : function(canvas, config) {
    this.canvas = canvas;
    Object.extend(this, config);
    this.canvas.style.setProperty("image-rendering", "optimizeSpeed", "important");
    this.ctx = canvas.getContext('2d');
    this.canvas.style.cursor = 'url('+E.canvas(1,1).toDataURL()+'),crosshair';
    Undoable.initialize.call(this);
    this.current = {x:0,y:0};
    this.cursor = new BrushCursor();
    this.layerWidget = new LayerWidget(this, document.body);
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
    this.applyTo(this.ctx, -this.panX, -this.panY, this.width, this.height, this.flippedX, this.flippedY, this.zoom);
    this.lastUpdateTime = (new Date()).getTime();
    this.redrawRequested = false;
    if (this.layerWidget.needRebuild)
      this.layerWidget.rebuild();
    if (this.colorPicker.needRebuild)
      this.colorPicker.rebuild();
  },

  applyTo : function(ctx, x, y, w, h, flippedX, flippedY, zoom) {
    var px = -x;
    var py = -y;
    ctx.save();
      ctx.fillStyle = this.colorToStyle(this.background);
      ctx.fillRect(0,0,w,h);
      ctx.translate(px, py);
      if (flippedX) {
        ctx.translate(-2*px+w, 0);
        ctx.scale(-1,1);
      }
      if (flippedY) {
        ctx.translate(0, -2*py+h);
        ctx.scale(1,-1);
      }
      ctx.scale(zoom, zoom);
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.imageSmoothingEnabled = false;
      for (var i=0; i<this.layers.length; i++) {
        this.layers[i].applyTo(ctx, x, y, w, h, zoom);
        if (i == this.currentLayerIndex && this.strokeLayer.display) {
          this.strokeLayer.applyTo(ctx,x,y,w,h,zoom);
        }
      }
    ctx.restore();
  },

  setBackground : function(color) {
    if (typeof color == 'string')
      this.background = this.styleToColor(color);
    else
      this.background = color;
    if (this.onbackgroundchange)
      this.onbackgroundchange(this.background);
    this.addHistoryState({methodName: 'setBackground', args:[this.background]});
    this.requestRedraw();
  },

  setBackgroundImage : function(src) {
    this.backgroundImage = new Image();
    this.backgroundImage.src = src;
    if (this.onbackgroundimagechange)
      this.onbackgroundimagechange(this.backgroundImage);
    var self = this;
    this.backgroundImage.onload = function() { self.requestRedraw(); };
    this.addHistoryState({methodName: 'setBackground', args:[src]});
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

  exportCanvas : function(canvas) {
    var dataURL = canvas.toDataURL('image/png');
    window.open(dataURL);
  },

  exportVisibleImage : function() {
    this.exportCanvas(this.canvas);
  },

  exportImage : function() {
    this.exportCanvas(this.getFullImage());
  },

  exportCrop : function(x,y,w,h) {
    this.exportCanvas(this.getCroppedImage(x,y,w,h));
  },

  getBoundingBox : function() {
    var top=1/0, left=1/0, bottom=-1/0, right=-1/0;
    for (var i=0; i<this.layers.length; i++) {
      if (this.layers[i].display) {
        var bbox = this.layers[i].getBoundingBox();
        if (bbox) {
          if (bbox.top < top) top = bbox.top;
          if (bbox.left < left) left = bbox.left;
          if (bbox.bottom > bottom) bottom = bbox.bottom;
          if (bbox.right > right) right = bbox.right;
        }
      }
    }
    top = Math.floor(top);
    left = Math.floor(left);
    bottom = Math.ceil(bottom);
    right = Math.ceil(right);
    var width = right-left+1;
    var height = bottom-top+1;
    return {
      top:top, left:left, bottom:bottom, right:right,
      width:width, height:height,
      x: this.flippedX ? right : left,
      y: this.flippedY ? bottom : top
    };
  },

  getCroppedImage : function(x,y,w,h) {
    var exportCanvas = E.canvas(w,h);
    var ctx = exportCanvas.getContext('2d');
    this.applyTo(ctx, x, y, w, h, this.flippedX, this.flippedY, 1);
    return exportCanvas;
  },

  getFullImage : function() {
    var bbox = this.getBoundingBox();
    return this.getCroppedImage(bbox.left, bbox.top, bbox.width, bbox.height);
  },

  load : function(string) {
    var obj = DrawmoreFile.parse(string);
    this.applySaveObject(obj);
  },

  getSaveString : function() {
    return DrawmoreFile.stringify(this.createSaveObject());
  },

  save : function() {
    var string = this.getSaveString();
    var b64 = btoa(string);
    window.open('data:image/x-drawmore;base64,'+b64);
  },


  // Document state management

  newDocument : function() {
    this.clearHistory();
    this.setupDefaultState();
  },

  setupEmptyState : function() {
    this.layers = [];
    this.layerUID = 0;
    this.layerWidget.requestRebuild();
    this.palette = [];
    this.constraints = [];
    this.brushes = [];
    this.resize(this.canvas.width, this.canvas.height);
    this.strokeLayer = new TiledLayer();
  },

  setupDefaultState : function() {
    this.setupEmptyState();
    this.addRoundBrush();
    var s2 = 1/Math.sqrt(2);
    for (var i=0; i<3; i++) {
      var a = (i+1)*Math.PI/8;
      this.addPolygonBrush([
        {x: Math.cos(a+Math.PI-0.05), y: Math.sin(a+Math.PI-0.05)},
        {x: Math.cos(a+Math.PI+0.05), y: Math.sin(a+Math.PI+0.05)},
        {x: Math.cos(a-0.05), y: Math.sin(a-0.05)},
        {x: Math.cos(a+0.05), y: Math.sin(a+0.05)}
      ]);
      this.addPolygonBrush([
        {x: -Math.cos(a+0.05), y: Math.sin(a+0.05)},
        {x: -Math.cos(a-0.05), y: Math.sin(a-0.05)},
        {x: -Math.cos(a+Math.PI+0.05), y: Math.sin(a+Math.PI+0.05)},
        {x: -Math.cos(a+Math.PI-0.05), y: Math.sin(a+Math.PI-0.05)}
      ]);
    }
    this.addPolygonBrush([{x:s2, y:s2}, {x:s2,y:-s2}, {x:-s2,y:-s2}, {x:-s2,y:s2}]);
    this.addPolygonBrush([{x:1, y:0}, {x:0,y:-1}, {x:-1,y:0}, {x:0,y:1}]);
    this.setBrush(0);
    this.setupPalette();
    this.newLayer();
    this.setColor(this.defaultColor);
    this.setBackground(this.defaultBackground);
    this.setLineWidth(this.defaultLineWidth);
    this.setOpacity(1);
    this.resetFlip();
    this.clear();
    this.resetView();
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
      flippedX : this.flippedX,
      flippedY : this.flippedY,
      background : this.background,
      lineWidth : this.lineWidth,
      opacity : this.opacity,
      palette : this.palette.slice(0),
      constraints: cs,
      layerUID: this.layerUID,
      strokeInProgress : this.strokeInProgress,
      layers : this.layers.map(function(l){ return l.copy(); }),
      currentLayerIndex : this.currentLayerIndex,
      strokeLayer : this.strokeLayer.copy()
    };
  },

  applyState : function(state) {
    this.constraints = state.constraints;
    this.strokeInProgress = state.strokeInProgress;
    this.pickRadius = state.pickRadius;
    this.brushes = state.brushes.map(function(l){ return l.copy(); });
    this.setBrush(state.brushIndex);
    this.layers = state.layers.map(function(l){ return l.copy(); });
    this.strokeLayer = state.strokeLayer.copy();
    this.layerUID = state.layerUID;
    this.layerWidget.requestRebuild();
    this.setCurrentLayer(state.currentLayerIndex);
    for (var i=0; i<state.palette.length; i++)
      this.setPaletteColor(i, state.palette[i]);
    this.palette.splice(state.palette.length, this.palette.length);
    this.setColor(state.color);
    this.setBackground(state.background);
    this.setLineWidth(state.lineWidth);
    this.setOpacity(state.opacity);
    this.flippedX = state.flippedX;
    this.flippedY = state.flippedY;
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
      panX : this.panX,
      panY : this.panY,
      zoom : this.zoom
    };
  },

  applySaveObject : function(obj) {
    this.clearHistory();
    this.setupEmptyState();
    for (var i=0; i<obj.history.length; i++) {
      if (obj.history[i] != null) {
        this.applyHistoryState(obj.history[i]);
        var l = this.history[this.history.length-1];
        if (l != null)
          l.breakpoint = obj.history[i].breakpoint;
      } else {
        this.addHistoryBarrier();
      }
    }
    this.gotoHistoryState(obj.historyIndex);
    this.setZoom(obj.zoom);
    this.setPan(obj.panX, obj.panY);
  },


  // UI Event listeners

  addListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.addEventListener(i, this.listeners[i], false);
      }
    }
    var self = this;
    this.canvas.addEventListener('contextmenu', function(ev) {
      ev.preventDefault();
    }, false);
  },

  removeListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.removeEventListener(i, this.listeners[i], false);
      }
    }
    this.canvas.removeEventListener('contextmenu', function(ev) {
      ev.preventDefault();
    }, false);
  },

  createListeners : function() {
    var draw = this;

    this.listeners['mousewheel'] = function(ev) {
      if (ev.wheelDelta > 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['DOMMouseScroll'] = function(ev) {
      if (ev.detail < 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['mousemove'] = function(ev) {
      if (ev.target == draw.canvas) {
        draw.cursor.show();
      } else {
        draw.cursor.hide();
      }
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      if (draw.panning)
        draw.keepPanning();
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
        ev.preventDefault();
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
      } else if (Mouse.state[Mouse.MIDDLE] && ev.target == draw.canvas) {
        draw.startPanning();
        ev.preventDefault();
      } else if (Mouse.state[Mouse.RIGHT] && ev.target == draw.canvas) {
        draw.startResizingBrush();
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
      if (ev.button == Mouse.MIDDLE) {
        draw.stopPanning();
      }
      draw.endStroke();
    };

    this.listeners['touchmove'] = function(ev) {
      if (ev.touches.length == 1) {
        draw.current = Mouse.getRelativeCoords(draw.canvas, ev.touches[0]);
        if (draw.panning)
          draw.keepPanning();
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
          ev.preventDefault();
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
      if (ev.altKey) {
        if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.redo(true);
          else
            draw.undo(true);
        }
      } else if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.startResizingBrush();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          draw.startPanning();

        } else if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.redo();
          else
            draw.undo();

        } else if (Key.match(ev, draw.keyBindings.zoom)) {
          if (ev.shiftKey)
            draw.zoomOut();
          else
            draw.zoomIn();

        } else if (Key.match(ev, draw.keyBindings.pickColor) && !ev.ctrlKey && !draw.disableColorPick) {
          draw.pickColor(draw.current, draw.pickRadius);

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          ev.preventDefault();
        }
      }
    };

    this.listeners['keyup'] = function(ev) {
      draw.stopResizingBrush();
      if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.clear)) {
          draw.clear();

        } else if (Key.match(ev, draw.keyBindings.resetView)) {
          draw.resetView();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          draw.stopPanning();

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          draw.toggleUI();
          ev.preventDefault();

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
          if (ev.shiftKey)
            draw.flipY();
          else
            draw.flipX();

        } else if (Key.match(ev, draw.keyBindings.opacity1)) {
          draw.setOpacity(0.125);
        } else if (Key.match(ev, draw.keyBindings.opacity2)) {
          draw.setOpacity(0.25);
        } else if (Key.match(ev, draw.keyBindings.opacity3)) {
          draw.setOpacity(0.5);
        } else if (Key.match(ev, draw.keyBindings.opacity4)) {
          draw.setOpacity(1);

        } else if (Key.match(ev, draw.keyBindings.nextColor)) {
          draw.nextColor();

        } else if (Key.match(ev, draw.keyBindings.previousColor)) {
          draw.previousColor();

        } else if (Key.match(ev, draw.keyBindings.palette1)) {
          if (ev.shiftKey) draw.setPaletteColor(0, draw.color);
          else draw.setColor(draw.palette[0]);
        } else if (Key.match(ev, draw.keyBindings.palette2)) {
          if (ev.shiftKey) draw.setPaletteColor(1, draw.color);
          else draw.setColor(draw.palette[1]);
        } else if (Key.match(ev, draw.keyBindings.palette3)) {
          if (ev.shiftKey) draw.setPaletteColor(2, draw.color);
          else draw.setColor(draw.palette[2]);
        } else if (Key.match(ev, draw.keyBindings.palette4)) {
          if (ev.shiftKey) draw.setPaletteColor(3, draw.color);
          else draw.setColor(draw.palette[3]);
        } else if (Key.match(ev, draw.keyBindings.palette5)) {
          if (ev.shiftKey) draw.setPaletteColor(4, draw.color);
          else draw.setColor(draw.palette[4]);
        } else if (Key.match(ev, draw.keyBindings.palette6)) {
          if (ev.shiftKey) draw.setPaletteColor(5, draw.color);
          else draw.setColor(draw.palette[5]);
        } else if (Key.match(ev, draw.keyBindings.palette7)) {
          if (ev.shiftKey) draw.setPaletteColor(6, draw.color);
          else draw.setColor(draw.palette[6]);
        } else if (Key.match(ev, draw.keyBindings.palette8)) {
          if (ev.shiftKey) draw.setPaletteColor(7, draw.color);
          else draw.setColor(draw.palette[7]);
        } else if (Key.match(ev, draw.keyBindings.palette9)) {
          if (ev.shiftKey) draw.setPaletteColor(8, draw.color);
          else draw.setColor(draw.palette[8]);

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


  // Reset view

  resetView : function() {
    var f = 1/this.zoom;
    this.setZoom(1);
    this.setLineWidth(this.lineWidth * f);
    this.setPan(0,0);
  },


  // Panning

  startPanning : function() {
    if (this.panning) return;
    this.panning = true;
    this.panStart = this.current;
  },

  keepPanning : function() {
    if (!this.panning) return;
    var dx = this.current.x - this.panStart.x;
    var dy = this.current.y - this.panStart.y;
    this.panStart = this.current;
    this.pan(dx,dy);
  },

  stopPanning : function() {
    if (!this.panning) return;
    this.panning = false;
    var dx = this.current.x - this.panStart.x;
    var dy = this.current.y - this.panStart.y;
    this.panStart = null;
    this.pan(dx,dy);
  },

  pan : function(dx, dy) {
    this.setPan(this.panX+(this.flippedX?-1:1)*dx, this.panY+(this.flippedY?-1:1)*dy);
  },

  setPan : function(x, y) {
    this.panX = x;
    this.panY = y;
    this.requestRedraw();
  },


  // Zooming

  zoomIn : function() {
    this.setZoom(this.zoom * 2);
    this.setLineWidth(this.lineWidth * 2);
  },

  zoomOut : function() {
    this.setZoom(this.zoom / 2);
    this.setLineWidth(this.lineWidth / 2);
  },

  setZoom : function(z) {
    if (z < (1/64) || z > 64) return;
    var f = z/this.zoom;
    if (this.flippedX) {
      // panX is the distance of the right edge of the screen from the origin
      this.panX = Math.floor(f*(this.panX-(this.width-this.current.x))+(this.width-this.current.x));
    } else {
      // panX is the distance of the left edge of the screen from the origin
      this.panX = Math.floor(f*(this.panX-this.current.x)+this.current.x);
    }
    if (this.flippedY) {
      this.panY = Math.floor(f*(this.panY-(this.height-this.current.y))+(this.height-this.current.y));
    } else {
      this.panY = Math.floor(f*(this.panY-this.current.y)+this.current.y);
    }
    this.zoom = z;
    this.requestRedraw();
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

  newLayer : function() {
    var layer = new TiledLayer();
    layer.name = "Layer " + this.layerUID;
    layer.uid = this.layerUID;
    this.layerUID++;
    if (this.layers.length == 0) {
      this.layers.push(layer);
      this.setCurrentLayer(this.layers.length-1, false);
    } else {
      this.layers.splice(this.currentLayerIndex+1,0,layer);
      this.setCurrentLayer(this.currentLayerIndex+1, false);
    }
    this.layerWidget.requestRebuild();
    this.addHistoryState({methodName:'newLayer', args:[], breakpoint:true});
    return layer;
  },

  renameLayer : function(idx, name) {
    this.layers[idx].name = name;
    this.layerWidget.requestRebuild();
    this.addHistoryState({methodName:'renameLayer', args:[idx, name], breakpoint:true});
  },

  hideLayer : function(idx) {
    this.layers[idx].display = false;
    this.layerWidget.requestRebuild();
    this.requestRedraw();
    this.addHistoryState({methodName:'hideLayer', args:[idx], breakpoint:true});
  },

  showLayer : function(idx) {
    this.layers[idx].display = true;
    this.layerWidget.requestRebuild();
    this.requestRedraw();
    this.addHistoryState({methodName:'showLayer', args:[idx], breakpoint:true});
  },

  toggleLayer : function(idx) {
    if (this.layers[idx].display)
      this.hideLayer(idx);
    else
      this.showLayer(idx);
  },

  moveLayer : function(srcIdx, dstIdx) {
    var tmp = this.layers[srcIdx];
    if (srcIdx < dstIdx) {
      for (var i=srcIdx; i<dstIdx; i++)
        this.layers[i] = this.layers[i+1];
      this.layers[dstIdx] = tmp;
    } else {
      for (var i=srcIdx; i>dstIdx; i--)
        this.layers[i] = this.layers[i-1];
      this.layers[dstIdx] = tmp;
    }
    if (srcIdx == this.currentLayerIndex) {
      this.setCurrentLayer(dstIdx, false);
    } else if (srcIdx < this.currentLayerIndex && dstIdx >= this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex-1, false);
    } else if (srcIdx > this.currentLayerIndex && dstIdx <= this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex+1, false);
    }
    this.addHistoryState({methodName:'moveLayer', args:[srcIdx, dstIdx], breakpoint:true});
    this.requestRedraw();

    this.layerWidget.requestRebuild();
  },

  deleteLayer : function(i) {
    if (i < this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex-1, false);
    }
    if (i == this.layers.length-1 && i == this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex-1, false);
    }
    this.layers.splice(i,1);
    if (i == this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex, false);
    }
    this.addHistoryState({methodName:'deleteLayer', args:[i], breakpoint:true});
    this.requestRedraw();

    this.layerWidget.requestRebuild();
  },

  deleteCurrentLayer : function() {
    this.deleteLayer(this.currentLayerIndex);
  },

  setCurrentLayer : function(i, recordHistory) {
    this.currentLayer = this.layers[i];
    this.currentLayerIndex = i;
    if (recordHistory != false) {
      // collapse multiple setCurrentLayer calls into a single history event
      var last = this.history.last();
      if (last && last.methodName == 'setCurrentLayer')
        last.args[0] = i;
      else
        this.addHistoryState({methodName: 'setCurrentLayer', args:[i], breakpoint:true});
    }
    this.requestRedraw();

    this.layerWidget.requestRebuild();
  },

  clear : function() {
    this.currentLayer.clear();
    this.addHistoryState({methodName: 'clear', args: [], breakpoint: true});
    this.requestRedraw();
  },

  flipX : function() {
    this.flippedX = !this.flippedX;
    this.requestRedraw();
    this.addHistoryState({methodName: 'flipX', args: []});
  },

  flipY : function() {
    this.flippedY = !this.flippedY;
    this.requestRedraw();
    this.addHistoryState({methodName: 'flipY', args: []});
  },

  resetFlip : function() {
    this.flippedX = this.flippedY = false;
    this.requestRedraw();
    this.addHistoryState({methodName: 'resetFlip', args: []});
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

  getAbsolutePoint : function(p) {
    var np = Object.extend({}, p);
    var pX = (this.flippedX ? -np.x+this.width-this.panX : np.x-this.panX);
    var pY = (this.flippedY ? -np.y+this.height-this.panY : np.y-this.panY);
    np.x = pX/this.zoom;
    np.y = pY/this.zoom;
    np.r = (this.lineWidth/2)/this.zoom;
    if (this.pressureControlsSize)
      np.r *= np.pressure;
    if (this.pressureControlsOpacity)
      np.opacity *= np.pressure;
    np.brushTransform = this.getBrushTransform();
    np.absolute = true;
    return np;
  },

  getBrushTransform : function() {
    return [
      this.flippedX ? -1 : 1, 0,
      0, this.flippedY ? -1 : 1
    ];
  },

  drawPoint : function(xy) {
    if (!this.strokeInProgress) return;
    if (!xy.absolute)
      xy = this.getAbsolutePoint(xy);
    this.brush.drawPoint(
      this.strokeLayer, this.colorStyle,
      xy.x, xy.y, xy.r,
      xy.brushTransform
    );
    this.addHistoryState({methodName: 'drawPoint', args:[xy]});
    this.requestRedraw();
  },

  drawLine : function(a, b) {
    if (!this.strokeInProgress) return;
    if (!a.absolute)
      a = this.getAbsolutePoint(a);
    if (!b.absolute)
      b = this.getAbsolutePoint(b);
    this.brush.drawLine(
      this.strokeLayer, this.colorStyle,
      a.x, a.y, a.r,
      b.x, b.y, b.r,
      a.brushTransform
    );
    this.addHistoryState({methodName: 'drawLine', args:[a, b]});
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
    this.cursor.setBrush(this.brush, [1,0,0,1], this.colorStyle, this.opacity);
    this.addHistoryState({methodName: 'setBrush', args: [idx]});
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
    this.colorStyle = s;
    if (this.oncolorchange)
      this.oncolorchange(this.color);
    this.cursor.update(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
    if (this.colorPicker)
      this.colorPicker.setColor(this.color, false);
    // collapse multiple setColor calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setColor')
      last.args[0] = this.color;
    else
      this.addHistoryState({methodName: 'setColor', args:[this.color]});
  },

  setOpacity : function(o) {
    o = Math.clamp(o, 0, 1);
    this.opacity = o;
    this.strokeLayer.opacity = o;
    if (this.onopacitychange)
      this.onopacitychange(o);
    this.cursor.update(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
    // collapse multiple setOpacity calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setOpacity')
      last.args[0] = this.opacity;
    else
      this.addHistoryState({methodName: 'setOpacity', args:[this.opacity]});
  },

  setLineWidth : function(w) {
    this.lineWidth = w;
    this.cursor.update(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
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

  nextColor : function() {
    var idx = this.palette.indexOf(this.color);
    if (idx < 0) idx = this.palette.length-1;
    this.setColor(this.palette[(idx+1) % this.palette.length]);
  },

  previousColor : function() {
    var idx = this.palette.indexOf(this.color);
    if (idx < 0) idx = this.palette.length+1;
    this.setColor(this.palette[(idx-1) % this.palette.length]);
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
