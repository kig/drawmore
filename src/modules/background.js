Drawmore.Modules.Background = {

  // Background

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

  setBackgroundImage : function(image) {
    this.executeTimeJump();
    this.needFullRedraw = true;
    this.backgroundImage = image;
    if (this.onbackgroundimagechange)
      this.onbackgroundimagechange(this.backgroundImage);
    this.addHistoryState(new HistoryState('setBackgroundImage', [image]));
    this.requestRedraw();
  }

};
