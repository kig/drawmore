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
  defaultBackground : ColorUtils.colorVec(1,1,1,1),
  brushIndex : 0,

  minimumBrushSize : 0.75,
  maximumBrushSize : 1000,

  strokeInProgress : false,

  width: 1,
  height: 1,

  lastUpdateTime : 0,
  lastFrameDuration : 0,
  frameCount : 0,

  inputTime : -1,
  lastInputTime : -1,
  inputCount : 0,

  compositingTime : 0,

  disableColorPick : true,
  flippedX : false,
  flippedY : false,

  showHistograms: true,
  showDrawAreas: false,

  initialize : function(canvas, config) {
    this.canvas = canvas;
    this.statsCanvas = E.canvas(140, 140);
    this.statsCtx = this.statsCanvas.getContext('2d');
    this.canvas.parentNode.appendChild(this.statsCanvas);
    this.statsCanvas.style.position = 'absolute';
    this.statsCanvas.style.pointerEvents = 'none';
    this.statsCanvas.style.left = this.statsCanvas.style.top = '0px';
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

  drawMainCanvas : function(x,y,w,h, noOptimize) {
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
    if (this.zoom > 1 && !noOptimize) {
      this.applyTo(this.tempCtx, Math.floor(x/this.zoom), Math.floor(y/this.zoom), Math.ceil(w/this.zoom), Math.ceil(h/this.zoom), this.flippedX, this.flippedY, 1);
      this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(this.tempCanvas,
          0, 0, Math.round(w/this.zoom), Math.round(h/this.zoom),
          0, 0, w, h
        );
      this.ctx.restore();
    } else {
      this.applyTo(this.ctx, x, y, w, h, this.flippedX, this.flippedY, this.zoom);
    }
  },
  
  updateChangedBox : function(bbox) {
    if (this.changedBox == null) {
      this.changedBox = bbox;
    } else {
      Layer.bboxMerge(bbox, this.changedBox);
    }
  },
    
  updateDisplay : function() {
    this.executeTimeJump();
    var t0 = new Date().getTime();
    this.ctx.save();
    if (!this.needFullRedraw && this.changedBox && !this.flippedX && !this.flippedY) {
      if (this.changedBox.left <= this.changedBox.right && this.changedBox.top <= this.changedBox.bottom) {
        // Draw only the changedBox area.
        var x = this.changedBox.left*this.zoom+this.panX;
        var y = this.changedBox.top*this.zoom+this.panY;
        var w = this.changedBox.width*this.zoom;
        var h = this.changedBox.height*this.zoom;
        this.ctx.translate(x,y);
        if (this.showDrawAreas || Magi.console.IWantSpam) {
          this.ctx.strokeStyle = 'red';
          this.ctx.strokeRect(0,0,w,h);
        }
        this.ctx.beginPath();
        this.ctx.rect(0,0,w,h);
        this.ctx.clip();
        this.drawMainCanvas(x-this.panX, y-this.panY, this.changedBox.width*this.zoom, this.changedBox.height*this.zoom);
      }
    } else {
      this.drawMainCanvas(-this.panX, -this.panY, this.width, this.height);
      this.needFullRedraw = false;
    }
    this.changedBox = null;
    this.ctx.restore();
    this.layerWidget.redraw();
    this.colorPicker.redraw();
    var t1 = new Date().getTime();
    var elapsed = t1-t0;
    this.redrawRequested = false;
    this.frameTimes[this.frameCount%this.frameTimes.length] = elapsed;
    if (this.showHistograms) {
      //this.ctx.getImageData(0,0,1,1); // force draw completion
      this.statsCtx.clearRect(0,0, this.statsCanvas.width, this.statsCanvas.height);
      this.drawFrameTimeHistogram(this.statsCtx, 12, 38);
      this.statsCtx.save();
        this.statsCtx.font = '9px sans-serif';
        var fpsText = 'frame interval ' + (t1-(this.lastUpdateTime||t1)) + ' ms';
        this.statsCtx.fillStyle = 'black';
        this.statsCtx.fillText(fpsText, 12, 98+9);
      this.statsCtx.restore();
    }
    if (this.inputTime >= this.lastUpdateTime) {
      var inputLag = t1 - this.inputTime;
      this.inputTimes[this.inputCount%this.inputTimes.length] = inputLag;
      if (this.showHistograms)
        this.drawInputTimeHistogram(this.statsCtx, 12, 68);
      this.inputCount++;
    }
    this.lastFrameDuration = elapsed;
    this.lastUpdateTime = t1;
    this.frameCount++;
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

  resize : function(w,h) {
    if (w != this.width || h != this.height) {
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.tempCanvas = E.canvas(w,h);
      this.tempCtx = this.tempCanvas.getContext('2d');
      this.tempLayerStack = [
        new CanvasLayer(w,h),
        new CanvasLayer(w,h),
        new CanvasLayer(w,h)
      ];
      this.requestRedraw();
    }
  },

  applyTo : function(ctx, x, y, w, h, flippedX, flippedY, zoom) {
    this.executeTimeJump();
    var px = -x;
    var py = -y;
    ctx.save();
      ctx.beginPath();
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
      for (var i=0; i<this.tempLayerStack.length; i++)
      {
        var tl = this.tempLayerStack[i];
        tl.upsize(w,h);
        tl.x = x;
        tl.y = y;
        tl.compensateZoom = zoom;
      }
      if (this.strokeLayer.display && this.currentLayer != null) {
        this.currentLayer.prependChild(this.strokeLayer);
        var composite = (this.erasing ? 'destination-out' :
          (this.currentLayer.opacityLocked ? 'source-atop' : 'source-over')
        );
        this.strokeLayer.globalCompositeOperation = composite;
      }

      TiledLayer.printAllocStats('out-frame');
      TiledLayer.resetAllocStats();
      Layer.printStats('out-frame');
      Layer.resetStats();
      this.topLayer.applyTo(ctx, null, this.tempLayerStack, true);
      TiledLayer.printAllocStats('in-frame');
      Layer.printStats('in-frame');
      Magi.console.spam('--------------------------------------------------------------------');

      if (this.strokeLayer.hasParentNode()) {
        var p = this.strokeLayer.getParentNode();
        if (!p)
          Magi.console.log('Warning: strokeLayer.getParentNode returned null', this.strokeLayer.parentNodeUID, p, this.strokeLayer);
        else
          p.removeChild(this.strokeLayer);
      }
    ctx.restore();
  },

  setBackground : function(color) {
    this.executeTimeJump();
    this.needFullRedraw = true;
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
    this.executeTimeJump();
    this.needFullRedraw = true;
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
    if (window.mozRequestAnimationFrame) {
      window.mozRequestAnimationFrame(update);
    //} else if (window.webkitRequestAnimationFrame) {
    // window.webkitRequestAnimationFrame(update);
    } else {
      setTimeout(update, 1);
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
    var bbox = this.topLayer.getBoundingBox();
    var top = Math.floor(bbox.top);
    var left = Math.floor(bbox.left);
    var bottom = Math.ceil(bbox.bottom);
    var right = Math.ceil(bbox.right);
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
    this.executeTimeJump();
    this.clearHistory();
    this.setupDefaultState();
  },

  setupEmptyState : function() {
    this.needFullRedraw = true;
    this.actionQueue = [];
    this.layerManager = new LayerManager();
    this.currentLayer = null;
    this.layerUID = -2;
    this.topLayer = new Layer();
    this.topLayer.name = 'TOP';
    this.topLayer.uid = this.layerUID++;
    this.layerManager.addLayer(this.topLayer);
    this.strokeLayer = this.createLayerObject();
    this.layerWidget.requestRedraw();
    this.palette = [];
    this.constraints = [];
    this.brushes = [];
    this.resize(this.canvas.width, this.canvas.height);
  },

  setupDefaultState : function() {
    this.setupEmptyState();
    this.addRoundBrush();
    var s2 = 1/Math.sqrt(2);
    var a = 0;
    this.addPolygonBrush([
      {x: Math.cos(a+Math.PI-0.05), y: Math.sin(a+Math.PI-0.05)},
      {x: Math.cos(a+Math.PI+0.05), y: Math.sin(a+Math.PI+0.05)},
      {x: Math.cos(a-0.05), y: Math.sin(a-0.05)},
      {x: Math.cos(a+0.05), y: Math.sin(a+0.05)}
    ]);
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
    var a = Math.PI/2;
    this.addPolygonBrush([
      {x: Math.cos(a+Math.PI-0.05), y: Math.sin(a+Math.PI-0.05)},
      {x: Math.cos(a+Math.PI+0.05), y: Math.sin(a+Math.PI+0.05)},
      {x: Math.cos(a-0.05), y: Math.sin(a-0.05)},
      {x: Math.cos(a+0.05), y: Math.sin(a+0.05)}
    ]);
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


  // Undo history management

  requestUndo : function(singleStep) {
    this.runActions();
    this.delayedUndo(singleStep);
    this.requestRedraw();
  },

  requestRedo : function(singleStep) {
    this.runActions();
    this.delayedRedo(singleStep);
    this.requestRedraw();
  },

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
      layers : this.layerManager.copyLayers(),
      currentLayerUID : this.currentLayer && this.currentLayer.uid,
      topLayerUID : this.topLayer.uid,
      strokeLayerUID : this.strokeLayer.uid
    };
  },

  applyState : function(state) {
    this.constraints = state.constraints;
    this.strokeInProgress = state.strokeInProgress;
    this.pickRadius = state.pickRadius;
    this.brushes = state.brushes.map(function(l){ return l.copy(); });
    this.setBrush(state.brushIndex);
    this.layerUID = state.layerUID;
    this.layerManager.rebuildCopy(state.layers);
    this.topLayer = this.layerManager.getLayerByUID(state.topLayerUID);
    this.strokeLayer = this.layerManager.getLayerByUID(state.strokeLayerUID);
    this.currentLayer = this.layerManager.getLayerByUID(state.currentLayerUID);
    this.layerWidget.requestRedraw();
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
    Magi.console.spam('created a snapshot');
    return {
      state: this.getState()
    };
  },

  applySnapshot : function(snapshot) {
    Magi.console.spam('applied a snapshot');
    this.applyState(snapshot.state);
    this.needFullRedraw = true;
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
    this.canvas.addEventListener('click', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.addEventListener('dblclick', function(ev) {
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
    this.canvas.removeEventListener('click', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.removeEventListener('dblclick', function(ev) {
      ev.preventDefault();
    }, false);
  },
  
  pushAction : function(methodName, args) {
    var hs = new HistoryState(methodName, args, false);
    this.actionQueue.push(hs);
    this.requestRedraw();
  },
  
  runActions : function() {
    if (this.inRunActions) return;
    this.inRunActions = true;
    for (var i=0; i<this.actionQueue.length; i++) {
      var a = this.actionQueue[i];
      this[a.methodName].apply(this, a.args);
    }
    this.actionQueue.splice(0);
    this.inRunActions = false;
  },
  
  executeTimeJump : function() {
    if (this.inTimeJump) return;
    this.inTimeJump = true;
    Undoable.executeTimeJump.apply(this, arguments);
    this.runActions();
    this.inTimeJump = false;
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
      draw.absoluteCurrent = draw.getAbsolutePoint(draw.current);
      if (Mouse.state[Mouse.LEFT] && draw.mousedown) {
        if (draw.prev != null) {
          if (!ev.shiftKey && draw.constraint != null) {
            draw.removeTemporaryConstraint(draw.constraint);
            draw.constraint = null;
          }
          if (ev.shiftKey && draw.constraint == null) {
            var dx = draw.absoluteCurrent.x - draw.absolutePrev.x;
            var dy = draw.absoluteCurrent.y - draw.absolutePrev.y;
            if (Math.abs(dx) > Math.abs(dy))
              draw.constraint = new Constraints.ConstantY(draw.absolutePrev.y);
            else
              draw.constraint = new Constraints.ConstantX(draw.absolutePrev.x);
            draw.addTemporaryConstraint(draw.constraint);
          }
          draw.applyConstraints(draw.absoluteCurrent);
          draw.pushAction('drawLine', [draw.absolutePrev, draw.absoluteCurrent]);
        }
        draw.prev = draw.current;
        draw.absolutePrev = draw.absoluteCurrent;
        ev.preventDefault();
      }
    };

    this.listeners['mousedown'] = function(ev) {
      draw.updateInputTime();
      draw.stopResizingBrush();
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.absoluteCurrent = draw.getAbsolutePoint(draw.current);
      draw.cursor.moveTo(draw.current.x, draw.current.y);
      if (Mouse.state[Mouse.LEFT] && ev.target == draw.canvas) {
        draw.mousedown = true;
        if (ev.altKey)
          draw.erasing = true;
        draw.pushAction('beginStroke', []);
        if (ev.shiftKey && draw.mouseup) {
          if (draw.constraint != null) {
            draw.removeTemporaryConstraint(draw.constraint);
            draw.constraint = null;
          }
          draw.pushAction('drawLine', [draw.absoluteMouseup, draw.absoluteCurrent]);
          draw.prev = null;
        } else {
          draw.pushAction('drawPoint', [draw.absoluteCurrent]);
          draw.prev = draw.current;
          draw.absolutePrev = draw.absoluteCurrent;
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
      draw.absoluteMouseup = draw.getAbsolutePoint(draw.mouseup);
      if (!Mouse.state[Mouse.LEFT]) {
        draw.prev = null;
        draw.absolutePrev = null;
      }
      if (ev.button == Mouse.MIDDLE) {
        draw.stopPanning();
        draw.stopMoving();
      }
      draw.pushAction('endStroke', [draw.erasing]);
      draw.erasing = false;
    };
    
    this.listeners['keydown'] = function(ev) {
      draw.updateInputTime();
      if (Key.match(ev, [Key.ALT]))
        ev.preventDefault();
      if (ev.altKey) {
        if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.requestRedo(true);
          else
            draw.requestUndo(true);
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
            draw.requestRedo();
          else
            draw.requestUndo();

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
      if (Key.match(ev, [Key.ALT]))
        ev.preventDefault();
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
          if (ev.shiftKey)
            draw.unindentCurrentLayer();
          else
            draw.indentCurrentLayer();

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
    this.needFullRedraw = true;
    this.requestRedraw();
  },


  // Zooming

  zoomIn : function() {
    var z = this.zoom;
    this.setZoom(this.zoom * 2);
    this.setLineWidth(this.lineWidth * (this.zoom/z));
  },

  zoomOut : function() {
    var z = this.zoom;
    this.setZoom(this.zoom / 2);
    this.setLineWidth(this.lineWidth * (this.zoom/z));
  },

  setZoom : function(z) {
    if (z < (1/16) || z > 64) return;
    this.needFullRedraw = true;
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

  indentLayer : function(srcUID, groupUID) {
    var layer = this.layerManager.getLayerByUID(srcUID);
    var group = this.layerManager.getLayerByUID(groupUID);
    group.appendChild(layer);
    var isTop = (layer.parentNodeUID == this.topLayer.uid);
    layer.globalCompositeOperation = isTop ? 'source-over' : 'source-atop';
  },

  unindentLayer : function(uid) {
    var layer = this.layerManager.getLayerByUID(uid);
    var parent = layer.getParentNode();
    var grandParent = parent.getParentNode();
    grandParent.insertChildAfter(layer, parent);
    var isTop = (layer.parentNodeUID == this.topLayer.uid);
    layer.globalCompositeOperation = isTop ? 'source-over' : 'source-atop';
  },

  indentCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var prev = this.currentLayer.getPreviousNode();
    if (prev && prev.uid != this.currentLayer.parentNodeUID) {
      var uid = this.currentLayer.uid;
      if (prev.parentNodeUID != this.currentLayer.parentNodeUID)
        prev = prev.getParentNode();
      this.indentLayer(uid, prev.uid);
      this.addHistoryState(new HistoryState('indentCurrentLayer', [], true));
      this.layerWidget.requestRedraw();
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.requestRedraw();
    }
  },

  unindentCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    if (this.currentLayer.parentNodeUID != this.topLayer.uid) {
      var uid = this.currentLayer.uid;
      var parent = this.currentLayer.getParentNode();
      var cc = parent.childNodes;
      var nextLayers = cc.slice(cc.indexOf(uid)+1);
      for (var i=nextLayers.length-1; i>=0; i--) {
        this.currentLayer.prependChild(this.layerManager.getLayerByUID(nextLayers[i]));
      }
      this.unindentLayer(uid);
      this.addHistoryState(new HistoryState('unindentCurrentLayer', [], true));
      this.layerWidget.requestRedraw();
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.requestRedraw();
    }
  },

  layerAbove : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var p = this.currentLayer.getNextNode();
    if (p) this.setCurrentLayer(p.uid);
  },

  layerBelow : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var p = this.currentLayer.getPreviousNode();
    if (p) this.setCurrentLayer(p.uid);
  },

  toggleCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.toggleLayer(this.currentLayer.uid);
  },

  toggleCurrentLayerOpacityLocked : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.toggleLayerOpacityLocked(this.currentLayer.uid);
  },

  toggleLayerOpacityLocked : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.opacityLocked = !layer.opacityLocked;
    this.addHistoryState(new HistoryState('toggleLayerOpacityLocked', [uid], true));
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  toggleLayerLinkPosition : function(uid) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
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
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.currentLayer.flipX();
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerHorizontally', [], true));
  },

  flipCurrentLayerVertically : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.currentLayer.flipY();
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerVertically', [], true));
  },

  moveCurrentLayer : function(dx, dy) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.currentLayer.modify('x', dx);
    this.currentLayer.modify('y', dy);
    var self = this;
    var cc = this.currentLayer.childNodes;
    for (var i=0; i<cc.length; i++) {
      var cn = cc[i];
      var l = self.layerManager.getLayerByUID(cn);
      if (!l.isPropertyLinkedWith('x', this.currentLayer)) {
        l.x += dx;
        l.y += dy;
      }
    }
    this.needFullRedraw = true;
    this.requestRedraw();
    var l = this.history.last();
    if (l.methodName == 'moveCurrentLayer') {
      this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], false));
    } else {
      this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], true));
    }
  },

  mergeDown : function(addHistory) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var below = this.currentLayer.getPreviousNode();
    if (below && below.uid != this.topLayer.uid) {
      var target = this.createLayerObject();
      // target becomes below
      below.compositeTo(target, below.opacity, 'source-over');
      this.currentLayer.applyTo(target,
        this.currentLayer.parentNodeUID == below.parentNodeUID
        ? 'source-over'
        : 'source-atop'
      );
      below.tiles = target.tiles;
      below.x = 0;
      below.y = 0;
      below.opacity = 1;
      this.deleteCurrentLayer(false);
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.addHistoryState(new HistoryState('mergeDown', [], true));
    }
  },

  mergeVisible : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var target = this.createLayerObject();
    this.topLayer.applyTo(target);
    for (var i=0; i<this.topLayer.childNodes.length; i++) {
      var l = this.layerManager.getLayerByUID(this.topLayer.childNodes[i]);
      while (i<this.topLayer.childNodes.length && l.display) {
        this.deleteLayer(this.topLayer.childNodes[i], false);
        l = this.layerManager.getLayerByUID(this.topLayer.childNodes[i]);
      }
    }
    this.addLayerBeforeCurrent(target);
    this.setCurrentLayer(target.uid, false);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('mergeVisible', [], true));
  },

  mergeAll : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var target = this.createLayerObject();
    this.topLayer.applyTo(target);
    while (this.topLayer.childNodes.length > 0)
      this.deleteLayer(this.topLayer.childNodes[0], false);
    this.addLayerBeforeCurrent(target);
    this.setCurrentLayer(target.uid, false);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('mergeAll', [], true));
  },

  setCurrentLayerOpacity : function(opacity) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setLayerOpacity(this.currentLayer.uid, opacity);
    this.layerWidget.requestRedraw();
  },

  currentLayerOpacityUp : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity * 1.1, 1/255, 1));
  },

  currentLayerOpacityDown : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity / 1.1, 0, 1));
  },

  setLayerOpacity : function(uid, opacity) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    if (layer) {
      layer.set('opacity', opacity);
      this.updateChangedBox(layer.getBoundingBox());
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
    return layer;
  },

  newLayerFromImage : function(img, x, y, name) {
    this.executeTimeJump();
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
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayerFromImage',  [img,x,y,name], true));
    return layer;
  },

  newLayer : function() {
    this.executeTimeJump();
    var layer = this.createLayerObject();
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayer', [], true));
    return layer;
  },

  newLayerBelow : function() {
    this.executeTimeJump();
    var layer = this.createLayerObject();
    this.addLayerBeforeCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayerBelow', [], true));
    return layer;
  },

  addLayerAfterCurrent : function(layer) {
    if (!this.currentLayer) {
      this.topLayer.appendChild(layer);
      this.setCurrentLayer(layer.uid, false);
    } else {
      if (this.currentLayer.childNodes.length > 0) {
        this.indentLayer(layer.uid, this.currentLayer.uid);
      } else {
        this.currentLayer.getParentNode().insertChildAfter(layer, this.currentLayer);
        if (this.currentLayer.parentNodeUID != this.topLayer.uid)
          layer.globalCompositeOperation = 'source-atop'; // layer group
      }
      this.setCurrentLayer(layer.uid, false);
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  addLayerBeforeCurrent : function(layer) {
    if (!this.currentLayer) {
      this.topLayer.prependChild(layer);
      this.setCurrentLayer(layer.uid, false);
    } else {
      this.currentLayer.getParentNode().insertChildBefore(layer, this.currentLayer);
      if (this.currentLayer.parentNodeUID != this.topLayer.uid) {
        layer.globalCompositeOperation = 'source-atop'; // layer group
      }
      this.setCurrentLayer(layer.uid, false);
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  duplicateCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var layer = this.currentLayer.copy(false);
    layer.uid = this.layerUID++;
    this.layerManager.addLayer(layer);
    var m = layer.name.match(/ \(copy( \d+)?\)$/);
    if (m) {
      m[1] = m[1] || 0;
      var cidx = parseInt(m[1])+1;
      layer.name = layer.name.replace(/copy( \d+)?\)$/, 'copy '+cidx+')');
    } else {
      layer.name += " (copy)";
    }
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('duplicateCurrentLayer', [], true));
    return layer;
  },

  renameLayer : function(uid, name) {
    this.executeTimeJump();
    this.layerManager.getLayerByUID(uid).name = name;
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('renameLayer', [uid, name], true));
  },

  hideLayer : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.set('display', false);
    this.layerWidget.requestRedraw();
    this.updateChangedBox(layer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('hideLayer', [uid], true));
  },

  showLayer : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.set('display', true);
    this.layerWidget.requestRedraw();
    this.updateChangedBox(layer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('showLayer', [uid], true));
  },

  toggleLayer : function(uid) {
    this.executeTimeJump();
    if (this.layerManager.getLayerByUID(uid).display)
      this.hideLayer(uid);
    else
      this.showLayer(uid);
  },

  layerIndexDFS : function(layer, uid) {
    if (uid == layer.uid) {
      return [0, true];
    } else {
      var idx = 1;
      for (var i=0; i<layer.childNodes.length; i++) {
        var found = this.layerIndexDFS(this.layerManager.getLayerByUID(layer.childNodes[i]), uid);
        idx += found[0];
        if (found[1])
          return [idx, true];
      }
      return [idx, false];
    }
  },

  getLayerIndex : function(layer) {
    var found = this.layerIndexDFS(this.topLayer, layer.uid)
    if (found[1])
      return found[0];
    else
      return -1;
  },

  moveLayer : function(srcUID, dstUID) {
    this.executeTimeJump();
    if (srcUID == dstUID || srcUID == null || dstUID == null) return;
    var src = this.layerManager.getLayerByUID(srcUID);
    var dst = this.layerManager.getLayerByUID(dstUID);
    if (this.getLayerIndex(src) < this.getLayerIndex(dst)) {
      if (dst.childNodes.length > 0) dst.prependChild(src);
      else dst.getParentNode().insertChildAfter(src, dst);
    } else {
      dst.getParentNode().insertChildBefore(src, dst);
    }
    this.updateChangedBox(src.getBoundingBox());
    this.updateChangedBox(dst.getBoundingBox());
    this.addHistoryState(new HistoryState('moveLayer', [srcUID, dstUID], true));
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  deleteLayer : function(uid, recordHistory) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    if (layer == null) throw ("deleteLayer: no layer with UID "+uid);
    if (layer == this.currentLayer) {
      var prev = layer.getPreviousNode();
      if (prev && prev.uid != this.topLayer.uid) {
        this.setCurrentLayer(prev.uid, false);
      } else {
        var next = layer.getNextNode();
        if (next && next.uid != this.topLayer.uid) {
          this.setCurrentLayer(next.uid, false);
        } else {
          this.setCurrentLayer(null, false);
        }
      }
    }
    this.updateChangedBox(layer.getBoundingBox());
    layer.destroy();

    if (recordHistory != false)
      this.addHistoryState(new HistoryState('deleteLayer', [uid], true));
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  deleteCurrentLayer : function(addHistory) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.deleteLayer(this.currentLayer.uid, addHistory);
  },

  setCurrentLayer : function(uid, recordHistory) {
    this.executeTimeJump();
    if (uid == null) {
      this.currentLayer = null;
    } else if (uid == this.topLayer.uid) {
      return;
    } else {
      var layer = this.layerManager.getLayerByUID(uid);
      if (layer == null) throw ("setCurrentLayer: no layer with UID "+uid);
      this.currentLayer = layer;
    }
    if (recordHistory != false) {
      // collapse multiple setCurrentLayer calls into a single history event
      var last = this.history.last();
      if (last && last.methodName == 'setCurrentLayer')
        last.args[0] = uid;
      else
        this.addHistoryState(new HistoryState('setCurrentLayer', [uid], true));
    }
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  clear : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.currentLayer.clear();
    this.addHistoryState(new HistoryState('clear',  [], true));
    this.requestRedraw();
  },


  // Flipping

  flipX : function() {
    this.executeTimeJump();
    this.flippedX = !this.flippedX;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipX',  []));
  },

  flipY : function() {
    this.executeTimeJump();
    this.flippedY = !this.flippedY;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipY',  []));
  },

  resetFlip : function() {
    this.executeTimeJump();
    this.flippedX = this.flippedY = false;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('resetFlip',  []));
  },


  // Brush strokes

  beginStroke : function() {
    this.executeTimeJump();
    if (this.strokeInProgress || !this.currentLayer || this.currentLayer.notDrawable) return;
    this.strokeInProgress = true;
    this.strokeLayer.clear();
    this.strokeLayer.show();
    this.addHistoryState(new HistoryState('beginStroke',  [], true));
    this.requestRedraw();
  },

  endStroke : function(erasing) {
    this.executeTimeJump();
    if (!this.strokeInProgress) return;
    this.strokeInProgress = false;
    var composite = (erasing ? 'destination-out' :
      (this.currentLayer.opacityLocked ? 'source-atop' : 'source-over')
    );
    this.strokeLayer.applyTo(this.currentLayer, composite);
    this.strokeLayer.hide();
    this.updateChangedBox(this.strokeLayer.getBoundingBox());
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
    this.executeTimeJump();
    if (!this.strokeInProgress) return;
    if (!xy.absolute)
      xy = this.getAbsolutePoint(xy);
    this.brush.drawPoint(
      this.strokeLayer, this.colorStyle, 'source-over',
      xy.x, xy.y, xy.r,
      xy.brushTransform
    );
    this.updateChangedBox(this.strokeLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('drawPoint', [xy]));
    this.requestRedraw();
  },

  drawLine : function(a, b) {
    this.executeTimeJump();
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
    this.updateChangedBox(this.strokeLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('drawLine', [a, b]));
    this.requestRedraw();
  },


  // Brush state

  addRoundBrush : function() {
    this.executeTimeJump();
    this.brushes.push(new RoundBrush);
    this.addHistoryState(new HistoryState('addRoundBrush',  [], true));
  },

  addPolygonBrush : function(path) {
    this.executeTimeJump();
    this.brushes.push(new PolygonBrush(path));
    this.addHistoryState(new HistoryState('addPolygonBrush',  [path], true));
  },

  addImageBrush : function(src) {
    this.executeTimeJump();
    var img = new Image();
    img.src = src;
    this.brushes.push(new ImageBrush(img));
    this.addHistoryState(new HistoryState('addImageBrush',  [src], true));
  },

  setBrush : function(idx) {
    this.executeTimeJump();
    this.brushIndex = idx;
    this.brush = this.brushes[idx];
    this.cursor.requestSetBrush(this.brush, [1,0,0,1], this.colorStyle, this.opacity);
    this.addHistoryState(new HistoryState('setBrush',  [idx]));
  },

  nextBrush : function() {
    this.executeTimeJump();
    this.setBrush((this.brushIndex + 1) % this.brushes.length);
  },

  previousBrush : function() {
    this.executeTimeJump();
    if (this.brushIndex == 0)
      this.setBrush(this.brushes.length-1);
    else
      this.setBrush(this.brushIndex - 1);
  },

  deleteBrush : function(idx) {
    this.executeTimeJump();
    if (idx < 0 || idx >= this.brushes.length)
      throw (new Error('Bad brush index'));
    if (idx <= this.brushIndex)
      this.brushIndex--;
    this.setBrush(this.brushIndex);
    this.brushes.splice(idx, 1);
    this.addHistoryState(new HistoryState('deleteBrush',  [idx]));
  },

  setColor : function(color) {
    this.executeTimeJump();
    if (typeof color == 'string')
      this.color = this.styleToColor(color);
    else
      this.color = color;
    var s = this.colorToStyle(this.color);
    this.colorStyle = s;
    if (this.oncolorchange)
      this.oncolorchange(this.color);
    this.cursor.requestUpdate(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
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
    this.executeTimeJump();
    o = Math.clamp(o, 0, 1);
    this.opacity = o;
    this.strokeLayer.opacity = o;
    if (this.onopacitychange)
      this.onopacitychange(o);
    this.cursor.requestUpdate(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
    // collapse multiple setOpacity calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setOpacity')
      last.args[0] = this.opacity;
    else
      this.addHistoryState(new HistoryState('setOpacity', [this.opacity]));
  },

  setLineWidth : function(w) {
    this.executeTimeJump();
    this.lineWidth = w;
    this.cursor.requestUpdate(this.lineWidth, [1,0,0,1], this.colorStyle, this.opacity);
    // collapse multiple setLineWidth calls into a single history event
    var last = this.history.last();
    if (last && last.methodName == 'setLineWidth')
      last.args[0] = this.lineWidth;
    else
      this.addHistoryState(new HistoryState('setLineWidth', [this.lineWidth]));
  },


  // Palette

  setupPalette : function() {
    this.executeTimeJump();
    var cc = byClass('paletteColor');
    for (var i=0; i<cc.length; i++) {
      this.setPaletteColor(i, cc[i].getAttribute('color'));
    }
  },

  setPaletteColor : function(idx, color) {
    this.executeTimeJump();
    var c = color;
    if (typeof color == 'string')
      c = this.styleToColor(color);
    byClass('paletteColor')[idx].style.backgroundColor = this.colorToStyle(c);
    this.palette[idx] = c;
    this.addHistoryState(new HistoryState('setPaletteColor', [idx, c], true));
  },

  nextColor : function() {
    this.executeTimeJump();
    var idx = this.palette.indexOf(this.color);
    if (idx < 0) idx = this.palette.length-1;
    this.setColor(this.palette[(idx+1) % this.palette.length]);
  },

  previousColor : function() {
    this.executeTimeJump();
    var idx = this.palette.indexOf(this.color);
    if (idx < 0) idx = this.palette.length+1;
    this.setColor(this.palette[(idx-1) % this.palette.length]);
  },

  // Picking

  pickColor : function(xy, radius) {
    this.executeTimeJump();
    if (xy) {
      var c = this.colorAt(this.ctx, xy.x, xy.y, radius);
      this.setColor(c);
    }
  },

  pickBackground : function(xy, radius) {
    this.executeTimeJump();
    if (xy) {
      var c = this.colorAt(this.ctx, xy.x, xy.y, radius);
      this.setBackground(c);
    }
  },


  // Constraints

  addTemporaryConstraint : function(c) {
    this.executeTimeJump();
    this.constraints.push(c);
  },

  removeTemporaryConstraint : function(c) {
    this.executeTimeJump();
    this.constraints.deleteFirst(c);
  },

  addConstraint : function(c) {
    this.executeTimeJump();
    this.constraints.push(c);
    this.addHistoryState(new HistoryState('addConstraint', [c]));
  },

  removeConstraint : function(c) {
    this.executeTimeJump();
    var idx = this.constraints.indexOf(c);
    if (idx >= 0)
      this.removeConstraintAt(idx);
  },

  removeConstraintAt : function(idx) {
    this.executeTimeJump();
    this.constraints.splice(idx,1);
    this.addHistoryState(new HistoryState('removeConstraintAt', [idx]));
  },

  applyConstraints : function(p) {
    this.executeTimeJump();
    for (var i=0; i<this.constraints.length; i++) {
      this.constraints[i].applyTo(p);
    }
    return p;
  }


});
