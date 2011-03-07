Drawmore.Modules.Palette = {

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
  }

};
