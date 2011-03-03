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

    nudgeLayerUp : [Key.UP],
    nudgeLayerDown : [Key.DOWN],
    nudgeLayerLeft : [Key.LEFT],
    nudgeLayerRight : [Key.RIGHT],

    layerAbove: ['q'],
    layerBelow: ['a'],
    duplicateCurrentLayer: ['c'],
    toggleCurrentLayer: ['v'],
    groupLayer: ['g'],

    toggleUI: [Key.TAB, '0'],
    toggleHelp: [191] // question mark
  },

  panX : 0,
  panY : 0,
  zoom : 1,

  lineWidth : 1,
  opacity : 1,
  color : ColorUtils.colorVec(0,0,0,1),
  colorStyle: 'rgba(0,0,0,1)',
  background : ColorUtils.colorVec(1,1,1,1),
  pickRadius : 1,
  current : null,
  prev : null,

  defaultLineWidth : 0.75,
  defaultColor : ColorUtils.colorVec(0,0,0,1),
  defaultBackground : ColorUtils.colorVec(0.933,0.914,0.882,1),
  brushIndex : 0,

  minimumBrushSize : 0.75,
  maximumBrushSize : 1000,

  strokeInProgress : false,

  width: 1,
  height: 1,

  lastUpdateTime : 0,
  frameCount : 0,

  inputTime : -1,
  lastInputTime : -1,
  inputCount : 0,

  compositingTime : 0,

  disableColorPick : true,
  flippedX : false,
  flippedY : false,

  initialize : function(canvas, config) {
    this.canvas = canvas;
    this.layerManager = new LayerManager();
    Object.extend(this, config);
    this.canvas.style.setProperty("image-rendering", "optimizeSpeed", "important");
    this.ctx = canvas.getContext('2d');
    var c = this.getCSSCursor();
    this.canvas.style.cursor = 'url('+c.toDataURL()+') 1 1,crosshair';
    Undoable.initialize.call(this);
    this.current = {x:0,y:0};
    this.cursor = new BrushCursor();
    this.layerWidget = new LayerWidget(this, document.body);
    this.setupDefaultState();
    this.listeners = {};
    this.createListeners();
    this.addListeners();
    this.updateInputTime();
    this.frameTimes = new glMatrixArrayType(100);
    for (var i=0; i<this.frameTimes.length; i++) this.frameTimes[i] = 0;
    this.inputTimes = new glMatrixArrayType(100);
    for (var i=0; i<this.inputTimes.length; i++) this.inputTimes[i] = 0;
    var self = this;
    setTimeout(function() {
      // ctrl-R messes with the r key when reloading
      self.disableColorPick = false;
    }, 1000);
  },

  getCSSCursor : function() {
    var cssCursor = E.canvas(3,3);
    var ctx = cssCursor.getContext('2d');
    ctx.beginPath();
    ctx.arc(1,1,1,0,Math.PI*2,false);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'white';
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.fillRect(1,1,1,1);
    return cssCursor;
  },

  // Draw loop

  updateDisplay : function() {
    var t0 = new Date;
    this.applyTo(this.ctx, -this.panX, -this.panY, this.width, this.height, this.flippedX, this.flippedY, this.zoom);
    this.ctx.getImageData(0,0,1,1); // force draw completion
    var t1 = new Date;
    if (this.inputTime >= this.lastUpdateTime) {
      var inputLag = t1 - this.inputTime;
      this.inputTimes[this.inputCount%this.inputTimes.length] = inputLag;
      this.drawInputTimeHistogram(this.ctx, 12, 68);
      this.inputCount++;
    }
    var elapsed = t1-t0;
    this.frameTimes[this.frameCount%this.frameTimes.length] = elapsed;
    this.redrawRequested = false;
    this.layerWidget.redraw();
    this.colorPicker.redraw();
    this.drawFrameTimeHistogram(this.ctx, 12, 38);
    var t2 = new Date().getTime();
    this.ctx.save();
      this.ctx.font = '9px sans-serif';
      var fpsText = 'frame interval ' + (t2-(this.lastUpdateTime||t2)) + ' ms';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(fpsText, 12+1, 98+9+1);
      this.ctx.fillStyle = 'black';
      this.ctx.fillText(fpsText, 12, 98+9);
    this.ctx.restore();
    this.frameCount++;
    this.lastUpdateTime = t2;
    var self = this;
  },

  updateInputTime : function() {
    this.lastInputTime = new Date().getTime();
    if (this.inputTime < this.lastUpdateTime)
      this.inputTime = new Date().getTime();
  },

  drawHistogram : function(title, unit, times, count, ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'black';
    var fc = count % times.length;
    var fx = times.length-1;
    var total = 0;
    for (var i=fc; i>=0; i--, fx--) {
      var ft = times[i];
      total += ft;
      ctx.fillRect(x+fx, y+12, 1, ft/4);
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      total += ft;
      ctx.fillRect(x+fx, y+12, 1, ft/4);
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(x,y+11,times.length,0.5);
    var fx = times.length-1;
    for (var i=fc; i>=0; i--, fx--) {
      var ft = times[i];
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    ctx.font = '9px sans-serif';
    var fpsText = title + times[fc] + unit;
    ctx.fillStyle = 'white';
    ctx.fillText(fpsText, x+1, y+10);
    ctx.fillStyle = 'black';
    ctx.fillText(fpsText, x, y+9);
    ctx.restore();
  },

  drawFrameTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("draw time ", " ms", this.frameTimes, this.frameCount, ctx, x, y);
  },

  drawInputTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("input lag ", " ms", this.inputTimes, this.inputCount, ctx, x, y);
  },

  applyTo : function(ctx, x, y, w, h, flippedX, flippedY, zoom) {
    var px = -x;
    var py = -y;
    ctx.save();
      ctx.fillStyle = this.colorToStyle(this.background);
      ctx.fillRect(0,0,w,h);
      var xs = 1, ys = 1;
      if (flippedX) {
        px = px + -2*px+w;
        xs = -1;
      }
      if (flippedY) {
        py = py + -2*py+h;
        ys = -1;
      }
      ctx.translate(px, py);
      ctx.scale(zoom*xs, zoom*ys);
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.imageSmoothingEnabled = false;
      this.tempLayer.x = x;
      this.tempLayer.y = y;
      this.tempLayer.compensateZoom = zoom;
      if (this.strokeLayer.display && this.currentLayer) {
        this.currentLayer.prependChild(this.strokeLayer);
        var composite = (this.erasing ? 'destination-out' :
          (this.currentLayer.opacityLocked ? 'source-atop' : 'source-over')
        );
        this.strokeLayer.globalCompositeOperation = composite;
      }
      for (var i=0; i<this.layers.length; i++) {
        var layer = this.layers[i];
        if (!layer.hasParentNode()) {
          if (layer.childNodes.length > 0)
            this.tempLayer.clear();
          layer.applyTo(ctx, null, this.tempLayer);
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
    this.addHistoryState(new HistoryState('setBackground', [this.background]));
    this.requestRedraw();
  },

  setBackgroundImage : function(src) {
    this.backgroundImage = new Image();
    this.backgroundImage.src = src;
    if (this.onbackgroundimagechange)
      this.onbackgroundimagechange(this.backgroundImage);
    var self = this;
    this.backgroundImage.onload = function() { self.requestRedraw(); };
    this.addHistoryState(new HistoryState('setBackground', [src]));
  },

  requestRedraw : function() {
    if (this.redrawRequested)
      return;
    this.inputTime = this.lastInputTime;
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
    this.layerWidget.requestRedraw();
    this.palette = [];
    this.constraints = [];
    this.brushes = [];
    this.resize(this.canvas.width, this.canvas.height);
    this.strokeLayer = this.createLayerObject();
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
    this.tempLayer = new CanvasLayer(w,h);
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
    this.layerManager.rebuild(this.layers);
    this.layerManager.addLayer(this.strokeLayer);
    this.layerWidget.requestRedraw();
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
      if (ev.target != draw.canvas)
        return;
      draw.updateInputTime();
      if (ev.wheelDelta > 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['DOMMouseScroll'] = function(ev) {
      if (ev.target != draw.canvas)
        return;
      draw.updateInputTime();
      if (ev.detail < 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['mousemove'] = function(ev) {
      draw.updateInputTime();
      if (ev.target == draw.canvas) {
        draw.cursor.show();
      } else {
        draw.cursor.hide();
      }
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      if (draw.panning)
        draw.keepPanning();
      if (draw.moving)
        draw.keepMoving();
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
      draw.updateInputTime();
      draw.stopResizingBrush();
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.cursor.moveTo(draw.current.x, draw.current.y);
      if (Mouse.state[Mouse.LEFT] && ev.target == draw.canvas) {
        draw.mousedown = true;
        if (ev.altKey)
          draw.erasing = true;
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
        if (ev.shiftKey)
          draw.startMoving();
        else
          draw.startPanning();
        ev.preventDefault();
      } else if (Mouse.state[Mouse.RIGHT] && ev.target == draw.canvas) {
        draw.startResizingBrush();
        ev.preventDefault();
      }
    };

    this.listeners['mouseup'] = function(ev) {
      draw.updateInputTime();
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
        draw.stopMoving();
      }
      draw.endStroke();
      draw.erasing = false;
    };

    this.listeners['touchmove'] = function(ev) {
      draw.updateInputTime();
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
      draw.updateInputTime();
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
      draw.updateInputTime();
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
      draw.updateInputTime();
      if (ev.altKey) {
        if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.redo(true);
          else
            draw.undo(true);
          ev.preventDefault();
        }
      } else if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.startResizingBrush();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          if (ev.shiftKey)
            draw.startMoving();
          else
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

        } else if (Key.match(ev,  draw.keyBindings.opacityUp)) {
          if (ev.shiftKey)
            draw.currentLayerOpacityUp();

        } else if (Key.match(ev,  draw.keyBindings.opacityDown)) {
          if (ev.shiftKey)
            draw.currentLayerOpacityDown();

        } else if (Key.match(ev, draw.keyBindings.nudgeLayerUp)) {
          draw.moveCurrentLayer(0, -1*(ev.shiftKey ? 10 : 1));
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerDown)) {
          draw.moveCurrentLayer(0, 1*(ev.shiftKey ? 10 : 1));
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerLeft)) {
          draw.moveCurrentLayer(-1*(ev.shiftKey ? 10 : 1), 0);
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerRight)) {
          draw.moveCurrentLayer(1*(ev.shiftKey ? 10 : 1), 0);

        } else if (Key.match(ev, draw.keyBindings.pickColor) && !ev.ctrlKey && !draw.disableColorPick) {
          draw.pickColor(draw.current, draw.pickRadius);

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          ev.preventDefault();
        }
      }
    };

    this.listeners['keyup'] = function(ev) {
      draw.updateInputTime();
      draw.stopResizingBrush();
      if (ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.flip)) {
          if (ev.shiftKey)
            draw.flipCurrentLayerVertically();
          else
            draw.flipCurrentLayerHorizontally();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.layerAbove)) {
          draw.newLayer();
          ev.preventDefault();
        } else if (Key.match(ev, draw.keyBindings.layerBelow)) {
          draw.newLayerBelow();
          ev.preventDefault();

        } else if (Key.match(ev,  draw.keyBindings.groupLayer)) {
          draw.toggleCurrentLayerGrouping();

        } else if (Key.match(ev, draw.keyBindings.duplicateCurrentLayer)) {
          draw.duplicateCurrentLayer();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.toggleCurrentLayer)) {
          draw.toggleCurrentLayer();
          ev.preventDefault();

        }
      }
      if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.clear)) {
          if (ev.shiftKey)
            draw.deleteCurrentLayer();
          else
            draw.clear();

        } else if (Key.match(ev, draw.keyBindings.resetView)) {
          draw.resetView();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          draw.stopPanning();
          draw.stopMoving();

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          draw.toggleUI();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.toggleHelp)) {
          draw.toggleHelp();

        } else if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.stopResizingBrush();

        } else if (Key.match(ev,  draw.keyBindings.opacityUp)) {
          if (!ev.shiftKey)
            draw.opacityUp();

        } else if (Key.match(ev,  draw.keyBindings.opacityDown)) {
          if (!ev.shiftKey)
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

        } else if (Key.match(ev, draw.keyBindings.layerAbove)) {
          if (ev.shiftKey)
            draw.toggleCurrentLayerOpacityLocked();
          else
            draw.layerAbove();
        } else if (Key.match(ev, draw.keyBindings.layerBelow)) {
          if (ev.shiftKey)
            draw.mergeDown();
          else
            draw.layerBelow();

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


  // Moving layers

  startMoving : function() {
    if (this.moving) return;
    this.moving = true;
    this.moveStart = this.current;
  },

  keepMoving : function() {
    if (!this.moving) return;
    var dx = this.current.x - this.moveStart.x;
    var dy = this.current.y - this.moveStart.y;
    this.moveStart = this.current;
    dx *= this.flippedX ? -1 : 1;
    dy *= this.flippedY ? -1 : 1;
    this.moveCurrentLayer(dx/this.zoom,dy/this.zoom);
  },

  stopMoving : function() {
    if (!this.moving) return;
    this.moving = false;
    var dx = this.current.x - this.moveStart.x;
    var dy = this.current.y - this.moveStart.y;
    this.moveStart = null;
    dx *= this.flippedX ? -1 : 1;
    dy *= this.flippedY ? -1 : 1;
    this.moveCurrentLayer(dx/this.zoom,dy/this.zoom);
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

  groupLayer : function(srcUID, groupUID) {
    var layer = this.layerManager.getLayerByUID(srcUID);
    var group = this.layerManager.getLayerByUID(groupUID);
    group.appendChild(layer);
    layer.globalCompositeOperation = 'source-atop';
  },

  ungroupLayer : function(uid) {
    var layer = this.layerManager.getLayerByUID(uid);
    layer.getParentNode().removeChild(layer);
    layer.globalCompositeOperation = 'source-over';
  },

  toggleCurrentLayerGrouping : function() {
    var uid = this.currentLayer.uid;
    if (this.currentLayerIndex > 0) {
      if (this.currentLayer.hasParentNode()) {
        var idx = this.currentLayerIndex+1;
        while (idx < this.layers.length && this.layers[idx].parentNodeUID == this.currentLayer.parentNodeUID) {
          this.currentLayer.appendChild(this.layers[idx]);
          idx++;
        }
        this.ungroupLayer(uid);
      } else {
        var prev = this.layers[this.currentLayerIndex-1];
        if (prev.hasParentNode())
          prev = prev.getParentNode();
        this.groupLayer(uid, prev.uid);
      }
      this.addHistoryState(new HistoryState('toggleCurrentLayerGrouping', [], true));
      this.layerWidget.requestRedraw();
      this.requestRedraw();
    }
  },

  layerAbove : function() {
    this.setCurrentLayer(this.currentLayerIndex+1);
  },

  layerBelow : function() {
    this.setCurrentLayer(this.currentLayerIndex-1);
  },

  toggleCurrentLayer : function() {
    this.toggleLayer(this.currentLayer.uid);
  },

  toggleCurrentLayerOpacityLocked : function() {
    this.toggleLayerOpacityLocked(this.currentLayer.uid);
  },

  toggleLayerOpacityLocked : function(uid) {
    var layer = this.layerManager.getLayerByUID(uid);
    layer.opacityLocked = !layer.opacityLocked;
    this.addHistoryState(new HistoryState('toggleLayerOpacityLocked', [uid], true));
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  toggleLayerLinkPosition : function(uid) {
    if (uid != this.currentLayer.uid) {
      var l = this.layerManager.getLayerByUID(uid);
      var linked = l.isPropertyLinkedWith('x', this.currentLayer);
      if (linked) {
        l.unlinkProperty('x');
        l.unlinkProperty('y');
      } else {
        this.currentLayer.linkProperty('x', l);
        this.currentLayer.linkProperty('y', l);
      }
      this.addHistoryState(new HistoryState('toggleLayerLinkPosition', [uid], true));
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  flipCurrentLayerHorizontally : function() {
    this.currentLayer.flipX();
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerHorizontally', [], true));
  },

  flipCurrentLayerVertically : function() {
    this.currentLayer.flipY();
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerVertically', [], true));
  },

  moveCurrentLayer : function(dx, dy) {
    if (this.currentLayer) {
      this.currentLayer.modify('x', dx);
      this.currentLayer.modify('y', dy);
      var self = this;
      this.currentLayer.childNodes.forEach(function(cn){
        var l = self.layerManager.getLayerByUID(cn);
        if (!l.isPropertyLinkedWith('x', self.currentLayer)) {
          l.x += dx;
          l.y += dy;
        }
      });
      this.requestRedraw();
      var l = this.history.last();
      if (l.methodName == 'moveCurrentLayer') {
        this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], false));
      } else {
        this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], true));
      }
    }
  },

  mergeDown : function(addHistory) {
    if (this.currentLayerIndex > 0) {
      var target = this.createLayerObject();
      var below = this.layers[this.currentLayerIndex-1];
      target.name = this.currentLayer.name;
      below.applyTo(target);
      this.currentLayer.applyTo(target);
      var cidx = this.currentLayerIndex;
      this.deleteLayer(cidx, false);
      this.deleteLayer(cidx-1, false);
      this.layers.splice(cidx-1, 0, target);
      this.setCurrentLayer(cidx-1, false);
      this.addHistoryState(new HistoryState('mergeDown', [], true));
    }
  },

  mergeVisible : function() {
    var target = this.createLayerObject();
    this.layers.forEach(function(l){ l.applyTo(target); });
    var firstIdx = null;
    for (var i=0; i<this.layers.length; i++) {
      while (i<this.layers.length && this.layers[i].display) {
        if (firstIdx == null) firstIdx = i;
        this.deleteLayer(i, false);
      }
    }
    this.layers.splice(firstIdx || 0, 0, target);
    this.setCurrentLayer(firstIdx, false);
    this.addHistoryState(new HistoryState('mergeVisible', [], true));
  },

  mergeAll : function() {
    var target = this.createLayerObject();
    this.layers.forEach(function(l){ l.applyTo(target); });
    while (this.layers.length > 0)
      this.deleteLayer(this.layers.length-1, false);
    this.layers.push(target);
    this.setCurrentLayer(this.layers.length-1, false);
    this.addHistoryState(new HistoryState('mergeAll', [], true));
  },

  setCurrentLayerOpacity : function(opacity) {
    this.setLayerOpacity(this.currentLayer.uid, opacity);
    this.layerWidget.requestRedraw();
  },

  currentLayerOpacityUp : function() {
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity * 1.1, 1/255, 1));
  },

  currentLayerOpacityDown : function() {
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity / 1.1, 0, 1));
  },

  setLayerOpacity : function(uid, opacity) {
    var layer = this.layerManager.getLayerByUID(uid);
    if (layer) {
      layer.set('opacity', opacity);
      this.requestRedraw();
      var l = this.history.last();
      if (l.methodName == 'setLayerOpacity' && l.args[0] == uid) {
        l.args[1] = opacity;
      } else {
        this.addHistoryState(new HistoryState('setLayerOpacity', [uid, opacity], true));
      }
    }
  },

  createLayerObject : function() {
    var layer = new TiledLayer();
    layer.name = "Layer " + this.layerUID;
    layer.uid = this.layerUID;
    this.layerUID++;
    this.layerManager.addLayer(layer);
    layer.layerManager = this.layerManager;
    return layer;
  },

  newLayerFromImage : function(img, x, y, name) {
    var layer = this.createLayerObject();
    if (name != null)
      layer.name = name;
    if ((x == null || y == null) && this.current) {
      var xy = this.getAbsolutePoint(this.current);
      x = xy.x;
      y = xy.y;
    }
    x = x || 0;
    y = y || 0;
    layer.drawImage(img, 0, 0);
    layer.set('x', x);
    layer.set('y', y);
    this.layers.push(layer);
    this.setCurrentLayer(this.layers.length-1, false);
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('newLayerFromImage',  [img,x,y,name], true));
  },

  newLayer : function() {
    var layer = this.createLayerObject();
    if (this.layers.length == 0) {
      this.layers.push(layer);
      this.setCurrentLayer(this.layers.length-1, false);
    } else {
      this.layers.splice(this.currentLayerIndex+1,0,layer);
      this.setCurrentLayer(this.currentLayerIndex+1, false);
    }
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('newLayer', [], true));
    return layer;
  },

  newLayerBelow : function() {
    var layer = this.createLayerObject();
    if (this.layers.length == 0) {
      this.layers.push(layer);
      this.setCurrentLayer(this.layers.length-1, false);
    } else {
      this.layers.splice(this.currentLayerIndex,0,layer);
      this.setCurrentLayer(this.currentLayerIndex, false);
    }
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('newLayerBelow', [], true));
    return layer;
  },

  duplicateCurrentLayer : function() {
    var layer = this.currentLayer.copy(false);
    var m = layer.name.match(/ \(copy( \d+)?\)$/);
    if (m) {
      m[1] = m[1] || 0;
      var cidx = parseInt(m[1])+1;
      layer.name = layer.name.replace(/copy( \d+)?\)$/, 'copy '+cidx+')');
    } else {
      layer.name += " (copy)";
    }
    if (this.layers.length == 0) {
      this.layers.push(layer);
      this.setCurrentLayer(this.layers.length-1, false);
    } else {
      this.layers.splice(this.currentLayerIndex+1,0,layer);
      this.setCurrentLayer(this.currentLayerIndex+1, false);
    }
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('duplicateCurrentLayer', [], true));
    return layer;
  },

  renameLayer : function(uid, name) {
    this.layerManager.getLayerByUID(uid).name = name;
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('renameLayer', [uid, name], true));
  },

  hideLayer : function(uid) {
    this.layerManager.getLayerByUID(uid).set('display', false);
    this.layerWidget.requestRedraw();
    this.requestRedraw();
    this.addHistoryState(new HistoryState('hideLayer', [uid], true));
  },

  showLayer : function(uid) {
    this.layerManager.getLayerByUID(uid).set('display', true);
    this.layerWidget.requestRedraw();
    this.requestRedraw();
    this.addHistoryState(new HistoryState('showLayer', [uid], true));
  },

  toggleLayer : function(uid) {
    if (this.layerManager.getLayerByUID(uid).display)
      this.hideLayer(uid);
    else
      this.showLayer(uid);
  },

  moveLayer : function(srcUID, dstUID) {
    var src = this.layerManager.getLayerByUID(srcUID);
    var dst = this.layerManager.getLayerByUID(dstUID);
    var srcIdx = this.layers.indexOf(src);
    var dstIdx = this.layers.indexOf(dst);
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
    this.addHistoryState(new HistoryState('moveLayer', [srcUID, dstUID], true));
    this.requestRedraw();

    this.layerWidget.requestRedraw();
  },

  deleteLayer : function(i, addHistory) {
    if (i < this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex-1, false);
    }
    if (i == this.layers.length-1 && i == this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex-1, false);
    }
    var layer = this.layers.splice(i,1)[0];
    layer.destroy();
    this.layerManager.deleteLayer(layer);
    if (i == this.currentLayerIndex) {
      this.setCurrentLayer(this.currentLayerIndex, false);
    }
    if (addHistory != false)
      this.addHistoryState(new HistoryState('deleteLayer', [i], true));
    this.requestRedraw();

    this.layerWidget.requestRedraw();
  },

  deleteLayerByUID : function(uid, recordHistory) {
    var idx = this.layers.indexOf(this.layerManager.getLayerByUID(uid));
    this.deleteLayer(idx, recordHistory);
  },

  deleteCurrentLayer : function(addHistory) {
    this.deleteLayer(this.currentLayerIndex, addHistory);
  },

  setCurrentLayer : function(i, recordHistory) {
    i = Math.clamp(i, 0, this.layers.length-1);
    this.currentLayer = this.layers[i];
    this.currentLayerIndex = i;
    if (recordHistory != false) {
      // collapse multiple setCurrentLayer calls into a single history event
      var last = this.history.last();
      if (last && last.methodName == 'setCurrentLayer')
        last.args[0] = i;
      else
        this.addHistoryState(new HistoryState('setCurrentLayer', [i], true));
    }
    this.requestRedraw();

    this.layerWidget.requestRedraw();
  },

  setCurrentLayerByUID : function(uid, recordHistory) {
    var idx = this.layers.indexOf(this.layerManager.getLayerByUID(uid));
    this.setCurrentLayer(idx, recordHistory);
  },

  clear : function() {
    this.currentLayer.clear();
    this.addHistoryState(new HistoryState('clear',  [], true));
    this.requestRedraw();
  },

  flipX : function() {
    this.flippedX = !this.flippedX;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipX',  []));
  },

  flipY : function() {
    this.flippedY = !this.flippedY;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipY',  []));
  },

  resetFlip : function() {
    this.flippedX = this.flippedY = false;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('resetFlip',  []));
  },


  // Brush strokes

  beginStroke : function() {
    if (this.strokeInProgress || this.currentLayer.notDrawable) return;
    this.strokeInProgress = true;
    this.strokeLayer.clear();
    this.strokeLayer.show();
    this.addHistoryState(new HistoryState('beginStroke',  [], true));
    this.requestRedraw();
  },

  endStroke : function(erasing) {
    if (erasing == null) erasing = this.erasing;
    if (!this.strokeInProgress) return;
    this.strokeInProgress = false;
    var composite = (erasing ? 'destination-out' :
      (this.currentLayer.opacityLocked ? 'source-atop' : 'source-over')
    );
    this.strokeLayer.applyTo(this.currentLayer, composite);
    this.strokeLayer.hide();
    this.addHistoryState(new HistoryState('endStroke',  [erasing]));
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
      this.strokeLayer, this.colorStyle, 'source-over',
      xy.x, xy.y, xy.r,
      xy.brushTransform
    );
    this.addHistoryState(new HistoryState('drawPoint', [xy]));
    this.requestRedraw();
  },

  drawLine : function(a, b) {
    if (!this.strokeInProgress) return;
    if (!a.absolute)
      a = this.getAbsolutePoint(a);
    if (!b.absolute)
      b = this.getAbsolutePoint(b);
    this.brush.drawLine(
      this.strokeLayer, this.colorStyle, 'source-over',
      a.x, a.y, a.r,
      b.x, b.y, b.r,
      a.brushTransform
    );
    this.addHistoryState(new HistoryState('drawLine', [a, b]));
    this.requestRedraw();
  },


  // Brush state

  addRoundBrush : function() {
    this.brushes.push(new RoundBrush);
    this.addHistoryState(new HistoryState('addRoundBrush',  [], true));
  },

  addPolygonBrush : function(path) {
    this.brushes.push(new PolygonBrush(path));
    this.addHistoryState(new HistoryState('addPolygonBrush',  [path], true));
  },

  addImageBrush : function(src) {
    var img = new Image();
    img.src = src;
    this.brushes.push(new ImageBrush(img));
    this.addHistoryState(new HistoryState('addImageBrush',  [src], true));
  },

  setBrush : function(idx) {
    this.brushIndex = idx;
    this.brush = this.brushes[idx];
    this.cursor.setBrush(this.brush, [1,0,0,1], this.colorStyle, this.opacity);
    this.addHistoryState(new HistoryState('setBrush',  [idx]));
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
    this.addHistoryState(new HistoryState('deleteBrush',  [idx]));
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
      this.addHistoryState(new HistoryState('setColor', [this.color]));
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
      this.addHistoryState(new HistoryState('setOpacity', [this.opacity]));
  },

  setLineWidth : function(w) {
    this.lineWidth = w;
    this.cursor.update(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
    // collapse multiple setLineWidth calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setLineWidth')
      last.args[0] = this.lineWidth;
    else
      this.addHistoryState(new HistoryState('setLineWidth', [this.lineWidth]));
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
    this.addHistoryState(new HistoryState('setPaletteColor', [idx, c], true));
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
    this.addHistoryState(new HistoryState('addConstraint', [c]));
  },

  removeConstraint : function(c) {
    var idx = this.constraints.indexOf(c);
    if (idx >= 0)
      this.removeConstraintAt(idx);
  },

  removeConstraintAt : function(idx) {
    this.constraints.splice(idx,1);
    this.addHistoryState(new HistoryState('removeConstraintAt', [idx]));
  },

  applyConstraints : function(p) {
    for (var i=0; i<this.constraints.length; i++) {
      this.constraints[i].applyTo(p);
    }
    return p;
  }


});
