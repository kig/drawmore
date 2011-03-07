Drawmore.Modules.Rulers = {

  // Rulers

  addTemporaryRuler : function(c) {
    this.executeTimeJump();
    this.rulers.push(c);
  },

  removeTemporaryRuler : function(c) {
    this.executeTimeJump();
    this.rulers.deleteFirst(c);
  },

  addRuler : function(c) {
    this.executeTimeJump();
    this.rulers.push(c);
    this.addHistoryState(new HistoryState('addRuler', [c]));
  },

  removeRuler : function(c) {
    this.executeTimeJump();
    var idx = this.rulers.indexOf(c);
    if (idx >= 0)
      this.removeRulerAt(idx);
  },

  removeRulerAt : function(idx) {
    this.executeTimeJump();
    this.rulers.splice(idx,1);
    this.addHistoryState(new HistoryState('removeRulerAt', [idx]));
  },

  applyRulers : function(p) {
    this.executeTimeJump();
    for (var i=0; i<this.rulers.length; i++) {
      this.rulers[i].applyTo(p);
    }
    return p;
  }

};
