Selection = Klass({

  selectColor : ColorUtils.colorVec(0,0,0,1),
  deselectColor : ColorUtils.colorVec(0,0,0,0),

  initialize : function() {
    this.mask = new TiledLayer();
  },

  clear : function() {
    this.mask.clear();
  },

  selectPolygon : function(path) {
    this.mask.drawPolygon(path, this.selectColor, 'source-over');
  },

  deselectPolygon : function(path) {
    this.mask.drawPolygon(path, this.deselectColor, 'destination-out');
  },

  selectEllipse : function(x,y,r1,r2) {
    this.mask.drawEllipse(x,y,r1,r2, this.selectColor, 'source-over');
  },

  deselectEllipse : function(x,y,r1,r2) {
    this.mask.drawEllipse(x,y,r1,r2, this.deselectColor, 'destination-out');
  },

  rect : function(x,y,w,h) {
    return [{x:x, y:y}, {x:x, y:y+h}, {x:x+w, y:y+h}, {x:x+w, y:y} ];
  },

  selectRectangle : function(x,y,w,h) {
    this.selectPolygon(this.rect(x,y,w,h));
  },

  deselectRectangle : function(x,y,w,h) {
    this.deselectPolygon(this.rect(x,y,w,h));
 },

  selectCircle : function(x,y,r) {
    this.selectEllipse(x,y,r,r);
  },

  deselectCircle : function(x,y,r) {
    this.deselectEllipse(x,y,r,r);
  }
});
