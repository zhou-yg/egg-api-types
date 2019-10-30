import Interpreter from './core';

/**
 * Initialize the global scope with buitin properties and functions.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initGlobalScope = function (scope) {
  // Initialize uneditable global properties.
  this.setProperty(scope, 'NaN', NaN,
    Interpreter.READONLY_DESCRIPTOR);
  this.setProperty(scope, 'Infinity', Infinity,
    Interpreter.READONLY_DESCRIPTOR);
  this.setProperty(scope, 'undefined', undefined,
    Interpreter.READONLY_DESCRIPTOR);
  this.setProperty(scope, 'window', scope,
    Interpreter.READONLY_DESCRIPTOR);
  this.setProperty(scope, 'this', scope,
    Interpreter.READONLY_DESCRIPTOR);
  this.setProperty(scope, 'self', scope); // Editable.

  // Create the objects which will become Object.prototype and
  // Function.prototype, which are needed to bootstrap everything else.
  this.OBJECT_PROTO = new Interpreter.Object(null);
  this.FUNCTION_PROTO = new Interpreter.Object(this.OBJECT_PROTO);
  // Initialize global objects.
  this.initFunction(scope);
  this.initObject(scope);
  // Unable to set scope's parent prior (OBJECT did not exist).
  // Note that in a browser this would be 'Window', whereas in Node.js it would
  // be 'Object'.  This interpreter is closer to Node in that it has no DOM.
  scope.proto = this.OBJECT_PROTO;
  this.setProperty(scope, 'constructor', this.OBJECT,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.initArray(scope);
  this.initString(scope);
  this.initBoolean(scope);
  this.initNumber(scope);
  this.initDate(scope);
  this.initRegExp(scope);
  this.initError(scope);
  this.initMath(scope);
  this.initJSON(scope);

  // Initialize global functions.
  var thisInterpreter = this;
  var func = this.createNativeFunction(
    function (x) { throw EvalError("Can't happen"); }, false);
  func.eval = true;
  this.setProperty(scope, 'eval', func);

  this.setProperty(scope, 'parseInt',
    this.createNativeFunction(parseInt, false));
  this.setProperty(scope, 'parseFloat',
    this.createNativeFunction(parseFloat, false));

  this.setProperty(scope, 'isNaN',
    this.createNativeFunction(isNaN, false));

  this.setProperty(scope, 'isFinite',
    this.createNativeFunction(isFinite, false));

  var strFunctions = [
    [escape, 'escape'], [unescape, 'unescape'],
    [decodeURI, 'decodeURI'], [decodeURIComponent, 'decodeURIComponent'],
    [encodeURI, 'encodeURI'], [encodeURIComponent, 'encodeURIComponent']
  ];
  for (var i = 0; i < strFunctions.length; i++) {
    var wrapper = (function (nativeFunc) {
      return function (str) {
        try {
          return nativeFunc(str);
        } catch (e) {
          // decodeURI('%xy') will throw an error.  Catch and rethrow.
          thisInterpreter.throwException(thisInterpreter.URI_ERROR, e.message);
        }
      };
    })(strFunctions[i][0]);
    this.setProperty(scope, strFunctions[i][1],
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
  // Preserve publicly properties from being pruned/renamed by JS compilers.
  // Add others as needed.
  this['OBJECT'] = this.OBJECT; this['OBJECT_PROTO'] = this.OBJECT_PROTO;
  this['FUNCTION'] = this.FUNCTION; this['FUNCTION_PROTO'] = this.FUNCTION_PROTO;
  this['ARRAY'] = this.ARRAY; this['ARRAY_PROTO'] = this.ARRAY_PROTO;
  this['REGEXP'] = this.REGEXP; this['REGEXP_PROTO'] = this.REGEXP_PROTO;
  this['DATE'] = this.DATE; this['DATE_PROTO'] = this.DATE_PROTO;
  // The following properties are obsolete.  Do not use.
  this['UNDEFINED'] = undefined; this['NULL'] = null; this['NAN'] = NaN;
  this['TRUE'] = true; this['FALSE'] = false; this['STRING_EMPTY'] = '';
  this['NUMBER_ZERO'] = 0; this['NUMBER_ONE'] = 1;

  // Run any user-provided initialization.
  if (this.initFunc_) {
    this.initFunc_(this, scope);
  }
};

/**
 * Initialize the Function class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initFunction = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  var identifierRegexp = /^[A-Za-z_$][\w$]*$/;
  // Function constructor.
  wrapper = function (var_args) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Function().
      var newFunc = this;
    } else {
      // Called as Function().
      var newFunc =
        thisInterpreter.createObjectProto(thisInterpreter.FUNCTION_PROTO);
    }
    if (arguments.length) {
      var code = String(arguments[arguments.length - 1]);
    } else {
      var code = '';
    }
    var argsStr = Array.prototype.slice.call(arguments, 0, -1).join(',').trim();
    if (argsStr) {
      var args = argsStr.split(/\s*,\s*/);
      for (var i = 0; i < args.length; i++) {
        var name = args[i];
        if (!identifierRegexp.test(name)) {
          thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
            'Invalid function argument: ' + name);
        }
      }
      argsStr = args.join(', ');
    }
    // Interestingly, the scope for constructed functions is the global scope,
    // even if they were constructed in some other scope.
    newFunc.parentScope = thisInterpreter.global;
    // Acorn needs to parse code in the context of a function or else 'return'
    // statements will be syntax errors.
    try {
      var ast = acorn.parse('(function(' + argsStr + ') {' + code + '})',
        Interpreter.PARSE_OPTIONS);
    } catch (e) {
      // Acorn threw a SyntaxError.  Rethrow as a trappable error.
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
        'Invalid code: ' + e.message);
    }
    if (ast['body'].length !== 1) {
      // Function('a', 'return a + 6;}; {alert(1);');
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR,
        'Invalid code in function body.');
    }
    newFunc.node = ast['body'][0]['expression'];
    thisInterpreter.setProperty(newFunc, 'length', newFunc.node['length'],
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
    return newFunc;
  };
  wrapper.id = this.functionCounter_++;
  this.FUNCTION = this.createObjectProto(this.FUNCTION_PROTO);

  this.setProperty(scope, 'Function', this.FUNCTION);
  // Manually setup type and prototype because createObj doesn't recognize
  // this object as a function (this.FUNCTION did not exist).
  this.setProperty(this.FUNCTION, 'prototype', this.FUNCTION_PROTO,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.FUNCTION.nativeFunc = wrapper;

  // Configure Function.prototype.
  this.setProperty(this.FUNCTION_PROTO, 'constructor', this.FUNCTION,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.FUNCTION_PROTO.nativeFunc = function () { };
  this.FUNCTION_PROTO.nativeFunc.id = this.functionCounter_++;
  this.setProperty(this.FUNCTION_PROTO, 'length', 0,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);

  var boxThis = function (value) {
    // In non-strict mode 'this' must be an object.
    if ((!value || !value.isObject) && !thisInterpreter.getScope().strict) {
      if (value === undefined || value === null) {
        // 'Undefined' and 'null' are changed to global object.
        value = thisInterpreter.global;
      } else {
        // Primitives must be boxed in non-strict mode.
        var box = thisInterpreter.createObjectProto(
          thisInterpreter.getPrototype(value));
        box.data = value;
        value = box;
      }
    }
    return value;
  };

  wrapper = function (thisArg, args) {
    var state =
      thisInterpreter.stateStack[thisInterpreter.stateStack.length - 1];
    // Rewrite the current 'CallExpression' to apply a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = boxThis(thisArg);
    // Bind any provided arguments.
    state.arguments_ = [];
    if (args !== null && args !== undefined) {
      if (args.isObject) {
        state.arguments_ = thisInterpreter.arrayPseudoToNative(args);
      } else {
        thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
          'CreateListFromArrayLike called on non-object');
      }
    }
    state.doneExec_ = false;
  };
  this.setNativeFunctionPrototype(this.FUNCTION, 'apply', wrapper);

  wrapper = function (thisArg /*, var_args */) {
    var state =
      thisInterpreter.stateStack[thisInterpreter.stateStack.length - 1];
    // Rewrite the current 'CallExpression' to call a different function.
    state.func_ = this;
    // Assign the 'this' object.
    state.funcThis_ = boxThis(thisArg);
    // Bind any provided arguments.
    state.arguments_ = [];
    for (var i = 1; i < arguments.length; i++) {
      state.arguments_.push(arguments[i]);
    }
    state.doneExec_ = false;
  };
  this.setNativeFunctionPrototype(this.FUNCTION, 'call', wrapper);

  this.polyfills_.push(
    // Polyfill copied from:
    // developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind
    "Object.defineProperty(Function.prototype, 'bind',",
    "{configurable: true, writable: true, value:",
    "function(oThis) {",
    "if (typeof this !== 'function') {",
    "throw TypeError('What is trying to be bound is not callable');",
    "}",
    "var aArgs   = Array.prototype.slice.call(arguments, 1),",
    "fToBind = this,",
    "fNOP    = function() {},",
    "fBound  = function() {",
    "return fToBind.apply(this instanceof fNOP",
    "? this",
    ": oThis,",
    "aArgs.concat(Array.prototype.slice.call(arguments)));",
    "};",
    "if (this.prototype) {",
    "fNOP.prototype = this.prototype;",
    "}",
    "fBound.prototype = new fNOP();",
    "return fBound;",
    "}",
    "});",
    "");

  // Function has no parent to inherit from, so it needs its own mandatory
  // toString and valueOf functions.
  wrapper = function () {
    return String(this);
  };
  this.setNativeFunctionPrototype(this.FUNCTION, 'toString', wrapper);
  this.setProperty(this.FUNCTION, 'toString',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  wrapper = function () {
    return this.valueOf();
  };
  this.setNativeFunctionPrototype(this.FUNCTION, 'valueOf', wrapper);
  this.setProperty(this.FUNCTION, 'valueOf',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);
};

/**
 * Initialize the Object class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initObject = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // Object constructor.
  wrapper = function (value) {
    if (value === undefined || value === null) {
      // Create a new object.
      if (thisInterpreter.calledWithNew()) {
        // Called as new Object().
        return this;
      } else {
        // Called as Object().
        return thisInterpreter.createObjectProto(thisInterpreter.OBJECT_PROTO);
      }
    }
    if (!value.isObject) {
      // Wrap the value as an object.
      var box = thisInterpreter.createObjectProto(
        thisInterpreter.getPrototype(value));
      box.data = value;
      return box;
    }
    // Return the provided object.
    return value;
  };
  this.OBJECT = this.createNativeFunction(wrapper, true);
  // Throw away the created prototype and use the root prototype.
  this.setProperty(this.OBJECT, 'prototype', this.OBJECT_PROTO,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.OBJECT_PROTO, 'constructor', this.OBJECT,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(scope, 'Object', this.OBJECT);

  /**
   * Checks if the provided value is null or undefined.
   * If so, then throw an error in the call stack.
   * @param {Interpreter.Value} value Value to check.
   */
  var throwIfNullUndefined = function (value) {
    if (value === undefined || value === null) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        "Cannot convert '" + value + "' to object");
    }
  };

  // Static methods on Object.
  wrapper = function (obj) {
    throwIfNullUndefined(obj);
    var props = obj.isObject ? obj.properties : obj;
    return thisInterpreter.arrayNativeToPseudo(
      Object.getOwnPropertyNames(props));
  };
  this.setProperty(this.OBJECT, 'getOwnPropertyNames',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function (obj) {
    throwIfNullUndefined(obj);
    if (obj.isObject) {
      obj = obj.properties;
    }
    return thisInterpreter.arrayNativeToPseudo(Object.keys(obj));
  };
  this.setProperty(this.OBJECT, 'keys',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function (proto) {
    // Support for the second argument is the responsibility of a polyfill.
    if (proto === null) {
      return thisInterpreter.createObjectProto(null);
    }
    if (proto === undefined || !proto.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        'Object prototype may only be an Object or null');
    }
    return thisInterpreter.createObjectProto(proto);
  };
  this.setProperty(this.OBJECT, 'create',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Add a polyfill to handle create's second argument.
  this.polyfills_.push(
    "(function() {",
    "var create_ = Object.create;",
    "Object.create = function(proto, props) {",
    "var obj = create_(proto);",
    "props && Object.defineProperties(obj, props);",
    "return obj;",
    "};",
    "})();",
    "");

  wrapper = function (obj, prop, descriptor) {
    prop = String(prop);
    if (!obj || !obj.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        'Object.defineProperty called on non-object');
    }
    if (!descriptor || !descriptor.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        'Property description must be an object');
    }
    if (!obj.properties[prop] && obj.preventExtensions) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        "Can't define property '" + prop + "', object is not extensible");
    }
    // The polyfill guarantees no inheritance and no getter functions.
    // Therefore the descriptor properties map is the native object needed.
    thisInterpreter.setProperty(obj, prop, Interpreter.VALUE_IN_DESCRIPTOR,
      descriptor.properties);
    return obj;
  };
  this.setProperty(this.OBJECT, 'defineProperty',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.polyfills_.push(
    // Flatten the descriptor to remove any inheritance or getter functions.
    "(function() {",
    "var defineProperty_ = Object.defineProperty;",
    "Object.defineProperty = function(obj, prop, d1) {",
    "var d2 = {};",
    "if ('configurable' in d1) d2.configurable = d1.configurable;",
    "if ('enumerable' in d1) d2.enumerable = d1.enumerable;",
    "if ('writable' in d1) d2.writable = d1.writable;",
    "if ('value' in d1) d2.value = d1.value;",
    "if ('get' in d1) d2.get = d1.get;",
    "if ('set' in d1) d2.set = d1.set;",
    "return defineProperty_(obj, prop, d2);",
    "};",
    "})();",

    "Object.defineProperty(Object, 'defineProperties',",
    "{configurable: true, writable: true, value:",
    "function(obj, props) {",
    "var keys = Object.keys(props);",
    "for (var i = 0; i < keys.length; i++) {",
    "Object.defineProperty(obj, keys[i], props[keys[i]]);",
    "}",
    "return obj;",
    "}",
    "});",
    "");

  wrapper = function (obj, prop) {
    if (!obj || !obj.isObject) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR,
        'Object.getOwnPropertyDescriptor called on non-object');
    }
    prop = String(prop);
    if (!(prop in obj.properties)) {
      return undefined;
    }
    var descriptor = Object.getOwnPropertyDescriptor(obj.properties, prop);
    var getter = obj.getter[prop];
    var setter = obj.setter[prop];

    if (getter || setter) {
      descriptor.get = getter;
      descriptor.set = setter;
      delete descriptor.value;
      delete descriptor.writable;
    }
    // Preserve value, but remove it for the nativeToPseudo call.
    var value = descriptor.value;
    var hasValue = 'value' in descriptor;
    delete descriptor.value;
    var pseudoDescriptor = thisInterpreter.nativeToPseudo(descriptor);
    if (hasValue) {
      thisInterpreter.setProperty(pseudoDescriptor, 'value', value);
    }
    return pseudoDescriptor;
  };
  this.setProperty(this.OBJECT, 'getOwnPropertyDescriptor',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function (obj) {
    throwIfNullUndefined(obj);
    return thisInterpreter.getPrototype(obj);
  };
  this.setProperty(this.OBJECT, 'getPrototypeOf',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function (obj) {
    return Boolean(obj) && !obj.preventExtensions;
  };
  this.setProperty(this.OBJECT, 'isExtensible',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  wrapper = function (obj) {
    if (obj && obj.isObject) {
      obj.preventExtensions = true;
    }
    return obj;
  };
  this.setProperty(this.OBJECT, 'preventExtensions',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Object.
  this.setNativeFunctionPrototype(this.OBJECT, 'toString',
    Interpreter.Object.prototype.toString);
  this.setNativeFunctionPrototype(this.OBJECT, 'toLocaleString',
    Interpreter.Object.prototype.toString);
  this.setNativeFunctionPrototype(this.OBJECT, 'valueOf',
    Interpreter.Object.prototype.valueOf);

  wrapper = function (prop) {
    throwIfNullUndefined(this);
    if (!this.isObject) {
      return this.hasOwnProperty(prop);
    }
    return String(prop) in this.properties;
  };
  this.setNativeFunctionPrototype(this.OBJECT, 'hasOwnProperty', wrapper);

  wrapper = function (prop) {
    throwIfNullUndefined(this);
    if (!this.isObject) {
      return this.propertyIsEnumerable(prop);
    }
    return Object.prototype.propertyIsEnumerable.call(this.properties, prop);
  };
  this.setNativeFunctionPrototype(this.OBJECT, 'propertyIsEnumerable', wrapper);

  wrapper = function (obj) {
    while (true) {
      // Note, circular loops shouldn't be possible.
      obj = thisInterpreter.getPrototype(obj);
      if (!obj) {
        // No parent; reached the top.
        return false;
      }
      if (obj === this) {
        return true;
      }
    }
  };
  this.setNativeFunctionPrototype(this.OBJECT, 'isPrototypeOf', wrapper);
};

/**
 * Initialize the Array class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initArray = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // Array constructor.
  wrapper = function (var_args) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Array().
      var newArray = this;
    } else {
      // Called as Array().
      var newArray =
        thisInterpreter.createObjectProto(thisInterpreter.ARRAY_PROTO);
    }
    var first = arguments[0];
    if (arguments.length === 1 && typeof first === 'number') {
      if (isNaN(Interpreter.legalArrayLength(first))) {
        thisInterpreter.throwException(thisInterpreter.RANGE_ERROR,
          'Invalid array length');
      }
      newArray.properties.length = first;
    } else {
      for (var i = 0; i < arguments.length; i++) {
        newArray.properties[i] = arguments[i];
      }
      newArray.properties.length = i;
    }
    return newArray;
  };
  this.ARRAY = this.createNativeFunction(wrapper, true);
  this.ARRAY_PROTO = this.ARRAY.properties['prototype'];
  this.setProperty(scope, 'Array', this.ARRAY);

  // Static methods on Array.
  wrapper = function (obj) {
    return obj && obj.class === 'Array';
  };
  this.setProperty(this.ARRAY, 'isArray',
    this.createNativeFunction(wrapper, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Array.
  wrapper = function () {
    return Array.prototype.pop.call(this.properties);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'pop', wrapper);

  wrapper = function (var_args) {
    return Array.prototype.push.apply(this.properties, arguments);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'push', wrapper);

  wrapper = function () {
    return Array.prototype.shift.call(this.properties);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'shift', wrapper);

  wrapper = function (var_args) {
    return Array.prototype.unshift.apply(this.properties, arguments);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'unshift', wrapper);

  wrapper = function () {
    Array.prototype.reverse.call(this.properties);
    return this;
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'reverse', wrapper);

  wrapper = function (index, howmany /*, var_args*/) {
    var list = Array.prototype.splice.apply(this.properties, arguments);
    return thisInterpreter.arrayNativeToPseudo(list);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'splice', wrapper);

  wrapper = function (opt_begin, opt_end) {
    var list = Array.prototype.slice.call(this.properties, opt_begin, opt_end);
    return thisInterpreter.arrayNativeToPseudo(list);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'slice', wrapper);

  wrapper = function (opt_separator) {
    return Array.prototype.join.call(this.properties, opt_separator);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'join', wrapper);

  wrapper = function (var_args) {
    var list = [];
    var length = 0;
    // Start by copying the current array.
    var iLength = thisInterpreter.getProperty(this, 'length');
    for (var i = 0; i < iLength; i++) {
      if (thisInterpreter.hasProperty(this, i)) {
        var element = thisInterpreter.getProperty(this, i);
        list[length] = element;
      }
      length++;
    }
    // Loop through all arguments and copy them in.
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      if (thisInterpreter.isa(value, thisInterpreter.ARRAY)) {
        var jLength = thisInterpreter.getProperty(value, 'length');
        for (var j = 0; j < jLength; j++) {
          if (thisInterpreter.hasProperty(value, j)) {
            list[length] = thisInterpreter.getProperty(value, j);
          }
          length++;
        }
      } else {
        list[length] = value;
      }
    }
    return thisInterpreter.arrayNativeToPseudo(list);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'concat', wrapper);

  wrapper = function (searchElement, opt_fromIndex) {
    return Array.prototype.indexOf.apply(this.properties, arguments);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'indexOf', wrapper);

  wrapper = function (searchElement, opt_fromIndex) {
    return Array.prototype.lastIndexOf.apply(this.properties, arguments);
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'lastIndexOf', wrapper);

  wrapper = function () {
    Array.prototype.sort.call(this.properties);
    return this;
  };
  this.setNativeFunctionPrototype(this.ARRAY, 'sort', wrapper);

  this.polyfills_.push(
    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/every
    "Object.defineProperty(Array.prototype, 'every',",
    "{configurable: true, writable: true, value:",
    "function(callbackfn, thisArg) {",
    "if (!this || typeof callbackfn !== 'function') throw TypeError();",
    "var T, k;",
    "var O = Object(this);",
    "var len = O.length >>> 0;",
    "if (arguments.length > 1) T = thisArg;",
    "k = 0;",
    "while (k < len) {",
    "if (k in O && !callbackfn.call(T, O[k], k, O)) return false;",
    "k++;",
    "}",
    "return true;",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    "Object.defineProperty(Array.prototype, 'filter',",
    "{configurable: true, writable: true, value:",
    "function(fun/*, thisArg*/) {",
    "if (this === void 0 || this === null || typeof fun !== 'function') throw TypeError();",
    "var t = Object(this);",
    "var len = t.length >>> 0;",
    "var res = [];",
    "var thisArg = arguments.length >= 2 ? arguments[1] : void 0;",
    "for (var i = 0; i < len; i++) {",
    "if (i in t) {",
    "var val = t[i];",
    "if (fun.call(thisArg, val, i, t)) res.push(val);",
    "}",
    "}",
    "return res;",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
    "Object.defineProperty(Array.prototype, 'forEach',",
    "{configurable: true, writable: true, value:",
    "function(callback, thisArg) {",
    "if (!this || typeof callback !== 'function') throw TypeError();",
    "var T, k;",
    "var O = Object(this);",
    "var len = O.length >>> 0;",
    "if (arguments.length > 1) T = thisArg;",
    "k = 0;",
    "while (k < len) {",
    "if (k in O) callback.call(T, O[k], k, O);",
    "k++;",
    "}",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map
    "Object.defineProperty(Array.prototype, 'map',",
    "{configurable: true, writable: true, value:",
    "function(callback, thisArg) {",
    "if (!this || typeof callback !== 'function') new TypeError;",
    "var T, A, k;",
    "var O = Object(this);",
    "var len = O.length >>> 0;",
    "if (arguments.length > 1) T = thisArg;",
    "A = new Array(len);",
    "k = 0;",
    "while (k < len) {",
    "if (k in O) A[k] = callback.call(T, O[k], k, O);",
    "k++;",
    "}",
    "return A;",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
    "Object.defineProperty(Array.prototype, 'reduce',",
    "{configurable: true, writable: true, value:",
    "function(callback /*, initialValue*/) {",
    "if (!this || typeof callback !== 'function') throw TypeError();",
    "var t = Object(this), len = t.length >>> 0, k = 0, value;",
    "if (arguments.length === 2) {",
    "value = arguments[1];",
    "} else {",
    "while (k < len && !(k in t)) k++;",
    "if (k >= len) {",
    "throw TypeError('Reduce of empty array with no initial value');",
    "}",
    "value = t[k++];",
    "}",
    "for (; k < len; k++) {",
    "if (k in t) value = callback(value, t[k], k, t);",
    "}",
    "return value;",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight
    "Object.defineProperty(Array.prototype, 'reduceRight',",
    "{configurable: true, writable: true, value:",
    "function(callback /*, initialValue*/) {",
    "if (null === this || 'undefined' === typeof this || 'function' !== typeof callback) throw TypeError();",
    "var t = Object(this), len = t.length >>> 0, k = len - 1, value;",
    "if (arguments.length >= 2) {",
    "value = arguments[1];",
    "} else {",
    "while (k >= 0 && !(k in t)) k--;",
    "if (k < 0) {",
    "throw TypeError('Reduce of empty array with no initial value');",
    "}",
    "value = t[k--];",
    "}",
    "for (; k >= 0; k--) {",
    "if (k in t) value = callback(value, t[k], k, t);",
    "}",
    "return value;",
    "}",
    "});",

    // Polyfill copied from:
    // developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some
    "Object.defineProperty(Array.prototype, 'some',",
    "{configurable: true, writable: true, value:",
    "function(fun/*, thisArg*/) {",
    "if (!this || typeof fun !== 'function') throw TypeError();",
    "var t = Object(this);",
    "var len = t.length >>> 0;",
    "var thisArg = arguments.length >= 2 ? arguments[1] : void 0;",
    "for (var i = 0; i < len; i++) {",
    "if (i in t && fun.call(thisArg, t[i], i, t)) {",
    "return true;",
    "}",
    "}",
    "return false;",
    "}",
    "});",


    "(function() {",
    "var sort_ = Array.prototype.sort;",
    "Array.prototype.sort = function(opt_comp) {",
    // Fast native sort.
    "if (typeof opt_comp !== 'function') {",
    "return sort_.call(this);",
    "}",
    // Slow bubble sort.
    "for (var i = 0; i < this.length; i++) {",
    "var changes = 0;",
    "for (var j = 0; j < this.length - i - 1; j++) {",
    "if (opt_comp(this[j], this[j + 1]) > 0) {",
    "var swap = this[j];",
    "this[j] = this[j + 1];",
    "this[j + 1] = swap;",
    "changes++;",
    "}",
    "}",
    "if (!changes) break;",
    "}",
    "return this;",
    "};",
    "})();",

    "Object.defineProperty(Array.prototype, 'toLocaleString',",
    "{configurable: true, writable: true, value:",
    "function() {",
    "var out = [];",
    "for (var i = 0; i < this.length; i++) {",
    "out[i] = (this[i] === null || this[i] === undefined) ? '' : this[i].toLocaleString();",
    "}",
    "return out.join(',');",
    "}",
    "});",
    "");
};

