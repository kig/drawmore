Drawmore.Modules.Selection = {

  deselect : function() {
    this.executeTimeJump();
    this.updateChangedBox(this.selectionLayer.getBoundingBox());
    this.selectionLayer.clear();
    this.requestRedraw();
    this.addHistoryState(new HistoryState('deselect', [], true));
  },

  selectAll : function() {
    this.executeTimeJump();
    this.selectionLayer.fillRect(-this.panX/this.zoom, -this.panY/this.zoom, this.width, this.height, this.colorToStyle(this.selectionColor));
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('selectAll', [], true));
  },

  copySelection : function(recordHistory) {
    this.executeTimeJump();
    this.clipboardLayer.clear();
    this.selectionLayer.compositeTo(this.clipboardLayer, 1, 'source-over');
    this.currentLayer.compositeTo(this.clipboardLayer, 1, 'source-in');
    if (recordHistory != false)
      this.addHistoryState(new HistoryState('copySelection', [], true));
  },

  clearSelection : function(recordHistory) {
    this.executeTimeJump();
    var c = this.currentLayer.globalCompositeOperation;
    this.selectionLayer.compositeTo(this.currentLayer, 1, 'destination-out');
    this.currentLayer.globalCompositeOperation = c;
    this.updateChangedBox(this.selectionLayer.getBoundingBox());
    this.requestRedraw();
    if (recordHistory != false)
      this.addHistoryState(new HistoryState('clearSelection', [], true));
  },

  cutSelection : function() {
    this.copySelection(false);
    this.clearSelection(false);
    this.addHistoryState(new HistoryState('cutSelection', [], true));
  },

  pasteClipboard : function() {
    this.executeTimeJump();
    var layer = this.clipboardLayer.copy(false);
    layer.globalCompositeOperation = 'source-over';
    layer.uid = this.layerUID++;
    this.layerManager.addLayer(layer);
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(layer.getBoundingBox());
    this.addHistoryState(new HistoryState('pasteClipboard', [], true));
  }
};
