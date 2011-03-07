Drawmore.Modules.ColorPicking = {

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
  }

};
