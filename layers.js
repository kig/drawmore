Layer = Klass({
  display : true,
  opacity : 1,
  zIndex : 0,

  initialize : function(){},

  copy : function() {
    var l = Object.extend({}, this);
    this.copyProperties(l);
    return l;
  },

  copyProperties : function(tgt) {
  },

  flip : function() {},

  applyTo : function(ctx, w, h){
    if (this.display) {
      ctx.save();
        ctx.globalAlpha = this.opacity;
        this.compositeTo(ctx, w, h);
      ctx.restore();
    }
  },

  show : function(){
    this.display = true;
  },

  hide : function(){
    this.display = false;
  },

  clear : function(){}
});


CanvasLayer = Klass(Layer, {
  initialize : function(){
    this.canvas = E.canvas(window.innerWidth,window.innerHeight);
    this.ctx = this.canvas.getContext('2d');
  },

  copyProperties : function(tgt) {
    tgt.canvas = E.canvas(this.canvas.width, this.canvas.height);
    tgt.ctx = tgt.canvas.getContext('2d');
    tgt.ctx.globalCompositeOperation = 'copy';
    tgt.ctx.drawImage(this.canvas, 0, 0);
    tgt.ctx.globalCompositeOperation = 'source-over';
  },

  compositeTo : function(ctx, w, h) {
    ctx.drawImage(this.canvas, 0, 0);
  },

  flip : function() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'copy';
    this.ctx.translate(this.canvas.width,0);
    this.ctx.scale(-1,1);
    this.ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.restore();
  },

  clear : function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
  }
});


ColorLayer = Klass(Layer, {
  initialize : function(color){
    this.color = (color != null ? color : [0,0,0,1]);
  },

  copyProperties : function(tgt) {
    tgt.color = this.color.slice(0);
  },

  compositeTo : function(ctx, w, h) {
    ctx.fillStyle = ColorUtils.colorToStyle(this.color);
    ctx.fillRect(0,0,w,h);
  }
});