/**
 * Initialize the String class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initString = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // String constructor.
  wrapper = function (value) {
    value = String(value);
    if (thisInterpreter.calledWithNew()) {
      // Called as new String().
      this.data = value;
      return this;
    } else {
      // Called as String().
      return value;
    }
  };
  this.STRING = this.createNativeFunction(wrapper, true);
  this.setProperty(scope, 'String', this.STRING);

  // Static methods on String.
  this.setProperty(this.STRING, 'fromCharCode',
    this.createNativeFunction(String.fromCharCode, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on String.
  // Methods with exclusively primitive arguments.
  var functions = ['charAt', 'charCodeAt', 'concat', 'indexOf', 'lastIndexOf',
    'slice', 'substr', 'substring', 'toLocaleLowerCase', 'toLocaleUpperCase',
    'toLowerCase', 'toUpperCase', 'trim'];
  for (var i = 0; i < functions.length; i++) {
    this.setNativeFunctionPrototype(this.STRING, functions[i],
      String.prototype[functions[i]]);
  }

  wrapper = function (compareString, locales, options) {
    locales = locales ? thisInterpreter.pseudoToNative(locales) : undefined;
    options = options ? thisInterpreter.pseudoToNative(options) : undefined;
    return String(this).localeCompare(compareString, locales, options);
  };
  this.setNativeFunctionPrototype(this.STRING, 'localeCompare', wrapper);

  wrapper = function (separator, limit, callback) {
    var string = String(this);
    limit = limit ? Number(limit) : undefined;
    // Example of catastrophic split RegExp:
    // 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaac'.split(/^(a+)+b/)
    if (thisInterpreter.isa(separator, thisInterpreter.REGEXP)) {
      separator = separator.data;
      thisInterpreter.maybeThrowRegExp(separator, callback);
      if (thisInterpreter.REGEXP_MODE === 2) {
        if (Interpreter.vm) {
          // Run split in vm.
          var sandbox = {
            'string': string,
            'separator': separator,
            'limit': limit
          };
          var code = 'string.split(separator, limit)';
          var jsList =
            thisInterpreter.vmCall(code, sandbox, separator, callback);
          if (jsList !== Interpreter.REGEXP_TIMEOUT) {
            callback(thisInterpreter.arrayNativeToPseudo(jsList));
          }
        } else {
          // Run split in separate thread.
          var splitWorker = thisInterpreter.createWorker();
          var pid = thisInterpreter.regExpTimeout(separator, splitWorker,
            callback);
          splitWorker.onmessage = function (e) {
            clearTimeout(pid);
            callback(thisInterpreter.arrayNativeToPseudo(e.data));
          };
          splitWorker.postMessage(['split', string, separator, limit]);
        }
        return;
      }
    }
    // Run split natively.
    var jsList = string.split(separator, limit);
    callback(thisInterpreter.arrayNativeToPseudo(jsList));
  };
  this.setAsyncFunctionPrototype(this.STRING, 'split', wrapper);

  wrapper = function (regexp, callback) {
    var string = String(this);
    if (thisInterpreter.isa(regexp, thisInterpreter.REGEXP)) {
      regexp = regexp.data;
    } else {
      regexp = new RegExp(regexp);
    }
    // Example of catastrophic match RegExp:
    // 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaac'.match(/^(a+)+b/)
    thisInterpreter.maybeThrowRegExp(regexp, callback);
    if (thisInterpreter.REGEXP_MODE === 2) {
      if (Interpreter.vm) {
        // Run match in vm.
        var sandbox = {
          'string': string,
          'regexp': regexp
        };
        var code = 'string.match(regexp)';
        var m = thisInterpreter.vmCall(code, sandbox, regexp, callback);
        if (m !== Interpreter.REGEXP_TIMEOUT) {
          callback(m && thisInterpreter.arrayNativeToPseudo(m));
        }
      } else {
        // Run match in separate thread.
        var matchWorker = thisInterpreter.createWorker();
        var pid = thisInterpreter.regExpTimeout(regexp, matchWorker, callback);
        matchWorker.onmessage = function (e) {
          clearTimeout(pid);
          callback(e.data && thisInterpreter.arrayNativeToPseudo(e.data));
        };
        matchWorker.postMessage(['match', string, regexp]);
      }
      return;
    }
    // Run match natively.
    var m = string.match(regexp);
    callback(m && thisInterpreter.arrayNativeToPseudo(m));
  };
  this.setAsyncFunctionPrototype(this.STRING, 'match', wrapper);

  wrapper = function (regexp, callback) {
    var string = String(this);
    if (thisInterpreter.isa(regexp, thisInterpreter.REGEXP)) {
      regexp = regexp.data;
    } else {
      regexp = new RegExp(regexp);
    }
    // Example of catastrophic search RegExp:
    // 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaac'.search(/^(a+)+b/)
    thisInterpreter.maybeThrowRegExp(regexp, callback);
    if (thisInterpreter.REGEXP_MODE === 2) {
      if (Interpreter.vm) {
        // Run search in vm.
        var sandbox = {
          'string': string,
          'regexp': regexp
        };
        var code = 'string.search(regexp)';
        var n = thisInterpreter.vmCall(code, sandbox, regexp, callback);
        if (n !== Interpreter.REGEXP_TIMEOUT) {
          callback(n);
        }
      } else {
        // Run search in separate thread.
        var searchWorker = thisInterpreter.createWorker();
        var pid = thisInterpreter.regExpTimeout(regexp, searchWorker, callback);
        searchWorker.onmessage = function (e) {
          clearTimeout(pid);
          callback(e.data);
        };
        searchWorker.postMessage(['search', string, regexp]);
      }
      return;
    }
    // Run search natively.
    callback(string.search(regexp));
  };
  this.setAsyncFunctionPrototype(this.STRING, 'search', wrapper);

  wrapper = function (substr, newSubstr, callback) {
    // Support for function replacements is the responsibility of a polyfill.
    var string = String(this);
    newSubstr = String(newSubstr);
    // Example of catastrophic replace RegExp:
    // 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaac'.replace(/^(a+)+b/, '')
    if (thisInterpreter.isa(substr, thisInterpreter.REGEXP)) {
      substr = substr.data;
      thisInterpreter.maybeThrowRegExp(substr, callback);
      if (thisInterpreter.REGEXP_MODE === 2) {
        if (Interpreter.vm) {
          // Run replace in vm.
          var sandbox = {
            'string': string,
            'substr': substr,
            'newSubstr': newSubstr
          };
          var code = 'string.replace(substr, newSubstr)';
          var str = thisInterpreter.vmCall(code, sandbox, substr, callback);
          if (str !== Interpreter.REGEXP_TIMEOUT) {
            callback(str);
          }
        } else {
          // Run replace in separate thread.
          var replaceWorker = thisInterpreter.createWorker();
          var pid = thisInterpreter.regExpTimeout(substr, replaceWorker,
            callback);
          replaceWorker.onmessage = function (e) {
            clearTimeout(pid);
            callback(e.data);
          };
          replaceWorker.postMessage(['replace', string, substr, newSubstr]);
        }
        return;
      }
    }
    // Run replace natively.
    callback(string.replace(substr, newSubstr));
  };
  this.setAsyncFunctionPrototype(this.STRING, 'replace', wrapper);
  // Add a polyfill to handle replace's second argument being a function.
  this.polyfills_.push(
    "(function() {",
    "var replace_ = String.prototype.replace;",
    "String.prototype.replace = function(substr, newSubstr) {",
    "if (typeof newSubstr !== 'function') {",
    // string.replace(string|regexp, string)
    "return replace_.call(this, substr, newSubstr);",
    "}",
    "var str = this;",
    "if (substr instanceof RegExp) {",  // string.replace(regexp, function)
    "var subs = [];",
    "var m = substr.exec(str);",
    "while (m) {",
    "m.push(m.index, str);",
    "var inject = newSubstr.apply(null, m);",
    "subs.push([m.index, m[0].length, inject]);",
    "m = substr.global ? substr.exec(str) : null;",
    "}",
    "for (var i = subs.length - 1; i >= 0; i--) {",
    "str = str.substring(0, subs[i][0]) + subs[i][2] + " +
    "str.substring(subs[i][0] + subs[i][1]);",
    "}",
    "} else {",                         // string.replace(string, function)
    "var i = str.indexOf(substr);",
    "if (i !== -1) {",
    "var inject = newSubstr(str.substr(i, substr.length), i, str);",
    "str = str.substring(0, i) + inject + " +
    "str.substring(i + substr.length);",
    "}",
    "}",
    "return str;",
    "};",
    "})();",
    "");
};

/**
 * Initialize the Boolean class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initBoolean = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // Boolean constructor.
  wrapper = function (value) {
    value = Boolean(value);
    if (thisInterpreter.calledWithNew()) {
      // Called as new Boolean().
      this.data = value;
      return this;
    } else {
      // Called as Boolean().
      return value;
    }
  };
  this.BOOLEAN = this.createNativeFunction(wrapper, true);
  this.setProperty(scope, 'Boolean', this.BOOLEAN);
};

/**
 * Initialize the Number class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initNumber = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // Number constructor.
  wrapper = function (value) {
    value = Number(value);
    if (thisInterpreter.calledWithNew()) {
      // Called as new Number().
      this.data = value;
      return this;
    } else {
      // Called as Number().
      return value;
    }
  };
  this.NUMBER = this.createNativeFunction(wrapper, true);
  this.setProperty(scope, 'Number', this.NUMBER);

  var numConsts = ['MAX_VALUE', 'MIN_VALUE', 'NaN', 'NEGATIVE_INFINITY',
    'POSITIVE_INFINITY'];
  for (var i = 0; i < numConsts.length; i++) {
    this.setProperty(this.NUMBER, numConsts[i], Number[numConsts[i]],
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  }

  // Instance methods on Number.
  wrapper = function (fractionDigits) {
    try {
      return Number(this).toExponential(fractionDigits);
    } catch (e) {
      // Throws if fractionDigits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(this.NUMBER, 'toExponential', wrapper);

  wrapper = function (digits) {
    try {
      return Number(this).toFixed(digits);
    } catch (e) {
      // Throws if digits isn't within 0-20.
      thisInterpreter.throwException(thisInterpreter.ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(this.NUMBER, 'toFixed', wrapper);

  wrapper = function (precision) {
    try {
      return Number(this).toPrecision(precision);
    } catch (e) {
      // Throws if precision isn't within range (depends on implementation).
      thisInterpreter.throwException(thisInterpreter.ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(this.NUMBER, 'toPrecision', wrapper);

  wrapper = function (radix) {
    try {
      return Number(this).toString(radix);
    } catch (e) {
      // Throws if radix isn't within 2-36.
      thisInterpreter.throwException(thisInterpreter.ERROR, e.message);
    }
  };
  this.setNativeFunctionPrototype(this.NUMBER, 'toString', wrapper);

  wrapper = function (locales, options) {
    locales = locales ? thisInterpreter.pseudoToNative(locales) : undefined;
    options = options ? thisInterpreter.pseudoToNative(options) : undefined;
    return Number(this).toLocaleString(locales, options);
  };
  this.setNativeFunctionPrototype(this.NUMBER, 'toLocaleString', wrapper);
};

/**
 * Initialize the Date class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initDate = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // Date constructor.
  wrapper = function (value, var_args) {
    if (!thisInterpreter.calledWithNew()) {
      // Called as Date().
      // Calling Date() as a function returns a string, no arguments are heeded.
      return Date();
    }
    // Called as new Date().
    var args = [null].concat(Array.from(arguments));
    this.data = new (Function.prototype.bind.apply(Date, args));
    return this;
  };
  this.DATE = this.createNativeFunction(wrapper, true);
  this.DATE_PROTO = this.DATE.properties['prototype'];
  this.setProperty(scope, 'Date', this.DATE);

  // Static methods on Date.
  this.setProperty(this.DATE, 'now', this.createNativeFunction(Date.now, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.setProperty(this.DATE, 'parse',
    this.createNativeFunction(Date.parse, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  this.setProperty(this.DATE, 'UTC', this.createNativeFunction(Date.UTC, false),
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Date.
  var functions = ['getDate', 'getDay', 'getFullYear', 'getHours',
    'getMilliseconds', 'getMinutes', 'getMonth', 'getSeconds', 'getTime',
    'getTimezoneOffset', 'getUTCDate', 'getUTCDay', 'getUTCFullYear',
    'getUTCHours', 'getUTCMilliseconds', 'getUTCMinutes', 'getUTCMonth',
    'getUTCSeconds', 'getYear',
    'setDate', 'setFullYear', 'setHours', 'setMilliseconds',
    'setMinutes', 'setMonth', 'setSeconds', 'setTime', 'setUTCDate',
    'setUTCFullYear', 'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes',
    'setUTCMonth', 'setUTCSeconds', 'setYear',
    'toDateString', 'toISOString', 'toJSON', 'toGMTString',
    'toLocaleDateString', 'toLocaleString', 'toLocaleTimeString',
    'toTimeString', 'toUTCString'];
  for (var i = 0; i < functions.length; i++) {
    wrapper = (function (nativeFunc) {
      return function (var_args) {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args[i] = thisInterpreter.pseudoToNative(arguments[i]);
        }
        return this.data[nativeFunc].apply(this.data, args);
      };
    })(functions[i]);
    this.setNativeFunctionPrototype(this.DATE, functions[i], wrapper);
  }
};

/**
 * Initialize Regular Expression object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initRegExp = function (scope) {
  var thisInterpreter = this;
  var wrapper;
  // RegExp constructor.
  wrapper = function (pattern, flags) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new RegExp().
      var rgx = this;
    } else {
      // Called as RegExp().
      var rgx = thisInterpreter.createObjectProto(thisInterpreter.REGEXP_PROTO);
    }
    pattern = pattern ? String(pattern) : '';
    flags = flags ? String(flags) : '';
    thisInterpreter.populateRegExp(rgx, new RegExp(pattern, flags));
    return rgx;
  };
  this.REGEXP = this.createNativeFunction(wrapper, true);
  this.REGEXP_PROTO = this.REGEXP.properties['prototype'];
  this.setProperty(scope, 'RegExp', this.REGEXP);

  this.setProperty(this.REGEXP.properties['prototype'], 'global', undefined,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP.properties['prototype'], 'ignoreCase', undefined,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP.properties['prototype'], 'multiline', undefined,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.REGEXP.properties['prototype'], 'source', '(?:)',
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);

  // Use polyfill to avoid complexity of regexp threads.
  this.polyfills_.push(
    "Object.defineProperty(RegExp.prototype, 'test',",
    "{configurable: true, writable: true, value:",
    "function(str) {",
    "return String(str).search(this) !== -1",
    "}",
    "});");

  wrapper = function (string, callback) {
    var thisPseudoRegExp = this;
    var regexp = thisPseudoRegExp.data;
    string = String(string);
    // Get lastIndex from wrapped regex, since this is settable.
    regexp.lastIndex =
      Number(thisInterpreter.getProperty(this, 'lastIndex'));
    // Example of catastrophic exec RegExp:
    // /^(a+)+b/.exec('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaac')
    thisInterpreter.maybeThrowRegExp(regexp, callback);
    if (thisInterpreter.REGEXP_MODE === 2) {
      if (Interpreter.vm) {
        // Run exec in vm.
        var sandbox = {
          'string': string,
          'regexp': regexp
        };
        var code = 'regexp.exec(string)';
        var match = thisInterpreter.vmCall(code, sandbox, regexp, callback);
        if (match !== Interpreter.REGEXP_TIMEOUT) {
          thisInterpreter.setProperty(thisPseudoRegExp, 'lastIndex',
            regexp.lastIndex);
          callback(matchToPseudo(match));
        }
      } else {
        // Run exec in separate thread.
        // Note that lastIndex is not preserved when a RegExp is passed to a
        // Web Worker.  Thus it needs to be passed back and forth separately.
        var execWorker = thisInterpreter.createWorker();
        var pid = thisInterpreter.regExpTimeout(regexp, execWorker, callback);
        execWorker.onmessage = function (e) {
          clearTimeout(pid);
          // Return tuple: [result, lastIndex]
          thisInterpreter.setProperty(thisPseudoRegExp, 'lastIndex',
            e.data[1]);
          callback(matchToPseudo(e.data[0]));
        };
        execWorker.postMessage(['exec', regexp, regexp.lastIndex, string]);
      }
      return;
    }
    // Run exec natively.
    var match = regexp.exec(string);
    thisInterpreter.setProperty(thisPseudoRegExp, 'lastIndex',
      regexp.lastIndex);
    callback(matchToPseudo(match));

    function matchToPseudo(match) {
      if (match) {
        var result = thisInterpreter.arrayNativeToPseudo(match);
        // match has additional properties.
        thisInterpreter.setProperty(result, 'index', match.index);
        thisInterpreter.setProperty(result, 'input', match.input);
        return result;
      }
      return null;
    }
  };
  this.setAsyncFunctionPrototype(this.REGEXP, 'exec', wrapper);
};

/**
 * Initialize the Error class.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initError = function (scope) {
  var thisInterpreter = this;
  // Error constructor.
  this.ERROR = this.createNativeFunction(function (opt_message) {
    if (thisInterpreter.calledWithNew()) {
      // Called as new Error().
      var newError = this;
    } else {
      // Called as Error().
      var newError = thisInterpreter.createObject(thisInterpreter.ERROR);
    }
    if (opt_message) {
      thisInterpreter.setProperty(newError, 'message', String(opt_message),
        Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return newError;
  }, true);
  this.setProperty(scope, 'Error', this.ERROR);
  this.setProperty(this.ERROR.properties['prototype'], 'message', '',
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(this.ERROR.properties['prototype'], 'name', 'Error',
    Interpreter.NONENUMERABLE_DESCRIPTOR);

  var createErrorSubclass = function (name) {
    var constructor = thisInterpreter.createNativeFunction(
      function (opt_message) {
        if (thisInterpreter.calledWithNew()) {
          // Called as new XyzError().
          var newError = this;
        } else {
          // Called as XyzError().
          var newError = thisInterpreter.createObject(constructor);
        }
        if (opt_message) {
          thisInterpreter.setProperty(newError, 'message',
            String(opt_message), Interpreter.NONENUMERABLE_DESCRIPTOR);
        }
        return newError;
      }, true);
    thisInterpreter.setProperty(constructor, 'prototype',
      thisInterpreter.createObject(thisInterpreter.ERROR),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
    thisInterpreter.setProperty(constructor.properties['prototype'], 'name',
      name, Interpreter.NONENUMERABLE_DESCRIPTOR);
    thisInterpreter.setProperty(scope, name, constructor);

    return constructor;
  };

  this.EVAL_ERROR = createErrorSubclass('EvalError');
  this.RANGE_ERROR = createErrorSubclass('RangeError');
  this.REFERENCE_ERROR = createErrorSubclass('ReferenceError');
  this.SYNTAX_ERROR = createErrorSubclass('SyntaxError');
  this.TYPE_ERROR = createErrorSubclass('TypeError');
  this.URI_ERROR = createErrorSubclass('URIError');
};

/**
 * Initialize Math object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initMath = function (scope) {
  var thisInterpreter = this;
  var myMath = this.createObjectProto(this.OBJECT_PROTO);
  this.setProperty(scope, 'Math', myMath);
  var mathConsts = ['E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'PI',
    'SQRT1_2', 'SQRT2'];
  for (var i = 0; i < mathConsts.length; i++) {
    this.setProperty(myMath, mathConsts[i], Math[mathConsts[i]],
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  }
  var numFunctions = ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos',
    'exp', 'floor', 'log', 'max', 'min', 'pow', 'random',
    'round', 'sin', 'sqrt', 'tan'];
  for (var i = 0; i < numFunctions.length; i++) {
    this.setProperty(myMath, numFunctions[i],
      this.createNativeFunction(Math[numFunctions[i]], false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
};

/**
 * Initialize JSON object.
 * @param {!Interpreter.Object} scope Global scope.
 */
Interpreter.prototype.initJSON = function (scope) {
  var thisInterpreter = this;
  var myJSON = thisInterpreter.createObjectProto(this.OBJECT_PROTO);
  this.setProperty(scope, 'JSON', myJSON);

  var wrapper = function (text) {
    try {
      var nativeObj = JSON.parse(String(text));
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.SYNTAX_ERROR, e.message);
    }
    return thisInterpreter.nativeToPseudo(nativeObj);
  };
  this.setProperty(myJSON, 'parse', this.createNativeFunction(wrapper, false));

  wrapper = function (value) {
    var nativeObj = thisInterpreter.pseudoToNative(value);
    try {
      var str = JSON.stringify(nativeObj);
    } catch (e) {
      thisInterpreter.throwException(thisInterpreter.TYPE_ERROR, e.message);
    }
    return str;
  };
  this.setProperty(myJSON, 'stringify',
    this.createNativeFunction(wrapper, false));
};
