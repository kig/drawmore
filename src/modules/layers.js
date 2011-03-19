Drawmore.Modules.Layers = {
  // Layers

  setLayerComposite : function(uid, composite) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.globalCompositeOperation = composite;
    this.addHistoryState(new HistoryState('setLayerComposite', [uid, composite], true));
    this.layerWidget.requestRedraw();
    this.updateChangedBox(layer.getBoundingBox());
    this.requestRedraw();
  },

  addLayerMask : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    var mask = this.createLayerObject();
    mask.name = mask.name.replace(/Layer/, 'Mask');
    var bbox = layer.getBoundingBox();
    mask.globalCompositeOperation = 'destination-out';
    layer.prependChild(mask);
    this.setCurrentLayer(mask.uid, false);
    this.addHistoryState(new HistoryState('addLayerMask', [uid], true));
    this.layerWidget.requestRedraw();
    this.updateChangedBox(bbox);
    this.requestRedraw();
   },

  addCurrentLayerMask : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.addLayerMask(this.currentLayer.uid);
  },

  indentLayer : function(srcUID, groupUID) {
    var layer = this.layerManager.getLayerByUID(srcUID);
    var group = this.layerManager.getLayerByUID(groupUID);
    group.appendChild(layer);
    var isTop = (layer.parentNodeUID == this.topLayer.uid);
  },

  unindentLayer : function(uid) {
    var layer = this.layerManager.getLayerByUID(uid);
    var parent = layer.getParentNode();
    var grandParent = parent.getParentNode();
    grandParent.insertChildAfter(layer, parent);
    var isTop = (layer.parentNodeUID == this.topLayer.uid);
  },

  indentCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var prev = this.currentLayer.getPreviousNode();
    if (prev && prev.uid != this.currentLayer.parentNodeUID) {
      var uid = this.currentLayer.uid;
      if (this.currentLayer.globalCompositeOperation == 'source-over' && this.currentLayer.parentNodeUID == this.topLayer.uid)
        this.currentLayer.globalCompositeOperation = 'source-atop';
      if (prev.parentNodeUID != this.currentLayer.parentNodeUID)
        prev = prev.getParentNode();
      this.indentLayer(uid, prev.uid);
      this.addHistoryState(new HistoryState('indentCurrentLayer', [], true));
      this.layerWidget.requestRedraw();
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.requestRedraw();
    }
  },

  unindentCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    if (this.currentLayer.parentNodeUID != this.topLayer.uid) {
      var uid = this.currentLayer.uid;
      var parent = this.currentLayer.getParentNode();
      var cc = parent.childNodes;
      var nextLayers = cc.slice(cc.indexOf(uid)+1);
      for (var i=0; i<nextLayers.length; i++) {
        this.currentLayer.appendChild(this.layerManager.getLayerByUID(nextLayers[i]));
      }
      this.unindentLayer(uid);
      if (this.currentLayer.globalCompositeOperation == 'source-atop' && this.currentLayer.parentNodeUID == this.topLayer.uid)
        this.currentLayer.globalCompositeOperation = 'source-over';
      this.addHistoryState(new HistoryState('unindentCurrentLayer', [], true));
      this.layerWidget.requestRedraw();
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.requestRedraw();
    }
  },

  layerAbove : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var p = this.currentLayer.getNextNode();
    if (p) this.setCurrentLayer(p.uid);
  },

  layerBelow : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var p = this.currentLayer.getPreviousNode();
    if (p) this.setCurrentLayer(p.uid);
  },

  toggleCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.toggleLayer(this.currentLayer.uid);
  },

  toggleCurrentLayerOpacityLocked : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.toggleLayerOpacityLocked(this.currentLayer.uid);
  },

  toggleLayerOpacityLocked : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.opacityLocked = !layer.opacityLocked;
    this.addHistoryState(new HistoryState('toggleLayerOpacityLocked', [uid], true));
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  toggleLayerLinkPosition : function(uid) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    if (uid != this.currentLayer.uid) {
      var l = this.layerManager.getLayerByUID(uid);
      var linked = l.isPropertyLinkedWith('x', this.currentLayer);
      if (linked) {
        l.unlinkProperty('x');
        l.unlinkProperty('y');
      } else {
        this.currentLayer.linkProperty('x', l);
        this.currentLayer.linkProperty('y', l);
      }
      this.addHistoryState(new HistoryState('toggleLayerLinkPosition', [uid], true));
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  flipCurrentLayerHorizontally : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.currentLayer.flipX();
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerHorizontally', [], true));
  },

  flipCurrentLayerVertically : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.currentLayer.flipY();
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('flipCurrentLayerVertically', [], true));
  },

  moveCurrentLayer : function(dx, dy) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.currentLayer.modify('x', dx);
    this.currentLayer.modify('y', dy);
    var self = this;
    var cc = this.currentLayer.childNodes.slice(0);
    for (var i=0; i<cc.length; i++) {
      var cn = cc[i];
      var l = self.layerManager.getLayerByUID(cn);
      if (!l.isPropertyLinkedWith('x', this.currentLayer)) {
        l.x += dx;
        l.y += dy;
      }
      cc = cc.concat(l.childNodes);
    }
    this.needFullRedraw = true;
    this.requestRedraw();
    var l = this.history.last();
    if (l.methodName == 'moveCurrentLayer') {
      this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], false));
    } else {
      this.addHistoryState(new HistoryState('moveCurrentLayer', [dx,dy], true));
    }
  },

  mergeDown : function(addHistory) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var below = this.currentLayer.getPreviousNode();
    if (below && below.uid != this.topLayer.uid) {
      var target = this.createLayerObject();
      // target becomes below
      below.compositeTo(target, below.opacity, 'source-over');
      this.currentLayer.applyTo(target);
      below.tiles = target.tiles;
      below.x = 0;
      below.y = 0;
      below.opacity = 1;
      this.deleteCurrentLayer(false);
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.addHistoryState(new HistoryState('mergeDown', [], true));
    }
  },

  mergeVisible : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var target = this.createLayerObject();
    this.topLayer.applyTo(target);
    for (var i=0; i<this.topLayer.childNodes.length; i++) {
      var l = this.layerManager.getLayerByUID(this.topLayer.childNodes[i]);
      while (i<this.topLayer.childNodes.length && l.display) {
        this.deleteLayer(this.topLayer.childNodes[i], false);
        l = this.layerManager.getLayerByUID(this.topLayer.childNodes[i]);
      }
    }
    this.addLayerBeforeCurrent(target);
    this.setCurrentLayer(target.uid, false);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('mergeVisible', [], true));
  },

  mergeAll : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var target = this.createLayerObject();
    this.topLayer.applyTo(target);
    while (this.topLayer.childNodes.length > 0)
      this.deleteLayer(this.topLayer.childNodes[0], false);
    this.addLayerBeforeCurrent(target);
    this.setCurrentLayer(target.uid, false);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('mergeAll', [], true));
  },

  setCurrentLayerOpacity : function(opacity) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setLayerOpacity(this.currentLayer.uid, opacity);
    this.layerWidget.requestRedraw();
  },

  currentLayerOpacityUp : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity * 1.1, 1/255, 1));
  },

  currentLayerOpacityDown : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.setCurrentLayerOpacity(Math.clamp(this.currentLayer.opacity / 1.1, 0, 1));
  },

  setLayerOpacity : function(uid, opacity) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    if (layer) {
      layer.set('opacity', opacity);
      this.updateChangedBox(layer.getBoundingBox());
      this.requestRedraw();
      var l = this.history.last();
      if (l.methodName == 'setLayerOpacity' && l.args[0] == uid) {
        l.args[1] = opacity;
      } else {
        this.addHistoryState(new HistoryState('setLayerOpacity', [uid, opacity], true));
      }
    }
  },

  createLayerObject : function() {
    var layer = new TiledLayer();
    layer.name = "Layer " + this.layerUID;
    layer.uid = this.layerUID;
    this.layerUID++;
    this.layerManager.addLayer(layer);
    return layer;
  },

  newLayerFromImage : function(img, x, y, name) {
    this.executeTimeJump();
    var layer = this.createLayerObject();
    if (name != null)
      layer.name = name;
    if ((x == null || y == null) && this.current) {
      var xy = this.getAbsolutePoint(this.current);
      x = xy.x;
      y = xy.y;
    }
    x = x || 0;
    y = y || 0;
    layer.drawImage(img, 0, 0);
    layer.set('x', x);
    layer.set('y', y);
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayerFromImage',  [img,x,y,name], true));
    return layer;
  },

  newLayer : function() {
    this.executeTimeJump();
    var layer = this.createLayerObject();
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayer', [], true));
    return layer;
  },

  newLayerBelow : function() {
    this.executeTimeJump();
    var layer = this.createLayerObject();
    this.addLayerBeforeCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('newLayerBelow', [], true));
    return layer;
  },

  addLayerAfterCurrent : function(layer) {
    if (!this.currentLayer) {
      this.topLayer.appendChild(layer);
      this.setCurrentLayer(layer.uid, false);
    } else {
      if (layer.globalCompositeOperation == 'source-over')
        layer.globalCompositeOperation = 'source-atop';
      if (this.currentLayer.childNodes.length > 0) {
        this.indentLayer(layer.uid, this.currentLayer.uid);
      } else {
        this.currentLayer.getParentNode().insertChildAfter(layer, this.currentLayer);
      }
      if (layer.parentNodeUID == this.topLayer.uid)
        layer.globalCompositeOperation = 'source-over';
      this.setCurrentLayer(layer.uid, false);
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  addLayerBeforeCurrent : function(layer) {
    if (!this.currentLayer) {
      this.topLayer.prependChild(layer);
      this.setCurrentLayer(layer.uid, false);
    } else {
      if (layer.globalCompositeOperation == 'source-over')
        layer.globalCompositeOperation = 'source-atop';
      this.currentLayer.getParentNode().insertChildBefore(layer, this.currentLayer);
      this.setCurrentLayer(layer.uid, false);
      if (layer.parentNodeUID == this.topLayer.uid)
        layer.globalCompositeOperation = 'source-over';
    }
    this.layerWidget.requestRedraw();
    this.requestRedraw();
  },

  duplicateCurrentLayer : function() {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    var layer = this.currentLayer.copy(false);
    layer.uid = this.layerUID++;
    this.layerManager.addLayer(layer);
    this.addLayerAfterCurrent(layer);
    this.updateChangedBox(this.currentLayer.getBoundingBox());
    this.addHistoryState(new HistoryState('duplicateCurrentLayer', [], true));
    return layer;
  },

  renameLayer : function(uid, name) {
    this.executeTimeJump();
    this.layerManager.getLayerByUID(uid).name = name;
    this.layerWidget.requestRedraw();
    this.addHistoryState(new HistoryState('renameLayer', [uid, name], true));
  },

  hideLayer : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.set('display', false);
    this.layerWidget.requestRedraw();
    this.updateChangedBox(layer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('hideLayer', [uid], true));
  },

  showLayer : function(uid) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    layer.set('display', true);
    this.layerWidget.requestRedraw();
    this.updateChangedBox(layer.getBoundingBox());
    this.requestRedraw();
    this.addHistoryState(new HistoryState('showLayer', [uid], true));
  },

  toggleLayer : function(uid) {
    this.executeTimeJump();
    if (this.layerManager.getLayerByUID(uid).display)
      this.hideLayer(uid);
    else
      this.showLayer(uid);
  },

  layerIndexDFS : function(layer, uid) {
    if (uid == layer.uid) {
      return [0, true];
    } else {
      var idx = 1;
      for (var i=0; i<layer.childNodes.length; i++) {
        var found = this.layerIndexDFS(this.layerManager.getLayerByUID(layer.childNodes[i]), uid);
        idx += found[0];
        if (found[1])
          return [idx, true];
      }
      return [idx, false];
    }
  },

  getLayerIndex : function(layer) {
    var found = this.layerIndexDFS(this.topLayer, layer.uid)
    if (found[1])
      return found[0];
    else
      return -1;
  },

  isLayerBefore : function(a, b) {
    return this.getLayerIndex(a) < this.getLayerIndex(b);
  },

  moveLayer : function(srcUID, dstUID) {
    this.executeTimeJump();
    if (srcUID == dstUID || srcUID == null || dstUID == null) return;
    var src = this.layerManager.getLayerByUID(srcUID);
    var dst = this.layerManager.getLayerByUID(dstUID);
    if (src.isParentOf(dst)) return;
    if (this.isLayerBefore(src,dst)) {
      if (src.globalCompositeOperation == 'source-over' && src.parentNodeUID == this.topLayer.uid)
        src.globalCompositeOperation = 'source-atop';
      if (dst.childNodes.length > 0) dst.prependChild(src);
      else dst.getParentNode().insertChildAfter(src, dst);
    } else {
      dst.getParentNode().insertChildBefore(src, dst);
    }
    if (src.globalCompositeOperation == 'source-atop' && src.parentNodeUID == this.topLayer.uid)
      src.globalCompositeOperation = 'source-over';
    this.updateChangedBox(src.getBoundingBox());
    this.updateChangedBox(dst.getBoundingBox());
    this.addHistoryState(new HistoryState('moveLayer', [srcUID, dstUID], true));
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  deleteLayer : function(uid, recordHistory) {
    this.executeTimeJump();
    var layer = this.layerManager.getLayerByUID(uid);
    if (layer == null) throw ("deleteLayer: no layer with UID "+uid);
    if (layer == this.currentLayer) {
      layer.childNodes = [];
      var prev = layer.getPreviousNode();
      if (prev && prev.uid != this.topLayer.uid) {
        this.setCurrentLayer(prev.uid, false);
      } else {
        var next = layer.getNextNode();
        if (next && next.uid != this.topLayer.uid) {
          this.setCurrentLayer(next.uid, false);
        } else {
          this.setCurrentLayer(null, false);
        }
      }
    }
    this.updateChangedBox(layer.getBoundingBox());
    layer.destroy();

    if (recordHistory != false)
      this.addHistoryState(new HistoryState('deleteLayer', [uid], true));
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  deleteCurrentLayer : function(addHistory) {
    this.executeTimeJump();
    if (!this.currentLayer) return;
    this.deleteLayer(this.currentLayer.uid, addHistory);
  },

  setCurrentLayer : function(uid, recordHistory) {
    this.executeTimeJump();
    if (uid == null) {
      this.currentLayer = null;
    } else if (uid == this.topLayer.uid) {
      return;
    } else {
      var layer = this.layerManager.getLayerByUID(uid);
      if (layer == null) throw ("setCurrentLayer: no layer with UID "+uid);
      this.currentLayer = layer;
    }
    if (recordHistory != false) {
      // collapse multiple setCurrentLayer calls into a single history event
      var last = this.history.last();
      if (last && last.methodName == 'setCurrentLayer')
        last.args[0] = uid;
      else
        this.addHistoryState(new HistoryState('setCurrentLayer', [uid], true));
    }
    this.requestRedraw();
    this.layerWidget.requestRedraw();
  },

  clear : function() {
    if (this.selectionLayer.isEmpty()) {
      this.executeTimeJump();
      if (!this.currentLayer) return;
      this.updateChangedBox(this.currentLayer.getBoundingBox());
      this.currentLayer.clear();
    } else {
      this.clearSelection(false);
    }
    this.addHistoryState(new HistoryState('clear',  [], true));
    this.requestRedraw();
  }
};