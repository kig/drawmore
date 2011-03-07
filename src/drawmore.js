Drawmore = Klass(Undoable, ColorUtils, LayerManagement, UI, {

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

  showHistograms: false,
  showDrawAreas: false,
  
  initialize : function(canvas, config) {
    this.canvas = canvas;
    this.statsCanvas = E.canvas(140, 140);
    this.statsCtx = this.statsCanvas.getContext('2d');
    this.canvas.parentNode.appendChild(this.statsCanvas);
    this.statsCanvas.style.position = 'absolute';
    this.statsCanvas.style.display = 'none';
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
    this.frameIntervals = new glMatrixArrayType(100);
    for (var i=0; i<this.frameIntervals.length; i++) this.frameIntervals[i] = 0;
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
    this.frameIntervals[this.frameCount%this.frameTimes.length] = t1-(this.lastUpdateTime||t1);
    this.statsCanvas.style.display = this.showHistograms ? 'block' : 'none';
    if (this.showHistograms) {
      //this.ctx.getImageData(0,0,1,1); // force draw completion
      this.statsCtx.clearRect(0,0, this.statsCanvas.width, this.statsCanvas.height);
      this.drawFrameTimeHistogram(this.statsCtx, 12, 38);
      this.drawFrameIntervalHistogram(this.statsCtx, 12, 98);
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
      if (ft > 80) {
        ft = 80;
        ctx.fillStyle = 'red';
      }
      ctx.fillRect(x+fx, y+12, 1, ft/4);
      if (ft == 80) ctx.fillStyle = 'black';
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      total += ft;
      if (ft > 80) {
        ft = 80;
        ctx.fillStyle = 'red';
      }
      ctx.fillRect(x+fx, y+12, 1, ft/4);
      if (ft == 80) ctx.fillStyle = 'black';
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(x,y+11,times.length,0.5);
    var fx = times.length-1;
    for (var i=fc; i>=0; i--, fx--) {
      var ft = times[i];
      if (ft > 80) ft = 80;
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      if (ft > 80) ft = 80;
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    ctx.font = '9px sans-serif';
    var fpsText = title + times[fc] + unit;
    ctx.fillStyle = 'black';
    ctx.fillText(fpsText, x+0, y+9);
    ctx.restore();
  },

  drawFrameTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("draw time ", " ms", this.frameTimes, this.frameCount, ctx, x, y);
  },

  drawInputTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("input lag ", " ms", this.inputTimes, this.inputCount, ctx, x, y);
  },

  drawFrameIntervalHistogram : function(ctx, x, y) {
    this.drawHistogram("frame interval ", " ms", this.frameIntervals, this.frameCount, ctx, x, y);
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
    } else if (window.webkitRequestAnimationFrame) {
      window.webkitRequestAnimationFrame(update);
    } else {
      setTimeout(update, 0);
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
