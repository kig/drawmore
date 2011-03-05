LayerWidget = Klass({

  initialize : function(app, container) {
    this.app = app;
    this.element = DIV();
    this.element.className = 'layerWidget';
    this.layers = OL();
    this.layers.className = 'layers';
    this.element.appendChild(this.layers);
    var self = this;
    this.element.appendChild(
      DIV(
        BUTTON("+", {title: 'New layer', onclick: function(ev) {self.app.newLayer();this.blur();}, onkeyup: Event.cancel}),
        BUTTON("-", {title: 'Delete layer', onclick: function(ev) {self.app.deleteCurrentLayer();this.blur();}, onkeyup: Event.cancel}),
        BUTTON("x2", {title: 'Duplicate layer', onclick: function(ev) {self.app.duplicateCurrentLayer();this.blur();}, onkeyup: Event.cancel}),
        //BUTTON("\u2194", {title: 'Flip layer horizontally', onclick: function(ev) {self.app.flipCurrentLayerHorizontally();this.blur();}, onkeyup: Event.cancel}),
        //BUTTON("\u2195", {title: 'Flip layer vertically', onclick: function(ev) {self.app.flipCurrentLayerVertically();this.blur();}, onkeyup: Event.cancel}),
        BUTTON("\u21a7", {title: 'Merge down', onclick: function(ev) {self.app.mergeDown();this.blur();}, onkeyup: Event.cancel}),
        BUTTON("\u21a1", {title: 'Merge visible', onclick: function(ev) {self.app.mergeVisible();this.blur();}, onkeyup: Event.cancel}),
        BUTTON("_", {title: 'Flatten image', onclick: function(ev) {self.app.mergeAll();this.blur();}, onkeyup: Event.cancel})
      )
    );
    this.container = container;
    this.container.appendChild(this.element);
    window.addEventListener('mouseup', function(ev){
      if (self.active) {
        var dropped = false;
        var srcUID,dstUID;
        var c = self.active;
        srcUID = dstUID = c.layerUID;
        self.active = null;
        if (c.dragging) {
          dropped = true;
          var cc = toArray(self.layers.childNodes);
          var i = cc.indexOf(c);
          var dy = (ev.clientY-c.downY);
          var myTop = c.offsetTop;
          var myBottom = c.offsetTop + c.offsetHeight;
          if (dy < 0) { // going upwards == towards the end in layer list == towards start of html list
            for (var j=i-1; j>=0; j--) {
              var mid = cc[j].offsetTop+cc[j].offsetHeight/2;
              if (myTop < mid) {
                dstUID = cc[j].layerUID;
              } else {
                break;
              }
            }
          } else {
            for (var j=i+1; j<cc.length; j++) {
              var mid = cc[j].offsetTop+cc[j].offsetHeight/2;
              if (myBottom > mid) {
                dstUID = cc[j].layerUID;
              } else {
                break;
              }
            }
          }
          ev.preventDefault();
          var lm = self.app.layerManager;
          self.app.moveLayer(srcUID, dstUID);
        }
        c.style.top = '0px';
        c.style.zIndex = 0;
        c.dragging = c.down = false;
      }
      if (self.activeOpacity) {
        var dx = ev.clientX-self.activeOpacity.downX;
        self.activeOpacity.downX = ev.clientX;
        self.activeOpacity.move(dx);
        self.app.setLayerOpacity(self.activeOpacity.layerUID, self.activeOpacity.opacity);
        self.activeOpacity = null;
      }
    }, false);
    window.addEventListener('mousemove', function(ev) {
      if (self.active) {
        var y = ev.clientY;
        var dy = y-self.active.downY;
        if (Math.abs(dy) > 3) {
          self.active.dragging = true;
          self.active.eatClick = true;
        }
        if (self.active.dragging) {
          self.active.style.top = dy + 'px';
          self.active.style.zIndex = 10;
        }
      }
      if (self.activeOpacity) {
        var dx = ev.clientX-self.activeOpacity.downX;
        self.activeOpacity.downX = ev.clientX;
        self.activeOpacity.move(dx);
        self.app.setLayerOpacity(self.activeOpacity.layerUID, self.activeOpacity.opacity);
      }
      ev.preventDefault();
    }, false);
  },

  clear : function() {
    while (this.layers.firstChild)
      this.layers.removeChild(this.layers.firstChild);
  },

  indexOf : function(layer) {
    var cc = toArray(this.layers.childNodes);
    var idx = cc.length-1-cc.indexOf(layer);
    return idx;
  },

  __newLayer : function(layer, indent, isCurrent) {
    var self = this;
    var li = LI(
      {
        className: (isCurrent ? 'current' : ''),
        layerUID : layer.uid,
        style : {marginLeft: indent*16 + 'px'}
      },
      DIV(
        {
          className: 'layerOpacitySlider',
          onmousedown : function(ev) {
            this.firstChild.makeActive(ev);
            var x = Mouse.getRelativeCoords(this,ev).x-10;
            this.firstChild.setOpacity(x/134);
            self.app.setLayerOpacity(self.activeOpacity.layerUID, self.activeOpacity.opacity);
            Event.stop(ev);
          }
        },
        DIV(
          {
            opacity : layer.opacity,
            style: { left: (layer.opacity*134)+'px' },
            className: 'layerOpacityKnob',
            onmousedown : function(ev){
              this.makeActive(ev);
              Event.stop(ev);
            },
            makeActive : function(ev) {
              this.layerUID = layer.uid;
              self.activeOpacity = this;
              if (ev)
                this.downX = ev.clientX;
            },
            setOpacity : function(o) {
              this.opacity = Math.clamp(o, 0, 1);
              this.style.left = (this.opacity*134)+'px';
            },
            move : function(dx) {
              this.setOpacity(this.opacity + (dx / 134));
            }
          }
        )
      ),
      CHECKBOX({
        checked: layer.display,
        title: 'Visibility',
        onclick: function(ev) {
          self.app.toggleLayer(layer.uid);
          ev.stopPropagation();
        },
        onkeydown : Event.cancel
      }),
      CHECKBOX({
        disabled: isCurrent,
        checked: layer.isPropertyLinkedWith('x', self.app.currentLayer),
        title: 'Link position',
        onclick: function(ev) {
          self.app.toggleLayerLinkPosition(layer.uid);
          ev.stopPropagation();
        },
        onkeydown : Event.cancel
      }),
      CHECKBOX({
        checked: layer.opacityLocked,
        title: 'Opacity lock',
        onclick: function(ev) {
          self.app.toggleLayerOpacityLocked(layer.uid);
          ev.stopPropagation();
        },
        onkeydown : Event.cancel
      }),
      SPAN(layer.name, {
        contentEditable: true,
        tabIndex: -1,
        spellcheck: false,
        style: {cursor: 'text'},
        onchange: function(ev) {
          self.app.renameLayer(layer.uid, this.textContent);
        },
        onblur : function(ev) {
          self.app.renameLayer(layer.uid, this.textContent);
        },
        onmousedown : function(ev) {
          this.focus();
          ev.stopPropagation();
        },
        onkeydown : function(ev) {
          if (Key.match(ev, [Key.ENTER, Key.ESC])) {
            this.blur();
          }
          ev.stopPropagation();
        },
        onkeyup : function(ev) {ev.stopPropagation()},
        onclick : function(ev) {ev.stopPropagation()}
      }), {
      onmousedown : function(ev) {
        this.down = true;
        this.eatClick = false;
        this.downY = ev.clientY;
        this.layerUID = layer.uid;
        if (self.active == null)
          self.active = this;
        ev.preventDefault();
      },
      onclick : function(ev) {
        if (this.eatClick) {
          this.eatClick = false;
        } else {
          self.app.setCurrentLayer(layer.uid);
        }
        ev.preventDefault();
      }
    });
    li.style.position = 'relative';
    li.name = layer.name;
    if (this.layers.firstChild)
      this.layers.insertBefore(li, this.layers.firstChild);
    else
      this.layers.appendChild(li);
    return li;
  },

  requestRedraw : function() {
    this.needRedraw = true;
  },

  updateDisplay : function() {
    this.clear();
    this.buildLayerList(this.app.topLayer, 0);
  },
  
  buildLayerList : function(layer, indent) {
    for (var i=0; i<layer.childNodes.length; i++) {
      var c = layer.getChildNode(i);
      this.__newLayer(c, indent, this.app.currentLayer.uid == c.uid);
      this.buildLayerList(c, indent+1);
    }
  },

  redraw : function() {
    if (this.needRedraw) {
      this.updateDisplay();
      this.needRedraw = false;
    }
  }
});

