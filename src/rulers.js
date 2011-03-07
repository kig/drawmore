Ruler = Klass({
  snapDistance : 10,

  initialize: function() {},

  withinRange : function(point) {
    return true;
  },

  edit : function(point) {
    return point;
  },

  applyTo : function(point) {
    if (this.withinRange(point))
      this.edit(point);
    return point;
  }
});

Rulers = {};

Rulers.ConstantX = Klass(Ruler, {
  initialize : function(x) {
    this.x = x;
  },

  edit : function(point) {
    point.x = this.x;
    return point;
  }
});

Rulers.ConstantY = Klass(Ruler, {
  initialize : function(y) {
    this.y = y;
  },

  edit : function(point) {
    point.y = this.y;
    return point;
  }
});

Rulers.SnapX = Klass(Rulers.ConstantX, {
  withinRange : function(point) {
    return (Math.abs(point.x - this.x) < Ruler.snapDistance)
  }
});

Rulers.SnapY = Klass(Rulers.ConstantY, {
  withinRange : function(point) {
    return (Math.abs(point.y - this.y) < Ruler.snapDistance)
  }
});
