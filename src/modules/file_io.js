Drawmore.Modules.FileIO = {
  // File IO

  uploadCanvas : function(canvas) {
    canvas.ImgurName = 'drawmore_image.png';
    canvas.ImgurTitle = 'Drawing';
    canvas.ImgurCaption = 'Created with Drawmore.net';
    Imgur.upload(canvas, function(obj, responseText) {
      var input = INPUT({value: obj.upload.links.imgur_page, spellcheck: false});
      var notice = DIV(
        { className : 'uploadNotice' },
        A('Image uploaded to Imgur', {href: obj.upload.links.imgur_page, target: "_new"}),
        input,
        HR(),
        BUTTON("Close", {onclick: function(){this.parentNode.parentNode.removeChild(this.parentNode);}})
      );
      document.body.appendChild(notice);
      input.focus();
      input.select();
    });
  },

  uploadImage : function() {
    this.uploadCanvas(this.getFullImage());
  },

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
      x: left,
      y: top
    };
  },

  getCroppedImage : function(x,y,w,h) {
    var exportCanvas = E.canvas(w,h);
    var ctx = exportCanvas.getContext('2d');
    this.applyTo(ctx, x, y, w, h, 1);
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
  }
}