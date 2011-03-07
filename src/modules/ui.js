Drawmore.Modules.UI = {

  keyBindings : {
    resetView : [Key.ESC],
    pan : [Key.SPACE],
    zoom : ['v', 'm'],
    flip: ['x'],

    undo: ['z', 'n'],
    clear : [Key.DELETE, Key.BACKSPACE],

    nextBrush: ['t','y'],
    previousBrush: ['g','h'],
    brushResize: ['f', 'j'],
    brushSizeUp: ['e', 'i'],
    brushSizeDown: ['d','k'],

    opacityUp: ['w','o'],
    opacityDown: ['s','l'],
    opacity1: null,
    opacity2: null,
    opacity3: null,
    opacity4: null,

    pickColor: ['r', 'u'],
    nextColor: null,
    previousColor: null,
    palette1: ['1'],
    palette2: ['2'],
    palette3: ['3'],
    palette4: ['4'],
    palette5: ['5'],
    palette6: ['6'],
    palette7: ['7'],
    palette8: ['8'],
    palette9: ['9'],

    nudgeLayerUp : [Key.UP],
    nudgeLayerDown : [Key.DOWN],
    nudgeLayerLeft : [Key.LEFT],
    nudgeLayerRight : [Key.RIGHT],

    layerAbove: ['q'],
    layerBelow: ['a'],
    duplicateCurrentLayer: ['c'],
    toggleCurrentLayer: ['v'],
    groupLayer: ['g'],

    toggleUI: [Key.TAB, '0'],
    toggleHelp: [191] // question mark
  },

  // UI Event listeners

  addListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.addEventListener(i, this.listeners[i], false);
      }
    }
    var self = this;
    this.canvas.addEventListener('contextmenu', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.addEventListener('click', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.addEventListener('dblclick', function(ev) {
      ev.preventDefault();
    }, false);
  },

  removeListeners : function() {
    for (var i in this.listeners) {
      if (this.listeners.hasOwnProperty(i)) {
        window.removeEventListener(i, this.listeners[i], false);
      }
    }
    this.canvas.removeEventListener('contextmenu', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.removeEventListener('click', function(ev) {
      ev.preventDefault();
    }, false);
    this.canvas.removeEventListener('dblclick', function(ev) {
      ev.preventDefault();
    }, false);
  },

  pushAction : function(methodName, args) {
    var hs = new HistoryState(methodName, args, false);
    this.actionQueue.push(hs);
    this.requestRedraw();
  },

  runActions : function() {
    if (this.inRunActions) return;
    this.inRunActions = true;
    for (var i=0; i<this.actionQueue.length; i++) {
      var a = this.actionQueue[i];
      this[a.methodName].apply(this, a.args);
    }
    this.actionQueue.splice(0);
    this.inRunActions = false;
  },

  executeTimeJump : function() {
    if (this.inTimeJump) return;
    this.inTimeJump = true;
    Undoable.executeTimeJump.apply(this, arguments);
    this.runActions();
    this.inTimeJump = false;
  },

  createListeners : function() {
    var draw = this;

    this.listeners['mousewheel'] = function(ev) {
      if (ev.target != draw.canvas)
        return;
      draw.updateInputTime();
      if (ev.wheelDelta > 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['DOMMouseScroll'] = function(ev) {
      if (ev.target != draw.canvas)
        return;
      draw.updateInputTime();
      if (ev.detail < 0)
        draw.zoomIn();
      else
        draw.zoomOut();
    };

    this.listeners['mousemove'] = function(ev) {
      draw.updateInputTime();
      if (ev.target == draw.canvas) {
        draw.cursor.show();
      } else {
        draw.cursor.hide();
      }
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      if (draw.panning)
        draw.keepPanning();
      if (draw.moving)
        draw.keepMoving();
      if (draw.resizingBrush) {
        draw.keepResizingBrush();
      } else {
        draw.cursor.moveTo(draw.current.x, draw.current.y);
      }
      draw.absoluteCurrent = draw.getAbsolutePoint(draw.current);
      if (Mouse.state[Mouse.LEFT] && draw.mousedown) {
        if (draw.prev != null) {
          if (!ev.shiftKey && draw.ruler != null) {
            draw.removeTemporaryRuler(draw.ruler);
            draw.ruler = null;
          }
          if (ev.shiftKey && draw.ruler == null) {
            var dx = draw.absoluteCurrent.x - draw.absolutePrev.x;
            var dy = draw.absoluteCurrent.y - draw.absolutePrev.y;
            if (Math.abs(dx) > Math.abs(dy))
              draw.ruler = new Rulers.ConstantY(draw.absolutePrev.y);
            else
              draw.ruler = new Rulers.ConstantX(draw.absolutePrev.x);
            draw.addTemporaryRuler(draw.ruler);
          }
          draw.applyRulers(draw.absoluteCurrent);
          draw.pushAction('drawLine', [draw.absolutePrev, draw.absoluteCurrent]);
        }
        draw.prev = draw.current;
        draw.absolutePrev = draw.absoluteCurrent;
        ev.preventDefault();
      }
    };

    this.listeners['mousedown'] = function(ev) {
      draw.updateInputTime();
      draw.stopResizingBrush();
      draw.current = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.absoluteCurrent = draw.getAbsolutePoint(draw.current);
      draw.cursor.moveTo(draw.current.x, draw.current.y);
      if (Mouse.state[Mouse.LEFT] && ev.target == draw.canvas) {
        draw.mousedown = true;
        if (ev.altKey)
          draw.erasing = true;
        draw.pushAction('beginStroke', []);
        if (ev.shiftKey && draw.mouseup) {
          if (draw.ruler != null) {
            draw.removeTemporaryRuler(draw.ruler);
            draw.ruler = null;
          }
          draw.pushAction('drawLine', [draw.absoluteMouseup, draw.absoluteCurrent]);
          draw.prev = null;
        } else {
          draw.pushAction('drawPoint', [draw.absoluteCurrent]);
          draw.prev = draw.current;
          draw.absolutePrev = draw.absoluteCurrent;
        }
        ev.preventDefault();
      } else if (Mouse.state[Mouse.MIDDLE] && ev.target == draw.canvas) {
        if (ev.shiftKey)
          draw.startMoving();
        else
          draw.startPanning();
        ev.preventDefault();
      } else if (Mouse.state[Mouse.RIGHT] && ev.target == draw.canvas) {
        draw.startResizingBrush();
        ev.preventDefault();
      }
    };

    this.listeners['mouseup'] = function(ev) {
      draw.updateInputTime();
      draw.stopResizingBrush();
      if (draw.mousedown)
        ev.preventDefault();
      draw.mousedown = false;
      draw.mouseup = Mouse.getRelativeCoords(draw.canvas, ev);
      draw.absoluteMouseup = draw.getAbsolutePoint(draw.mouseup);
      if (!Mouse.state[Mouse.LEFT]) {
        draw.prev = null;
        draw.absolutePrev = null;
      }
      if (ev.button == Mouse.MIDDLE) {
        draw.stopPanning();
        draw.stopMoving();
      }
      draw.pushAction('endStroke', [draw.erasing]);
      draw.erasing = false;
    };

    this.listeners['keydown'] = function(ev) {
      draw.updateInputTime();
      if (Key.match(ev, [Key.ALT]))
        ev.preventDefault();
      if (ev.altKey) {
        if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.requestRedo(true);
          else
            draw.requestUndo(true);
          ev.preventDefault();
        }
      } else if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.startResizingBrush();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          if (ev.shiftKey)
            draw.startMoving();
          else
            draw.startPanning();

        } else if (Key.match(ev, draw.keyBindings.undo)) {
          if (ev.shiftKey)
            draw.requestRedo();
          else
            draw.requestUndo();

        } else if (Key.match(ev, draw.keyBindings.zoom)) {
          if (ev.shiftKey)
            draw.zoomOut();
          else
            draw.zoomIn();

        } else if (Key.match(ev,  draw.keyBindings.opacityUp)) {
          if (ev.shiftKey)
            draw.currentLayerOpacityUp();

        } else if (Key.match(ev,  draw.keyBindings.opacityDown)) {
          if (ev.shiftKey)
            draw.currentLayerOpacityDown();

        } else if (Key.match(ev, draw.keyBindings.nudgeLayerUp)) {
          draw.moveCurrentLayer(0, -1*(ev.shiftKey ? 10 : 1));
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerDown)) {
          draw.moveCurrentLayer(0, 1*(ev.shiftKey ? 10 : 1));
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerLeft)) {
          draw.moveCurrentLayer(-1*(ev.shiftKey ? 10 : 1), 0);
        } else if (Key.match(ev, draw.keyBindings.nudgeLayerRight)) {
          draw.moveCurrentLayer(1*(ev.shiftKey ? 10 : 1), 0);

        } else if (Key.match(ev, draw.keyBindings.pickColor) && !ev.ctrlKey && !draw.disableColorPick) {
          draw.pickColor(draw.current, draw.pickRadius);

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          ev.preventDefault();
        }
      }
    };

    this.listeners['keyup'] = function(ev) {
      draw.updateInputTime();
      draw.stopResizingBrush();
      if (Key.match(ev, [Key.ALT]))
        ev.preventDefault();
      if (ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.flip)) {
          if (ev.shiftKey)
            draw.flipCurrentLayerVertically();
          else
            draw.flipCurrentLayerHorizontally();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.layerAbove)) {
          draw.newLayer();
          ev.preventDefault();
        } else if (Key.match(ev, draw.keyBindings.layerBelow)) {
          draw.newLayerBelow();
          ev.preventDefault();

        } else if (Key.match(ev,  draw.keyBindings.groupLayer)) {
          if (ev.shiftKey)
            draw.unindentCurrentLayer();
          else
            draw.indentCurrentLayer();

        } else if (Key.match(ev, draw.keyBindings.duplicateCurrentLayer)) {
          draw.duplicateCurrentLayer();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.toggleCurrentLayer)) {
          draw.toggleCurrentLayer();
          ev.preventDefault();

        }
      }
      if (!ev.altKey && !ev.ctrlKey) {
        if (Key.match(ev, draw.keyBindings.clear)) {
          if (ev.shiftKey)
            draw.deleteCurrentLayer();
          else
            draw.clear();

        } else if (Key.match(ev, draw.keyBindings.resetView)) {
          draw.resetView();

        } else if (Key.match(ev, draw.keyBindings.pan)) {
          draw.stopPanning();
          draw.stopMoving();

        } else if (Key.match(ev, draw.keyBindings.toggleUI)) {
          draw.toggleUI();
          ev.preventDefault();

        } else if (Key.match(ev, draw.keyBindings.toggleHelp)) {
          draw.toggleHelp();

        } else if (Key.match(ev, draw.keyBindings.brushResize)) {
          draw.stopResizingBrush();

        } else if (Key.match(ev,  draw.keyBindings.opacityUp)) {
          if (!ev.shiftKey)
            draw.opacityUp();

        } else if (Key.match(ev,  draw.keyBindings.opacityDown)) {
          if (!ev.shiftKey)
            draw.opacityDown();

        } else if (Key.match(ev,  draw.keyBindings.brushSizeUp)) {
          draw.brushSizeUp();

        } else if (Key.match(ev,  draw.keyBindings.brushSizeDown)) {
          draw.brushSizeDown();

        } else if (Key.match(ev,  draw.keyBindings.previousBrush)) {
          draw.previousBrush();

        } else if (Key.match(ev,  draw.keyBindings.nextBrush)) {
          draw.nextBrush();

        } else if (Key.match(ev, draw.keyBindings.flip)) {
          if (ev.shiftKey)
            draw.flipY();
          else
            draw.flipX();

        } else if (Key.match(ev, draw.keyBindings.layerAbove)) {
          if (ev.shiftKey)
            draw.toggleCurrentLayerOpacityLocked();
          else
            draw.layerAbove();
        } else if (Key.match(ev, draw.keyBindings.layerBelow)) {
          if (ev.shiftKey)
            draw.mergeDown();
          else
            draw.layerBelow();

        } else if (Key.match(ev, draw.keyBindings.opacity1)) {
          draw.setOpacity(0.125);
        } else if (Key.match(ev, draw.keyBindings.opacity2)) {
          draw.setOpacity(0.25);
        } else if (Key.match(ev, draw.keyBindings.opacity3)) {
          draw.setOpacity(0.5);
        } else if (Key.match(ev, draw.keyBindings.opacity4)) {
          draw.setOpacity(1);

        } else if (Key.match(ev, draw.keyBindings.nextColor)) {
          draw.nextColor();

        } else if (Key.match(ev, draw.keyBindings.previousColor)) {
          draw.previousColor();

        } else if (Key.match(ev, draw.keyBindings.palette1)) {
          if (ev.shiftKey) draw.setPaletteColor(0, draw.color);
          else draw.setColor(draw.palette[0]);
        } else if (Key.match(ev, draw.keyBindings.palette2)) {
          if (ev.shiftKey) draw.setPaletteColor(1, draw.color);
          else draw.setColor(draw.palette[1]);
        } else if (Key.match(ev, draw.keyBindings.palette3)) {
          if (ev.shiftKey) draw.setPaletteColor(2, draw.color);
          else draw.setColor(draw.palette[2]);
        } else if (Key.match(ev, draw.keyBindings.palette4)) {
          if (ev.shiftKey) draw.setPaletteColor(3, draw.color);
          else draw.setColor(draw.palette[3]);
        } else if (Key.match(ev, draw.keyBindings.palette5)) {
          if (ev.shiftKey) draw.setPaletteColor(4, draw.color);
          else draw.setColor(draw.palette[4]);
        } else if (Key.match(ev, draw.keyBindings.palette6)) {
          if (ev.shiftKey) draw.setPaletteColor(5, draw.color);
          else draw.setColor(draw.palette[5]);
        } else if (Key.match(ev, draw.keyBindings.palette7)) {
          if (ev.shiftKey) draw.setPaletteColor(6, draw.color);
          else draw.setColor(draw.palette[6]);
        } else if (Key.match(ev, draw.keyBindings.palette8)) {
          if (ev.shiftKey) draw.setPaletteColor(7, draw.color);
          else draw.setColor(draw.palette[7]);
        } else if (Key.match(ev, draw.keyBindings.palette9)) {
          if (ev.shiftKey) draw.setPaletteColor(8, draw.color);
          else draw.setColor(draw.palette[8]);

        } else if (Key.match(ev, draw.keyBindings.paletteKeys)) {
          for (var i=0; i<draw.keyBindings.paletteKeys.length; i++) {
            if (Key.match(ev, draw.keyBindings.paletteKeys[i])) {
              draw.setColor(draw.palette[i]);
              break;
            }
          }
        }
      }
    };
  },


  // Interactive brush resizing

  startResizingBrush : function() {
    if (this.resizingBrush) return;
    this.resizingBrush = true;
    this.brushResizeX = this.current.x - this.lineWidth;
  },

  keepResizingBrush : function() {
    if (!this.resizingBrush) return;
    var d = Math.max(this.current.x - this.brushResizeX, 0);
    var dx = Math.clamp(d, this.minimumBrushSize, this.maximumBrushSize)
    this.setLineWidth(dx);
  },

  stopResizingBrush : function() {
    if (!this.resizingBrush) return;
    this.resizingBrush = false;
    var d = Math.max(this.current.x - this.brushResizeX, 0);
    var dx = Math.clamp(d, this.minimumBrushSize, this.maximumBrushSize)
    this.setLineWidth(dx);
  },

  brushSizeUp : function() {
    this.setLineWidth(Math.clamp(this.lineWidth*1.5, this.minimumBrushSize, this.maximumBrushSize));
  },

  brushSizeDown : function() {
    this.setLineWidth(Math.clamp(this.lineWidth/1.5, this.minimumBrushSize, this.maximumBrushSize));
  },


  // Reset view

  resetView : function() {
    var f = 1/this.zoom;
    this.setZoom(1);
    this.setLineWidth(this.lineWidth * f);
    this.setPan(0,0);
  },


  // Moving layers

  startMoving : function() {
    if (this.moving) return;
    this.moving = true;
    this.moveStart = this.current;
  },

  keepMoving : function() {
    if (!this.moving) return;
    var dx = this.current.x - this.moveStart.x;
    var dy = this.current.y - this.moveStart.y;
    this.moveStart = this.current;
    dx *= this.flippedX ? -1 : 1;
    dy *= this.flippedY ? -1 : 1;
    this.moveCurrentLayer(dx/this.zoom,dy/this.zoom);
  },

  stopMoving : function() {
    if (!this.moving) return;
    this.moving = false;
    var dx = this.current.x - this.moveStart.x;
    var dy = this.current.y - this.moveStart.y;
    this.moveStart = null;
    dx *= this.flippedX ? -1 : 1;
    dy *= this.flippedY ? -1 : 1;
    this.moveCurrentLayer(dx/this.zoom,dy/this.zoom);
  },


  // Panning

  startPanning : function() {
    if (this.panning) return;
    this.panning = true;
    this.panStart = this.current;
  },

  keepPanning : function() {
    if (!this.panning) return;
    var dx = this.current.x - this.panStart.x;
    var dy = this.current.y - this.panStart.y;
    this.panStart = this.current;
    this.pan(dx,dy);
  },

  stopPanning : function() {
    if (!this.panning) return;
    this.panning = false;
    var dx = this.current.x - this.panStart.x;
    var dy = this.current.y - this.panStart.y;
    this.panStart = null;
    this.pan(dx,dy);
  },

  pan : function(dx, dy) {
    this.setPan(this.panX+(this.flippedX?-1:1)*dx, this.panY+(this.flippedY?-1:1)*dy);
  },

  setPan : function(x, y) {
    this.panX = x;
    this.panY = y;
    this.needFullRedraw = true;
    this.requestRedraw();
  },


  // Zooming

  zoomIn : function() {
    var z = this.zoom;
    this.setZoom(this.zoom * 2);
    this.setLineWidth(this.lineWidth * (this.zoom/z));
  },

  zoomOut : function() {
    var z = this.zoom;
    this.setZoom(this.zoom / 2);
    this.setLineWidth(this.lineWidth * (this.zoom/z));
  },

  setZoom : function(z) {
    if (z < (1/16) || z > 64) return;
    this.needFullRedraw = true;
    var f = z/this.zoom;
    if (this.flippedX) {
      // panX is the distance of the right edge of the screen from the origin
      this.panX = Math.floor(f*(this.panX-(this.width-this.current.x))+(this.width-this.current.x));
    } else {
      // panX is the distance of the left edge of the screen from the origin
      this.panX = Math.floor(f*(this.panX-this.current.x)+this.current.x);
    }
    if (this.flippedY) {
      this.panY = Math.floor(f*(this.panY-(this.height-this.current.y))+(this.height-this.current.y));
    } else {
      this.panY = Math.floor(f*(this.panY-this.current.y)+this.current.y);
    }
    this.zoom = z;
    this.requestRedraw();
  },


  // Opacity keyboard control

  opacityUp : function() {
    if (this.opacity < 0.25) {
      this.setOpacity(0.25);
    } else if (this.opacity < 0.5) {
      this.setOpacity(0.5);
    } else {
      this.setOpacity(1);
    }
  },

  opacityDown : function() {
    if (this.opacity > 0.5) {
      this.setOpacity(0.5);
    } else if (this.opacity > 0.25) {
      this.setOpacity(0.25);
    } else {
      this.setOpacity(0.125);
    }
  },


  // UI toggles

  toggleUI : function() {
    // overwrite with a version that does something
  },

  toggleHelp : function() {
    // overwrite with a version that does something
  },

  toggleHistograms : function() {
    this.showHistograms = !this.showHistograms;
    this.requestRedraw();
  }

};
