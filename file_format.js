/**
  JSON file format,
  ~70 bytes per event uncompressed. ~4 bytes per event gzipped.

  In other words, 14 MB/hour of drawing uncompressed, 800 kB/hour gzipped.

  The file format starts with a 8-byte version header
  SRBL,0,1
  followed by a JSON object that's directly usable as a Scribble saveObject.
*/
JSONDrawHistorySerializer = Klass({
  magic: 'SRBL',
  majorVersion: 0,
  minorVersion: 1,

  extension: 'jsrbl',

  initialize : function() {},

  getVersionTag : function() {
    return [this.magic, this.majorVersion, this.minorVersion].join(",")
  },

  serialize : function(history) {
    return [this.getVersionTag(), this.serializeBody(history)].join("");
  },

  canDeserialize : function(string) {
    var t = this.getVersionTag();
    return (string.substring(0, t.length) == t);
  },

  deserialize : function(string) {
    if (!this.canDeserialize(string))
      throw (new Error("Unknown version tag"));
    var t = this.getVersionTag();
    return this.deserializeBody(string.substring(t.length));
  },

  serializeBody : function(history) {
    return JSON.stringify(history);
  },

  deserializeBody : function(history) {
    return JSON.parse(history);
  }
});

OldJSONDrawHistorySerializer = Klass(JSONDrawHistorySerializer, {
  magic: 'SRBL',
  majorVersion: 0,
  minorVersion: 0,

  extension: 'jsrbl',

  getVersionTag : function() {
    return [this.magic, this.majorVersion, this.minorVersion, ''].join(",")
  }
});

