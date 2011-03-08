Drawmore.Modules.DrawLoop = {

  // Draw loop

  drawMainCanvas : function(x,y,w,h, noOptimize) {
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
    if (this.zoom > 1 && !noOptimize) {
      this.applyTo(this.tempCtx,
        x/this.zoom-this.zoom, y/this.zoom-this.zoom,
        w/this.zoom+2*this.zoom, h/this.zoom+2*this.zoom,
        this.flippedX, this.flippedY, 1);
      this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        var z2 = this.zoom*this.zoom;
        this.ctx.drawImage(this.tempCanvas,
          0, 0, w/this.zoom+2*this.zoom, h/this.zoom+2*this.zoom,
          -z2, -z2, w+2*z2, h+2*z2
        );
      this.ctx.restore();
    } else {
      this.applyTo(this.ctx, x, y, w, h, this.flippedX, this.flippedY, this.zoom);
    }
  },

  updateChangedBox : function(bbox) {
    if (this.changedBox == null) {
      this.changedBox = bbox;
    } else {
      Layer.bboxMerge(bbox, this.changedBox);
    }
  },

  updateDisplay : function() {
    this.executeTimeJump();
    var t0 = new Date().getTime();
    Layer.showCompositeDepth = this.showCompositeDepth;
    if (this.showCompositeDepth) {
      Layer.initCompositeDepthCanvas(this.width,this.height);
      Layer.compositeDepthCtx.save();
    }
    this.ctx.save();
    var pX = Math.floor(this.panX/this.zoom)*this.zoom;
    var pY = Math.floor(this.panY/this.zoom)*this.zoom;
    if (!this.needFullRedraw && this.changedBox && !this.flippedX && !this.flippedY) {
      if (this.changedBox.left <= this.changedBox.right && this.changedBox.top <= this.changedBox.bottom) {
        // Draw only the changedBox area.
        var x = this.changedBox.left*this.zoom+pX;
        var y = this.changedBox.top*this.zoom+pY;
        var w = Math.ceil(this.changedBox.width/this.zoom)*this.zoom*this.zoom;
        var h = Math.ceil(this.changedBox.height/this.zoom)*this.zoom*this.zoom;
        this.ctx.translate(x,y);
        if (this.showDrawAreas || Magi.console.IWantSpam) {
          this.ctx.strokeStyle = 'red';
          this.ctx.strokeRect(0,0,w,h);
        }
        if (this.showCompositeDepth) {
          Layer.compositeDepthCtx.beginPath();
          Layer.compositeDepthCtx.rect(x,y,w,h);
          Layer.compositeDepthCtx.clip();
          Layer.compositeDepthCtx.translate(pX, pY);
        }
        this.ctx.beginPath();
        this.ctx.rect(0,0,w,h);
        this.ctx.clip();
        this.drawMainCanvas(x-pX, y-pY, this.changedBox.width*this.zoom, this.changedBox.height*this.zoom);
      }
    } else {
      if (this.showCompositeDepth)
        Layer.compositeDepthCtx.translate(pX, pY);
      var w = Math.ceil(this.width/this.zoom)*this.zoom;
      var h = Math.ceil(this.height/this.zoom)*this.zoom;
      this.drawMainCanvas(-pX, -pY, w, h);
      this.needFullRedraw = false;
    }
    this.changedBox = null;
    this.ctx.restore();
    if (this.showCompositeDepth) {
      Layer.compositeDepthCtx.restore();
      this.ctx.drawImage(Layer.compositeDepthCanvas, 0, 0);
    }
    this.layerWidget.redraw();
    this.colorPicker.redraw();
    var t1 = new Date().getTime();
    var elapsed = t1-t0;
    this.redrawRequested = false;
    this.frameTimes[this.frameCount%this.frameTimes.length] = elapsed;
    this.frameIntervals[this.frameCount%this.frameTimes.length] = t1-(this.lastUpdateTime||t1);
    this.statsCanvas.style.display = this.showHistograms ? 'block' : 'none';
    if (this.showHistograms) {
      //this.ctx.getImageData(0,0,1,1); // force draw completion
      this.statsCtx.clearRect(0,0, this.statsCanvas.width, this.statsCanvas.height);
      this.drawFrameTimeHistogram(this.statsCtx, 12, 38);
      this.drawFrameIntervalHistogram(this.statsCtx, 12, 98);
    }
    if (this.inputTime >= this.lastUpdateTime) {
      var inputLag = t1 - this.inputTime;
      this.inputTimes[this.inputCount%this.inputTimes.length] = inputLag;
      if (this.showHistograms)
        this.drawInputTimeHistogram(this.statsCtx, 12, 68);
      this.inputCount++;
    }
    this.lastFrameDuration = elapsed;
    this.lastUpdateTime = t1;
    this.frameCount++;
  },

  updateInputTime : function() {
    this.lastInputTime = new Date().getTime();
    if (this.inputTime < this.lastUpdateTime)
      this.inputTime = new Date().getTime();
  },

  drawHistogram : function(title, unit, times, count, ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'black';
    var fc = count % times.length;
    var fx = times.length-1;
    var total = 0;
    for (var i=fc; i>=0; i--, fx--) {
      var ft = times[i];
      total += ft;
      if (ft > 80) {
        ft = 80;
        ctx.fillStyle = 'red';
      }
      ctx.fillRect(x+fx, y+12, 1, ft/4);
      if (ft == 80) ctx.fillStyle = 'black';
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      total += ft;
      if (ft > 80) {
        ft = 80;
        ctx.fillStyle = 'red';
      }
      ctx.fillRect(x+fx, y+12, 1, ft/4);
      if (ft == 80) ctx.fillStyle = 'black';
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(x,y+11,times.length,0.5);
    var fx = times.length-1;
    for (var i=fc; i>=0; i--, fx--) {
      var ft = times[i];
      if (ft > 80) ft = 80;
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    for (var i=times.length-1; i>fc; i--, fx--) {
      var ft = times[i];
      if (ft > 80) ft = 80;
      ctx.fillRect(x+fx, y+12+ft/4, 1, 1);
    }
    ctx.font = '9px sans-serif';
    var fpsText = title + times[fc] + unit;
    ctx.fillStyle = 'black';
    ctx.fillText(fpsText, x+0, y+9);
    ctx.restore();
  },

  drawFrameTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("draw time ", " ms", this.frameTimes, this.frameCount, ctx, x, y);
  },

  drawInputTimeHistogram : function(ctx, x, y) {
    this.drawHistogram("input lag ", " ms", this.inputTimes, this.inputCount, ctx, x, y);
  },

  drawFrameIntervalHistogram : function(ctx, x, y) {
    this.drawHistogram("frame interval ", " ms", this.frameIntervals, this.frameCount, ctx, x, y);
  },

  resize : function(w,h) {
    if (w != this.width || h != this.height) {
      this.width = w;
      this.height = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.tempCanvas = E.canvas(w,h);
      this.tempCtx = this.tempCanvas.getContext('2d');
      this.tempLayerStack = [
        new CanvasLayer(w,h),
        new CanvasLayer(w,h),
        new CanvasLayer(w,h)
      ];
      this.requestRedraw();
    }
  },

  applyTo : function(ctx, x, y, w, h, flippedX, flippedY, zoom) {
    this.executeTimeJump();
    var px = -x;
    var py = -y;
    ctx.save();
      ctx.beginPath();
      ctx.fillStyle = this.colorToStyle(this.background);
      ctx.fillRect(0,0,w,h);
      var xs = 1, ys = 1;
      if (flippedX) {
        px = px + -2*px+w;
        xs = -1;
      }
      if (flippedY) {
        py = py + -2*py+h;
        ys = -1;
      }
      ctx.translate(px, py);
      ctx.scale(zoom*xs, zoom*ys);
      for (var i=0; i<this.tempLayerStack.length; i++)
      {
        var tl = this.tempLayerStack[i];
        tl.upsize(w,h);
        tl.x = x;
        tl.y = y;
        tl.compensateZoom = zoom;
      }
      if (this.strokeLayer.display && this.currentLayer != null) {
        this.currentLayer.prependChild(this.strokeLayer);
        var composite = (this.erasing ? 'destination-out' :
          (this.currentLayer.opacityLocked ? 'source-atop' : 'source-over')
        );
        this.strokeLayer.globalCompositeOperation = composite;
      }

      TiledLayer.printAllocStats('out-frame');
      TiledLayer.resetAllocStats();
      Layer.printStats('out-frame');
      Layer.resetStats();
      this.topLayer.applyTo(ctx, null, this.tempLayerStack, true);
      TiledLayer.printAllocStats('in-frame');
      Layer.printStats('in-frame');
      Magi.console.spam('--------------------------------------------------------------------');

      if (this.strokeLayer.hasParentNode()) {
        var p = this.strokeLayer.getParentNode();
        if (!p)
          Magi.console.log('Warning: strokeLayer.getParentNode returned null', this.strokeLayer.parentNodeUID, p, this.strokeLayer);
        else
          p.removeChild(this.strokeLayer);
      }
    ctx.restore();
  },

  requestRedraw : function() {
    if (this.redrawRequested)
      return;
    this.inputTime = this.lastInputTime;
    this.redrawRequested = true;
    var self = this;
    var update = function(){ self.updateDisplay(); };
    if (window.mozRequestAnimationFrame) {
      window.mozRequestAnimationFrame(update);
    } else if (window.webkitRequestAnimationFrame) {
      window.webkitRequestAnimationFrame(update);
    } else {
      setTimeout(update, 0);
    }
  }

};
