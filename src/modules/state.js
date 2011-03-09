Drawmore.Modules.State = {


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
    this.rulers = [];
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
    this.setOpacity(1);
    this.clear();
    this.resetView();
    this.setLineWidth(this.defaultLineWidth);
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
    var cs = this.rulers.slice(0);
    cs.deleteFirst(this.ruler);
    return {
      pickRadius : this.pickRadius,
      brushIndex : this.brushIndex,
      brushes : this.brushes.map(function(l){ return l.copy(); }),
      color : this.color,
      background : this.background,
      lineWidth : this.lineWidth,
      opacity : this.opacity,
      palette : this.palette.slice(0),
      rulers: cs,
      layerUID: this.layerUID,
      strokeInProgress : this.strokeInProgress,
      layers : this.layerManager.copyLayers(),
      currentLayerUID : this.currentLayer && this.currentLayer.uid,
      topLayerUID : this.topLayer.uid,
      strokeLayerUID : this.strokeLayer.uid
    };
  },

  applyState : function(state) {
    this.rulers = state.rulers;
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
  }

}