/**
  Binary file format for Scribble event history.
  ~2.5 bytes per event uncompressed. ~0.6 bytes per event gzipped.

  In other words, 500 kB/hour uncompressed, 120 kB/hour gzipped.

  The file format starts with a 8-byte version header
  SRBL,1,1
  followed by the file body, encoding a Scribble saveObject:

  Offset Type    Name
       8 uint16  width
      10 uint16  height
      12 uint32  historyIndex
      16 history history

  All integers are stored in big-endian byte order.
  Floats are stored as little-endian IEEE 754.

  The history object is serialized as a stream of command, arguments -pairs.
  Commands are uint8s with the following mapping:

  Code Method name
     0 drawPoint
     1 drawLine
     2 clear
     3 setColor
     4 setBackground
     5 setLineCap
     6 setLineWidth
     7 setOpacity
     8 setPaletteColor

  Arguments are stored differently for each command:

  Method name     Argument format     Argument length in bytes
  drawPoint       [int16 x, int16 y]  8
  drawLine        [delta_encoded]     variable
  clear           []                  0
  setColor        [color]             16
  setBackground   [color]             16
  setLineCap      [lineCap]           1
  setLineWidth    [float32]           4
  setOpacity      [color_component]   4
  setPaletteColor [uint16 idx, color] 18

  Color components are stored as 32-bit floats with 0..1 range.
  Colors are stored as four color components in RGBA order.

  LineCap is stored as a uint8 with the following mapping:
  Code LineCap
     0 round
     1 square
     2 flat

  The arguments to drawLine are stored as a string of coordinate deltas,
  prefixed by its length:

  Offset Type         Name
       0 uint16       delta_string_length
       2 delta_string deltas

  The delta_string consists of two absolute coordinates given as pairs of int16,
  followed by a variable count of int8 coordinate delta pairs.

  Offset Type  Name
       0 int16 p0.x
       2 int16 p0.y
       4 int16 p1.x
       6 int16 p1.y
     [ 8 int8  p2.x-p1.x]
     [ 9 int8  p2.y-p1.y]
     [10 int8  p3.x-p2.x]
     [11 int8  p3.y-p2.y]
     [...]

  To convert the deltas back into drawLine [startPoint, endPoint] arguments:

  var args = [[p0, p1]];
  var prev = p1;
  for (var i=8; i<string.length; i+=2) {
    var dx = readInt8(string, i);
    var dy = readInt8(string, i+1);
    var cur = {x:prev.x+dx, y:prev.y+dy};
    args.push([prev, cur]);
    prev = cur;
  }

  Float reading and encoding code courtesy of
  https://github.com/pgriess/node-jspack
  Thanks a bunch!
*/
BinaryDrawHistorySerializer = Klass(JSONDrawHistorySerializer, {
  extension: 'srbl',

  commands : [
    'drawPoint',
    'drawLine',
    'clear',
    'setColor',
    'setBackground',
    'setLineCap',
    'setLineWidth',
    'setOpacity',
    'setPaletteColor'
  ],
  lineCaps : [
    'round',
    'square',
    'flat'
  ],
  breakpointMethod : {
    'drawPoint' : true,
    'clear' : true,
    'setPaletteColor' : true
  },
  majorVersion: 1,
  minorVersion: 2,

  canDeserialize : function(string) {
    var t = this.getVersionTag();
    var head = string.substring(0, t.length);
    var ok = (head == t);
    var mv = this.minorVersion;
    while (!ok && this.minorVersion > 1) {
      this.minorVersion--;
      ok = (head == this.getVersionTag());
    }
    this.minorVersion = mv;
    return ok;
  },

  initialize : function() {
    this.commandCodes = {};
    for (var i=0; i<this.commands.length; i++) {
      this.commandCodes[this.commands[i]] = i;
    }
    this.lineCapCodes = {};
    for (var i=0; i<this.lineCaps.length; i++) {
      this.lineCapCodes[this.lineCaps[i]] = i;
    }
  },

  serializeBody : function(saveObj) {
    var history = saveObj.history;
    var output = [
      this.encodeUInt16(saveObj.width),
      this.encodeUInt16(saveObj.height),
      this.encodeUInt32(saveObj.historyIndex)
    ];
    for (var i=0; i<history.length; i++) {
      var e = history[i];
      var cmd = this.commandCodes[e.methodName];
      if (e.methodName == 'drawLine') {
        // delta-encode a string of drawLine actions
        var coords = [e.args[0], e.args[1]];
        e = history[i+1];
        while (e && e.methodName == 'drawLine') {
          if (this.canDeltaEncode(coords, e.args, e.breakpoint))
            coords.push(e.args[1]);
          else
            break;
          i++;
          e = history[i+1];
        }
        var deltaString = this.deltaEncode(coords);
        output.push(this.encodeUInt8(cmd), this.encodeUInt16(deltaString.length), deltaString);
        continue;
      } else {
        var args = this.encodeArgs(e.methodName, e.args);
        output.push(this.encodeUInt8(cmd), args);
      }
    }
    return output.join("");
  },

  deserializeBody : function(string) {
    var saveObj = {};
    var output = [];
    var obj = {};
    saveObj.width = this.readUInt16(string, 0);
    saveObj.height = this.readUInt16(string, 2);
    saveObj.historyIndex = this.readUInt32(string, 4);
    saveObj.history = output;
    for (var i=8; i<string.length;) {
      i += this.readCommand(string, i, obj);
      if (obj.methodName == 'drawLine') {
        var coords = this.decodeDeltas(obj.args[0]);
        for (var j=0; j<coords.length; j++) {
          output.push({methodName: 'drawLine', args: coords[j]});
        }
        if (coords.length == 1) {
          output.last().breakpoint = true;
        }
      } else {
        var o = {methodName: obj.methodName, args: obj.args};
        if (this.breakpointMethod[obj.methodName])
          o.breakpoint = true;
        output.push(o);
      }
    }
    return saveObj;
  },

  readCommand : function(string, offset, obj) {
    var cmd = this.readUInt8(string, offset);
    var methodName = this.commands[cmd];
    var args = [];
    var arglen = this.readArgs(methodName, args, string, offset+1);
    obj.methodName = methodName;
    obj.args = args;
    return 1 + arglen;
  },

  encodeArgs : function(methodName, args) {
    switch (methodName) {
      case 'setColor':
      case 'setBackground':
        return this.encodeColor(args[0]);
      case 'setPaletteColor':
        return [this.encodeUInt16(args[0]), this.encodeColor(args[1])].join('');
      case 'setLineWidth':
        return this.encodeFloat32(args[0]);
      case 'setLineCap':
        return this.encodeUInt8(this.lineCapCodes[args[0]]);
      case 'setOpacity':
        return this.encodeColorComponent(args[0]);
      case 'clear':
        return '';
      case 'drawPoint':
        return [
          this.encodeInt16(args[0].x),
          this.encodeInt16(args[0].y)
        ].join('');
      case 'drawLine': throw (new Error("encodeArgs: called with drawLine"));
      default: throw (new Error("encodeArgs: unknown method "+methodName));
    }
  },

  readArgs : function(methodName, args, string, offset) {
    switch (methodName) {
      case 'setColor':
      case 'setBackground':
        args.push(this.readColor(string, offset));
        return 16;
      case 'setPaletteColor':
        args.push(this.readUInt16(string, offset));
        args.push(this.readColor(string, offset+2));
        return 18;
      case 'setLineWidth':
        args.push(this.readFloat32(string, offset));
        return 4;
      case 'setLineCap':
        args.push(this.lineCaps[this.readUInt8(string, offset)]);
        return 1;
      case 'setOpacity':
        args.push(this.readColorComponent(string, offset));
        return 4;
      case 'clear':
        return 0;
      case 'drawPoint':
        var x = this.readInt16(string, offset);
        var y = this.readInt16(string, offset+2);
        args.push({x:x, y:y});
        return 4;
      case 'drawLine':
        var len = this.readUInt16(string, offset);
        args.push(string.substring(offset+2, offset+2+len));
        return 2+len;
      default: throw (new Error("readArgs: unknown method "+methodName));
    }
  },

  encodeColor : function(rgba) {
    var self = this;
    return rgba.map(function(c){
      return self.encodeColorComponent(c);
    }).join('');
  },

  readColor : function(string, offset) {
    return [
      this.readColorComponent(string, offset),
      this.readColorComponent(string, offset+4),
      this.readColorComponent(string, offset+8),
      this.readColorComponent(string, offset+12)
    ];
  },

  encodeColorComponent : function(c) {
    return this.encodeFloat32(c);
  },

  readColorComponent : function(string, offset) {
    return this.readFloat32(string, offset);
  },

  canDeltaEncode : function(coords, args, breakpoint) {
    var l = coords.last();
    return (
      !breakpoint &&
      coords.length < 32000 &&
      (l.x == args[0].x && l.y == args[0].y) &&
      (Math.abs(l.x-args[1].x) <= 127 && Math.abs(l.y-args[1].y) <= 127)
    );
  },

  deltaEncode : function(coords) {
    var base = coords[0];
    var base2 = coords[1];
    var deltas = [
      this.encodeInt16(base.x),this.encodeInt16(base.y),
      this.encodeInt16(base2.x),this.encodeInt16(base2.y)
    ];
    for (var i=2; i<coords.length; i++) {
      var prev = coords[i-1];
      var cur = coords[i];
      // these could be entropy-encoded
      deltas.push(this.encodeInt8(cur.x-prev.x), this.encodeInt8(cur.y-prev.y));
    }
    return deltas.join("");
  },

  decodeDeltas : function(string) {
    var offset = 0;
    var base = {}, base2 = {};
    base.x = this.readInt16(string, offset); offset += 2;
    base.y = this.readInt16(string, offset); offset += 2;
    base2.x = this.readInt16(string, offset); offset += 2;
    base2.y = this.readInt16(string, offset); offset += 2;
    var coords = [[base, base2]];
    var prev = base2;
    while (offset < string.length) {
      var c = {};
      c.x = prev.x + this.readInt8(string, offset); offset++;
      c.y = prev.y + this.readInt8(string, offset); offset++;
      coords.push([prev, c]);
      prev = c;
    }
    return coords;
  },

  encodeInt8 : function(i) {
    return String.fromCharCode((i+0x80) & 0xFF);
  },

  encodeUInt8 : function(i) {
    return String.fromCharCode((i) & 0xFF);
  },

  encodeInt16 : function(i) {
    var c = (i+0x8000) & 0xFFFF;
    return [
      String.fromCharCode(c >> 8),
      String.fromCharCode(c & 0xFF)
    ].join('');
  },

  encodeUInt16 : function(i) {
    var c = i & 0xFFFF;
    return [
      String.fromCharCode(c >> 8),
      String.fromCharCode(c & 0xFF)
    ].join('');
  },

  encodeInt32 : function(i) {
    var c = (i+0x80000000) & 0xFFFFFFFF;
    return [
      String.fromCharCode((c >> 24) & 0xFF),
      String.fromCharCode((c >> 16) & 0xFF),
      String.fromCharCode((c >> 8) & 0xFF),
      String.fromCharCode(c & 0xFF)
    ].join('');
  },

  encodeUInt32 : function(i) {
    var c = (i) & 0xFFFFFFFF;
    return [
      String.fromCharCode((c >> 24) & 0xFF),
      String.fromCharCode((c >> 16) & 0xFF),
      String.fromCharCode((c >> 8) & 0xFF),
      String.fromCharCode(c & 0xFF)
    ].join('');
  },

  readInt8 : function(data, offset) {
    return (data.charCodeAt(offset) & 0xFF) - 0x80;
  },

  readUInt8 : function(data, offset) {
    return (data.charCodeAt(offset) & 0xFF);
  },

  readInt16 : function(data, offset) {
    return (
      (((data.charCodeAt(offset) & 0xFF) - 0x80) << 8) +
      (data.charCodeAt(offset+1) & 0xFF)
    );
  },

  readUInt16 : function(data, offset) {
    return (
      ((data.charCodeAt(offset) & 0xFF) << 8) +
      (data.charCodeAt(offset+1) & 0xFF)
    );
  },

  readInt32 : function(data, offset) {
    return (
      (((data.charCodeAt(offset) & 0xFF) - 0x80) << 24) +
      ((data.charCodeAt(offset+1) & 0xFF) << 16) +
      ((data.charCodeAt(offset+2) & 0xFF) << 8) +
      (data.charCodeAt(offset+3) & 0xFF)
    );
  },

  readUInt32 : function(data, offset) {
    return (
      (((data.charCodeAt(offset) & 0xFF)) * 0x01000000) +
      ((data.charCodeAt(offset+1) & 0xFF) << 16) +
      ((data.charCodeAt(offset+2) & 0xFF) << 8) +
      (data.charCodeAt(offset+3) & 0xFF)
    );
  },

  // Little-endian N-bit IEEE 754 floating point
  readFloat32 : function (data, offset)
  {
    var a = [
      (data.charCodeAt(offset) & 0xFF),
      (data.charCodeAt(offset+1) & 0xFF),
      (data.charCodeAt(offset+2) & 0xFF),
      (data.charCodeAt(offset+3) & 0xFF)
    ], p = 0;
    var s, e, m, i, d, nBits, mLen, eLen, eBias, eMax;
    mLen = 23, eLen = 4*8-23-1, eMax = (1<<eLen)-1, eBias = eMax>>1;
    var bBE = -1;

    i = bBE?0:(4-1); d = bBE?1:-1; s = a[p+i]; i+=d; nBits = -7;
    for (e = s&((1<<(-nBits))-1), s>>=(-nBits), nBits += eLen; nBits > 0; e=e*256+a[p+i], i+=d, nBits-=8);
    for (m = e&((1<<(-nBits))-1), e>>=(-nBits), nBits += mLen; nBits > 0; m=m*256+a[p+i], i+=d, nBits-=8);

    switch (e)
    {
      case 0:
        // Zero, or denormalized number
        e = 1-eBias;
        break;
      case eMax:
        // NaN, or +/-Infinity
        return m?NaN:((s?-1:1)*Infinity);
      default:
        // Normalized number
        m = m + Math.pow(2, mLen);
        e = e - eBias;
        break;
    }
    return (s?-1:1) * m * Math.pow(2, e-mLen);
  },

  encodeFloat32 : function (v)
  {
    var a = [0,0,0,0], p = 0;
    var s, e, m, i, d, c, mLen, eLen, eBias, eMax;
    mLen = 23, eLen = 4*8-23-1, eMax = (1<<eLen)-1, eBias = eMax>>1;
    var bBE = -1;

    s = v<0?1:0;
    v = Math.abs(v);
    if (isNaN(v) || (v == Infinity))
    {
      m = isNaN(v)?1:0;
      e = eMax;
    }
    else
    {
      e = Math.floor(Math.log(v)/Math.LN2); // Calculate log2 of the value
      if (v*(c = Math.pow(2, -e)) < 1) { e--; c*=2; } // Math.log() isn't 100% reliable
      var rt = Math.pow(2, -24)-Math.pow(2, -77);

      // Round by adding 1/2 the significand's LSD
      if (e+eBias >= 1) { v += rt/c; } // Normalized: mLen significand digits
      else { v += rt*Math.pow(2, 1-eBias); } // Denormalized: <= mLen significand digits
      if (v*c >= 2) { e++; c/=2; } // Rounding can increment the exponent

      if (e+eBias >= eMax)
      {
        // Overflow
        m = 0;
        e = eMax;
      }
      else if (e+eBias >= 1)
      {
        // Normalized - term order matters, as Math.pow(2, 52-e) and v*Math.pow(2, 52) can overflow
        m = (v*c-1)*Math.pow(2, mLen);
        e = e + eBias;
      }
      else
      {
        // Denormalized - also catches the '0' case, somewhat by chance
        m = v*Math.pow(2, eBias-1)*Math.pow(2, mLen);
        e = 0;
      }
    }

    for (i = bBE?(4-1):0, d=bBE?-1:1; mLen >= 8; a[p+i]=m&0xff, i+=d, m/=256, mLen-=8);
    for (e=(e<<mLen)|m, eLen+=mLen; eLen > 0; a[p+i]=e&0xff, i+=d, e/=256, eLen-=8);
    a[p+i-d] |= s*128;

    return [
      String.fromCharCode(a[0]),
      String.fromCharCode(a[1]),
      String.fromCharCode(a[2]),
      String.fromCharCode(a[3])
    ].join('');
  }


});


