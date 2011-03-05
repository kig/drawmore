HistoryState = function(methodName, args, breakpoint) {
  this.methodName = methodName;
  this.args = args;
  if (breakpoint)
    this.breakpoint = breakpoint;
  this.timeStamp = new Date().getTime();
};

Undoable = Klass({
  historySnapshotEventCount : 1000,
  playbackRate : 5000, // events per millisecond
  recordHistory : true,
  historyIndex : -1,

  initialize : function() {
    this.clearHistory();
  },

  /**
    Applies history state.
    You need to overwrite this.
  */
  applyHistoryState : function(state) {
    throw(new Error("Undoable.applyHistorystate: Not implemented"));
  },

  /**
    Creates a new snapshot of current object state and
    returns it.
    You need to overwrite this.
  */
  createSnapshot : function() {
    throw(new Error("Undoable.createSnapshot: Not implemented"));
    // return snapshot;
  },

  /**
    Applies an object state snapshot.
    You need to overwrite this.
  */
  applySnapshot : function(snapshot) {
    throw(new Error("Undoable.applySnapshot: Not implemented"));
  },


  addSnapshot : function() {
    this.snapshots.push({
      historyIndex: this.historyIndex,
      value: this.createSnapshot()
    });
  },

  getSnapshot : function(index) {
    for (var i=1; i<this.snapshots.length; i++) {
      if (this.snapshots[i].historyIndex > index) {
        return this.snapshots[i-1];
      }
    }
    return this.snapshots.last();
  },

  addHistoryState : function(obj) {
    if (this.recordHistory) {
      this.historyIndex++;
      this.history[this.historyIndex] = obj;
      if (this.history.length > this.historyIndex+1) {
        this.history.splice(this.historyIndex+1);
        for (var i=0; i<this.snapshots.length; i++) {
          if (this.snapshots[i].historyIndex > this.historyIndex) {
            this.snapshots.splice(i);
            break;
          }
        }
      }
      if (this.historyIndex % this.historySnapshotEventCount == 0) {
        this.addSnapshot();
      }
    }
  },

  addHistoryBarrier : function() {
    this.addHistoryState(null);
    this.addSnapshot();
  },

  gotoHistoryState : function(index) {
    index = Math.clamp(index, 0, this.history.length-1);
    if (index == this.historyIndex) return;
    var snapshot = this.getSnapshot(index);
    this.recordHistory = false;
    this.applySnapshot(snapshot.value);
    for (var i=snapshot.historyIndex+1; i<=index; i++) {
      if (this.history[i] != null)
        this.applyHistoryState(this.history[i]);
    }
    this.recordHistory = true;
    this.historyIndex = index;
  },

  undo : function(singleStep) {
    var lastPoint = this.historyIndex;
    for (var i=lastPoint; i>=0; i--) {
      if (this.history[i] == null) { // barrier, can't cross
        lastPoint = i+1;
        break;
      } else if (singleStep || this.history[i].breakpoint) {
        lastPoint = i;
        break;
      }
    }
    this.gotoHistoryState(lastPoint-1);
  },

  redo : function(singleStep) {
    var nextPoint = this.history.length;
    for (var i=this.historyIndex+2; i<this.history.length; i++) {
      if (this.history[i] != null && (singleStep || this.history[i].breakpoint)) {
        nextPoint = i;
        break;
      }
    }
    this.gotoHistoryState(nextPoint-1);
  },

  clearHistory : function() {
    this.history = [];
    this.snapshots = [];
    this.historyIndex = -1;
  },

  playbackHistory : function() {
    var h = this.history;
    this.recordHistory = false;
    this.setupEmptyState();
    var oidx = this.historyIndex;
    var i=0;
    var self = this;
    var ival = setInterval(function() {
      if (i > oidx) {
        clearInterval(ival);
        self.recordHistory = true;
      } else {
        var t = new Date();
        var j = i;
        while (new Date() - t < 30 && i <= oidx && (i-j) < self.playbackRate*10) {
          var cmd = h[i];
          if (cmd != null)
            self.applyHistoryState(cmd);
          i++;
        }
        if (window.console) {
          console.log(
            'Played back '+(i-j)+' events at a rate of ' +
            Math.floor(1000*(i-j) / (new Date()-t)) +
            ' events per second'
          );
        }
      }
    }, 10);
  }
});
