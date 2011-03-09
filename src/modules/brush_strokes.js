Drawmore.Modules.BrushStrokes = {

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
    np.opacity = 1;
    if (this.pressureControlsSize)
      np.r = Math.max(this.zoom*0.75*0.5, (np.pressure * 1.75 + 0.25)*np.r);
    if (this.pressureControlsOpacity)
      np.opacity *= np.pressure;
    np.brushTransform = this.getBrushTransform();
    np.absolute = true;
    return np;
  },
  
  appendTabletData : function(point, event) {
    if (this.wacomPlugin && this.wacomPlugin.isWacom) {
      point.pressure = this.wacomPlugin.pressure;
      /*
      point.rotation = this.wacomPlugin.rotationRad;
      point.tiltX = this.wacomPlugin.tiltX;
      point.tiltY = this.wacomPlugin.tiltY;
      point.tangentialPressure = this.wacomPlugin.tangentialPressure;
      point.pointerType  = this.wacomPlugin.pointerType;
      */
    } else {
      point.pressure = 1;
    }
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
      this.strokeLayer, this.colorStyle.replace(/1\)$/,xy.opacity+')'), 'source-over',
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
      this.strokeLayer, this.colorStyle.replace(/1\)$/,b.opacity+')'), 'destination-atop',
      a.x, a.y, a.r,
      b.x, b.y, b.r,
      a.brushTransform
    );
    this.updateChangedBox(this.strokeLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('drawLine', [a, b]));
    this.requestRedraw();
  },

  drawQuadratic : function(a, b, c) {
    this.executeTimeJump();
    if (!this.strokeInProgress) return;
    if (!a.absolute)
      a = this.getAbsolutePoint(a);
    if (!b.absolute)
      b = this.getAbsolutePoint(b);
    if (!c.absolute)
      c = this.getAbsolutePoint(c);
    this.brush.drawQuadratic(
      this.strokeLayer, this.colorStyle, 'source-over',
      a.x, a.y, a.r,
      b.x, b.y, b.r,
      c.x, c.y, c.r,
      a.brushTransform
    );
    this.updateChangedBox(this.strokeLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('drawQuadratic', [a, b, c]));
    this.requestRedraw();
  },


  // Brush state
  
  togglePressureControlsOpacity : function() {
    this.pressureControlsOpacity = !this.pressureControlsOpacity;
  },
  
  togglePressureControlsSize : function() {
    this.pressureControlsSize = !this.pressureControlsSize;
  },

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
  }


}