OldBinaryDrawHistorySerializer = Klass(BinaryDrawHistorySerializer, {
  majorVersion: 1,
  minorVersion: 0,

  getVersionTag : function() {
    return [this.magic, this.majorVersion, this.minorVersion, ''].join(",")
  },

  serializeBody : function(saveObj) {
    var history = saveObj.history;
    var output = [
      this.encodeInt16(saveObj.width),
      this.encodeInt16(saveObj.height),
      this.encodeInt32(saveObj.historyIndex)
    ];
    for (var i=0; i<history.length; i++) {
      var e = history[i];
      var cmd = this.commandCodes[e.methodName];
      if (e.methodName == 'drawLine') {
        // delta-encode a string of drawLine actions
        var coords = [e.args[0], e.args[1]];
        e = history[i+1];
        while (e && e.methodName == 'drawLine') {
          if (this.canDeltaEncode(coords, e.args, e.breakpoint))
            coords.push(e.args[1]);
          else
            break;
          i++;
          e = history[i+1];
        }
        var deltaString = this.deltaEncode(coords);
        output.push(this.encodeUInt8(cmd), this.encodeUInt16(deltaString.length), deltaString);
        continue;
      } else {
        var args = this.encodeArgs(e.methodName, e.args);
        output.push(this.encodeUInt8(cmd), args);
      }
    }
    return output.join("");
  },

  deserializeBody : function(string) {
    var saveObj = {};
    var output = [];
    var obj = {};
    saveObj.width = this.readInt16(string, 0);
    saveObj.height = this.readInt16(string, 2);
    saveObj.historyIndex = this.readInt32(string, 4);
    saveObj.history = output;
    for (var i=8; i<string.length;) {
      i += this.readCommand(string, i, obj);
      if (obj.methodName == 'drawLine') {
        var coords = this.decodeDeltas(obj.args[0]);
        for (var j=0; j<coords.length; j++) {
          output.push({methodName: 'drawLine', args: coords[j]});
        }
        if (coords.length == 1) {
          output.last().breakpoint = true;
        }
      } else {
        var o = {methodName: obj.methodName, args: obj.args};
        if (this.breakpointMethod[obj.methodName])
          o.breakpoint = true;
        output.push(o);
      }
    }
    return saveObj;
  },

  encodeArgs : function(methodName, args) {
    switch (methodName) {
      case 'setColor':
      case 'setBackground':
        return this.encodeColor(args[0]);
      case 'setLineWidth':
        return this.encodeUInt16(args[0]*4);
      case 'setLineCap':
        return this.encodeUInt8(this.lineCapCodes[args[0]]);
      case 'setOpacity':
        return this.encodeColorComponent(args[0]);
      case 'clear':
        return '';
      case 'drawPoint':
        return [
          this.encodeInt16(args[0].x),
          this.encodeInt16(args[0].y)
        ].join('');
      case 'drawLine': throw (new Error("encodeArgs: called with drawLine"));
      default: throw (new Error("encodeArgs: unknown method "+methodName));
    }
  },

  readArgs : function(methodName, args, string, offset) {
    switch (methodName) {
      case 'setColor':
      case 'setBackground':
        args.push(this.readColor(string, offset));
        return 16;
      case 'setLineWidth':
        args.push(this.readUInt16(string, offset)/4);
        return 2;
      case 'setLineCap':
        args.push(this.lineCaps[this.readUInt8(string, offset)]);
        return 1;
      case 'setOpacity':
        args.push(this.readColorComponent(string, offset));
        return 4;
      case 'clear':
        return 0;
      case 'drawPoint':
        var x = this.readInt16(string, offset);
        var y = this.readInt16(string, offset+2);
        args.push({x:x, y:y});
        return 4;
      case 'drawLine':
        var len = this.readUInt16(string, offset);
        args.push(string.substring(offset+2, offset+2+len));
        return 2+len;
      default: throw (new Error("readArgs: unknown method "+methodName));
    }
  },

  encodeColor : function(rgba) {
    var self = this;
    return rgba.map(function(c){
      return self.encodeColorComponent(c);
    }).join('');
  },

  readColor : function(string, offset) {
    return [
      this.readColorComponent(string, offset),
      this.readColorComponent(string, offset+4),
      this.readColorComponent(string, offset+8),
      this.readColorComponent(string, offset+12)
    ];
  },

  encodeColorComponent : function(c) {
    return this.encodeInt32(Math.round((c-0.5)*0x8000));
  },

  readColorComponent : function(string, offset) {
    return this.readInt32(string, offset) / 0x8000 + 0.5;
  }
});




ScribbleFile = {

  serializers : [
    BinaryDrawHistorySerializer,
    OldBinaryDrawHistorySerializer,
    JSONDrawHistorySerializer,
    OldJSONDrawHistorySerializer
  ],

  defaultSerializer : JSONDrawHistorySerializer,

  stringify: function(saveObj) {
    var s = new this.defaultSerializer();
    return s.serialize(saveObj);
  },

  parse: function(string) {
    for (var i=0; i<this.serializers.length; i++) {
      var s = this.serializers[i];
      if (s.canDeserialize(string))
        return s.deserialize(string);
    }
  }

};
