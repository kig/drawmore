Drawmore.App = Klass(
  Undoable, ColorUtils,
  Drawmore.Modules.Background,
  Drawmore.Modules.BrushStrokes,
  Drawmore.Modules.ColorPicking,
  Drawmore.Modules.DrawLoop,
  Drawmore.Modules.FileIO,
  Drawmore.Modules.Layers,
  Drawmore.Modules.Palette,
  Drawmore.Modules.Rulers,
  Drawmore.Modules.State,
  Drawmore.Modules.UI,
{

  pressureControlsSize : true,
  pressureControlsBlend : true,
  pressureControlsOpacity : false,

  panX : 0,
  panY : 0,
  zoom : 1,

  brushBlendFactor : 1,
  lineWidth : 1,
  opacity : 1,
  color : ColorUtils.colorVec(0,0,0,1),
  colorStyle: 'rgba(0,0,0,1)',
  background : ColorUtils.colorVec(1,1,1,1),
  pickRadius : 1,
  current : null,
  prev : null,

  defaultLineWidth : 0.75,
  defaultColor : ColorUtils.colorVec(0x22/255, 0xC8/255, 0xEE/255,1),
  defaultBackground : ColorUtils.colorVec(1,0.98,0.95,1),
  brushIndex : 0,

  minimumBrushSize : 0.75,
  maximumBrushSize : 1000,

  strokeInProgress : false,

  width: 1,
  height: 1,

  lastUpdateTime : 0,
  lastFrameDuration : 0,
  frameCount : 0,

  inputTime : -1,
  lastInputTime : -1,
  inputCount : 0,

  compositingTime : 0,

  disableColorPick : true,
  flippedX : false,
  flippedY : false,

  showHistograms: false,
  showDrawAreas: false,
  showCompositeDepth: false,

  initialize : function(canvas, config) {
    this.canvas = canvas;
    this.canvas.style.setProperty("image-rendering", "optimizeSpeed", "important");
    if (typeof WebGL2D != 'undefined') {
      WebGL2D.enable(this.canvas);
      this.ctx = canvas.getContext('webgl-2d');
    } else {
      this.ctx = canvas.getContext('2d');
    }
    this.statsCanvas = E.canvas(140, 140);
    this.statsCtx = this.statsCanvas.getContext('2d');
    this.canvas.parentNode.appendChild(this.statsCanvas);
    this.statsCanvas.style.position = 'absolute';
    this.statsCanvas.style.display = 'none';
    this.statsCanvas.style.pointerEvents = 'none';
    this.statsCanvas.style.left = this.statsCanvas.style.top = '0px';
    Object.extend(this, config);
    var c = this.getCSSCursor();
    this.canvas.style.cursor = 'url('+c.toDataURL()+') 1 1,crosshair';
    Undoable.initialize.call(this);
    this.current = {x:0,y:0};
    this.cursor = new BrushCursor();
    this.layerWidget = new LayerWidget(this, document.body);
    this.setupDefaultState();
    this.listeners = {};
    this.createListeners();
    this.addListeners();
    this.updateInputTime();
    this.frameTimes = new glMatrixArrayType(100);
    for (var i=0; i<this.frameTimes.length; i++) this.frameTimes[i] = 0;
    this.inputTimes = new glMatrixArrayType(100);
    for (var i=0; i<this.inputTimes.length; i++) this.inputTimes[i] = 0;
    this.frameIntervals = new glMatrixArrayType(100);
    for (var i=0; i<this.frameIntervals.length; i++) this.frameIntervals[i] = 0;
    var self = this;
    setTimeout(function() {
      // ctrl-R messes with the r key when reloading
      self.disableColorPick = false;
    }, 1000);
  },

  getCSSCursor : function() {
    var cssCursor = E.canvas(3,3);
    var ctx = cssCursor.getContext('2d');
    ctx.beginPath();
    ctx.arc(1,1,1,0,Math.PI*2,false);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'white';
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.fillRect(1,1,1,1);
    return cssCursor;
  },


  // Flipping

  flipX : function() {
    this.executeTimeJump();
    this.flippedX = !this.flippedX;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipX',  []));
  },

  flipY : function() {
    this.executeTimeJump();
    this.flippedY = !this.flippedY;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipY',  []));
  },

  resetFlip : function() {
    this.executeTimeJump();
    this.flippedX = this.flippedY = false;
    this.needFullRedraw = true;
    this.requestRedraw();
    this.addHistoryState(new HistoryState('resetFlip',  []));
  }


});
