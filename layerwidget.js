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
        BUTTON("+", {onclick: function(ev) {self.app.newLayer();}}),
        BUTTON("-", {onclick: function(ev) {self.app.deleteCurrentLayer();}}),
        BUTTON("x2", {onclick: function(ev) {self.app.duplicateCurrentLayer();}}),
        BUTTON("\u2194", {onclick: function(ev) {self.app.flipCurrentLayerHorizontally();}}),
        BUTTON("\u2195", {onclick: function(ev) {self.app.flipCurrentLayerVertically();}})
      )
    );
    this.container = container;
    this.container.appendChild(this.element);
    window.addEventListener('mouseup', function(ev){
      if (self.active) {
        var dropped = false;
        var srcIdx,dstIdx;
        var c = self.active;
        self.active = null;
        if (c.dragging) {
          dropped = true;
          var cc = toArray(self.layers.childNodes);
          var i = cc.indexOf(c);
          var clen = cc.length;
          srcIdx = clen-1-i;
          var dy = (ev.clientY-c.downY);
          var myTop = c.offsetTop;
          var myBottom = c.offsetTop + c.offsetHeight;
          dstIdx = srcIdx;
          for (var j=0; j<cc.length; j++) {
            var mid = (cc[j].offsetTop+cc[j].offsetHeight/2);
            if (dy < 0) { // going upwards, compare top to mid
              if (myTop < mid) {
                dstIdx = clen-1-j;
                break;
              }
            } else { // going down
              if (mid > myBottom) {
                dstIdx = clen-1-j+1;
                break;
              }
              if (j == cc.length-1) dstIdx = 0;
            }
          }
          dstIdx = Math.clamp(dstIdx, 0, clen-1);
          ev.preventDefault();
        }
        c.style.top = '0px';
        c.dragging = c.down = false;
        if (dropped)
          self.app.moveLayer(srcIdx, dstIdx);
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
        }
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

  __newLayer : function(layer) {
    var self = this;
    var li = LI(
      CHECKBOX({
        checked: layer.display,
        onclick: function(ev) {
          self.app.toggleLayer(self.indexOf(this.parentNode));
          ev.stopPropagation();
        }
      }),
      SPAN(layer.name, {
        contentEditable: true,
        tabIndex: -1,
        style: {cursor: 'text'},
        onchange: function(ev) {
          self.app.renameLayer(self.indexOf(this.parentNode), this.textContent);
        },
        onblur : function(ev) {
          self.app.renameLayer(self.indexOf(this.parentNode), this.textContent);
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
        onkeyup : function(ev) {
          ev.stopPropagation();
        },
        onclick : function(ev) {
          ev.stopPropagation();
        }
      }), {
      onmousedown : function(ev) {
        this.down = true;
        this.eatClick = false;
        this.downY = ev.clientY;
        if (self.active == null)
          self.active = this;
        ev.preventDefault();
      },
      onclick : function(ev) {
        if (this.eatClick) {
          this.eatClick = false;
        } else {
          self.app.setCurrentLayer(self.indexOf(this));
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
    var layers = this.app.layers;
    this.clear();
    for (var i=0; i<layers.length; i++) {
      var layer = layers[i];
      this.__newLayer(layer);
      if (this.app.currentLayerIndex == i)
        this.layers.firstChild.className = 'current';
    }
  },

  redraw : function() {
    if (this.needRedraw) {
      this.updateDisplay();
      this.needRedraw = false;
    }
  }
});

