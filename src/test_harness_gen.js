TestHarnessGen = Klass({

  initialize : function() {
    this.knownProperties = {};
    this.knownMethods = {};
    this.knownSignatures = {};
  },
  
  generateKlassTests : function(klass, name) {
    var props = this.parseKlass(klass);
    var self = this;
    var str = [
      "run_tests : function() {\n"+
      "  for (var i in this) {\n"+
      "    if (/^test_/.test(i)) {\n"+
      "      var __obj = new "+name+"(args);\n"+
      "      this[i](__obj);\n"+
      "    }\n"+
      "  }\n"+
      "}"
    ].concat(props.methods.map(function(t){return self.generateMethodTest(t); }))
    .join(",\n\n");
    return "Test_"+name+" = {\n" + str + "\n};";
  },

  extractVarProperties : function(param, function_text) {
    var param_re_str = '\\b'+param+'(\\[|\\.)([a-zA-Z0-9_]+)(\\])?(\\([^)]*\\))?(\\s*=[^=])?';
    var matches = function_text.match(new RegExp(param_re_str, 'g'));
    if (matches == null)
      matches = [];
    var re = new RegExp(param_re_str);
    var methodHash = {};
    var propertyHash = {};
    var methods = [];
    var properties = [];
    for (var i=0; i<matches.length; i++) {
      var match = matches[i].match(re);
      var name = match[2];
      var iterated = match[3];
      var args = match[4];
      var modified = match[5];
      if (args != null) {
        var m = methodHash[name];
        if (!m) {
          m = methodHash[name] = {name: name, calls: []};
          methods.push(m);
        }
        m.calls.push(args);
        if (modified) m.modified = true;
        if (iterated) m.iterated = true;
      } else {
        var m = methodHash[name];
        if (!m) {
          m = propertyHash[name] = {name: name};
          properties.push(m);
        }
        if (modified) m.modified = true;
        if (iterated) m.iterated = true;
      }
    }
    for (var i in methodHash) {
      var m = methodHash[i];
      m.calls = m.calls.unique();
      if (propertyHash[i] && !propertyHash[i].iterated) {
        m.usedAsProperty = true;
        m.modified = m.modified || propertyHash[i].modified;
        delete propertyHash[i];
      }
    }
    return {methods: methodHash, properties: propertyHash};
  },

  generateParamTest : function(param, function_text) {
    var tests = [];
    var call_re_str = '\\b'+param+'\\s*\\([^)]*\\)';
    var call_re = new RegExp(call_re_str);
    var calls = function_text.match(new RegExp(call_re_str, 'g'));
    if (calls) {
      calls = calls.unique();
      for (var i=0; i<calls.length; i++) {
        tests.push('  // '+calls[i]+'; // called as a function');
      }
    }
    var props = this.extractVarProperties(param, function_text);
    var ms = props.methods;
    var ps = props.properties;
    for (var i in ms) {
      var m = ms[i];
      if (m.iterated) {
        tests.push('  // METHOD '+param+'['+m.name+'] is iterated' + (m.modified ? ' and MODIFIED!' : ''));
        for (var j=0; j<m.calls.length; j++)
          tests.push('  // '+param+'.'+m.name+m.calls[j]+';');
      } else {
        if (m.modified)
          tests.push('  // METHOD '+param+'.'+m.name+' is MODIFIED!');
        if (m.usedAsProperty)
          tests.push('  // '+param+'.'+m.name+' is used as a property as well as method');
        for (var j=0; j<m.calls.length; j++)
          tests.push('  '+param+'.'+m.name+m.calls[j]+';');
      }
    }
    for (var i in ps) {
      var m = ps[i];
      if (m.iterated) {
        tests.push('  // '+param+'['+m.name+'] is iterated' + (m.modified ? ' and modified' : ''));
      } else {
        tests.push('  '+param+'.'+m.name+'; // is accessed' + (m.modified ? ' and modified' : ''));
      }
    }
    return tests.join('\n');
  },

  generateMethodTest : function(m, opt_objName) {
    var objName = opt_objName || "__obj";
    var call = "  "+objName+"."+m.name;
    var callW = function(p) { return call+"("+p+");"; };
    var test_header = ["test_", m.name, " : function("+objName+") {"].join("");
    var test_footer = "}";
    var arity_test = '';
    var normal_test = '';
    var return_test = '';
    var args = '';
    var function_text = m.value.toString();
    var m = function_text.match(/function\s*[a-zA-Z0-9_]*\([^)]*\) \{ \[native code\] \}/);
    var self = this;
    if (m && m[0] == function_text) {
      args += "  // Native code function";
    } else {
      var params = function_text.match(/\(([^)]*)\)/)[1].split(/\s*,\s*/);
      args += '  // Call signature: '+callW(params)+'\n';
      params = params.filter(function(p){ return (/\S/).test(p); });
      if ((/\barguments\b/).test(function_text) && (params.length == 0 || (params.length == 1 && params[0] == 'var_args'))) {
        arity_test += callW("1") + " // variable args";
        arity_test += "\n"+callW("1, 2") + " // variable args";
        arity_test += "\n"+callW("1, 2, 3") + " // variable args";
      } else {
        if (params.length > 0)
          args += '  // Call argument definitions\n';
        args += params.map(function(p) { 
          var pt = self.generateParamTest(p, function_text);
          return "  var "+p+" = null;" + (pt != '' ? '\n'+pt : ''); 
        }).join("\n");
        normal_test = '\n'+callW(params.join(", ")) + ' // valid call';
        arity_test = '  var extraArg = true;\n'+callW(params.concat(['extraArg']).join(", ")) + " // too many args";
        if (params.length > 0) {
          arity_test += "\n  assert_fail(function(){"+callW(params.slice(0,-1).join(", ")) + " }); // too few args";
        }
        if ((/\barguments\b/).test(function_text)) {
          arity_test += "\n"+callW("1") + " // variable args";
          arity_test += "\n"+callW("1, 2") + " // variable args";
          arity_test += "\n"+callW("1, 2, 3") + " // variable args";
        }
      }
      return_test = [
        "\n  var rv = "+callW(params.join(",")).slice(2) + ' // return value test',
        ((/\breturn\b/).test(function_text)
          ? "  assert('non-null return value', rv != null);"
          : "  assert('null return value', rv == null);")
      ].join("\n");
    }
    var test = ([
      test_header,
      args,
      normal_test,
      arity_test,
      return_test,
      test_footer
    ]).join("\n").replace(/(\n *\n *)(\n *)+/gm, '\n\n  ');
    return test;
  },

  parseKlass : function(klass) {
    var methods = [];
    var properties = [];
    for (var i in klass) {
      if (typeof klass[i] == 'function') {
        methods.push({name:i, value:klass[i]});
      } else {
        properties.push({name:i, value:klass[i]});
      }
    }
    return {methods:methods, properties:properties};
  }
});
