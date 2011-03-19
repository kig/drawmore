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
  }
  
};
