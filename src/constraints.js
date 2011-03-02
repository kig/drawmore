Constraint = Klass({
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

Constraints = {};

Constraints.ConstantX = Klass(Constraint, {
  initialize : function(x) {
    this.x = x;
  },

  edit : function(point) {
    point.x = this.x;
    return point;
  }
});

Constraints.ConstantY = Klass(Constraint, {
  initialize : function(y) {
    this.y = y;
  },

  edit : function(point) {
    point.y = this.y;
    return point;
  }
});

