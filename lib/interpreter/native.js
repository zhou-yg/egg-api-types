const Interpreter = require('./core');
/**
 * Is an object of a certain class?
 * @param {Interpreter.Value} child Object to check.
 * @param {Interpreter.Object} constructor Constructor of object.
 * @return {boolean} True if object is the class or inherits from it.
 *     False otherwise.
 */
Interpreter.prototype.isa = function (child, constructor) {
  if (child === null || child === undefined || !constructor) {
    return false;
  }
  var proto = constructor.properties['prototype'];
  if (child === proto) {
    return true;
  }
  // The first step up the prototype chain is harder since the child might be
  // a primitive value.  Subsequent steps can just follow the .proto property.
  child = this.getPrototype(child);
  while (child) {
    if (child === proto) {
      return true;
    }
    child = child.proto;
  }
  return false;
};

/**
 * Initialize a pseudo regular expression object based on a native regular
 * expression object.
 * @param {!Interpreter.Object} pseudoRegexp The existing object to set.
 * @param {!RegExp} nativeRegexp The native regular expression.
 */
Interpreter.prototype.populateRegExp = function (pseudoRegexp, nativeRegexp) {
  pseudoRegexp.data = nativeRegexp;
  // lastIndex is settable, all others are read-only attributes
  this.setProperty(pseudoRegexp, 'lastIndex', nativeRegexp.lastIndex,
    Interpreter.NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'source', nativeRegexp.source,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'global', nativeRegexp.global,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'ignoreCase', nativeRegexp.ignoreCase,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  this.setProperty(pseudoRegexp, 'multiline', nativeRegexp.multiline,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
};

/**
 * Create a Web Worker to execute regular expressions.
 * Using a separate file fails in Chrome when run locally on a file:// URI.
 * Using a data encoded URI fails in IE and Edge.
 * Using a blob works in IE11 and all other browsers.
 * @return {!Worker} Web Worker with regexp execution code loaded.
 */
Interpreter.prototype.createWorker = function () {
  var blob = this.createWorker.blob_;
  if (!blob) {
    blob = new Blob([Interpreter.WORKER_CODE.join('\n')],
      { type: 'application/javascript' });
    // Cache the blob, so it doesn't need to be created next time.
    this.createWorker.blob_ = blob;
  }
  return new Worker(URL.createObjectURL(blob));
};

/**
 * Execute regular expressions in a node vm.
 * @param {string} code Code to execute.
 * @param {!Object} sandbox Global variables for new vm.
 * @param {!RegExp} nativeRegExp Regular expression.
 * @param {!Function} callback Asynchronous callback function.
 */
Interpreter.prototype.vmCall = function (code, sandbox, nativeRegExp, callback) {
  var options = { 'timeout': this.REGEXP_THREAD_TIMEOUT };
  try {
    return Interpreter.vm['runInNewContext'](code, sandbox, options);
  } catch (e) {
    callback(null);
    this.throwException(this.ERROR, 'RegExp Timeout: ' + nativeRegExp);
  }
  return Interpreter.REGEXP_TIMEOUT;
};

/**
 * If REGEXP_MODE is 0, then throw an error.
 * Also throw if REGEXP_MODE is 2 and JS doesn't support Web Workers or vm.
 * @param {!RegExp} nativeRegExp Regular expression.
 * @param {!Function} callback Asynchronous callback function.
 */
Interpreter.prototype.maybeThrowRegExp = function (nativeRegExp, callback) {
  var ok;
  if (this.REGEXP_MODE === 0) {
    // Fail: No RegExp support.
    ok = false;
  } else if (this.REGEXP_MODE === 1) {
    // Ok: Native RegExp support.
    ok = true;
  } else {
    // Sandboxed RegExp handling.
    if (Interpreter.vm) {
      // Ok: Node's vm module already loaded.
      ok = true;
    } else if (typeof Worker === 'function' && typeof URL === 'function') {
      // Ok: Web Workers available.
      ok = true;
    } else if (typeof require === 'function') {
      // Try to load Node's vm module.
      try {
        Interpreter.vm = require('vm');
      } catch (e) { };
      ok = !!Interpreter.vm;
    } else {
      // Fail: Neither Web Workers nor vm available.
      ok = false;
    }
  }
  if (!ok) {
    callback(null);
    this.throwException(this.ERROR, 'Regular expressions not supported: ' +
      nativeRegExp);
  }
};

/**
 * Set a timeout for regular expression threads.  Unless cancelled, this will
 * terminate the thread and throw an error.
 * @param {!RegExp} nativeRegExp Regular expression (used for error message).
 * @param {!Worker} worker Thread to terminate.
 * @param {!Function} callback Async callback function to continue execution.
 * @return {number} PID of timeout.  Used to cancel if thread completes.
 */
Interpreter.prototype.regExpTimeout = function (nativeRegExp, worker, callback) {
  var thisInterpreter = this;
  return setTimeout(function () {
    worker.terminate();
    callback(null);
    try {
      thisInterpreter.throwException(thisInterpreter.ERROR,
        'RegExp Timeout: ' + nativeRegExp);
    } catch (e) {
      // Eat the expected Interpreter.STEP_ERROR.
    }
  }, this.REGEXP_THREAD_TIMEOUT);
};

/**
 * Is a value a legal integer for an array length?
 * @param {Interpreter.Value} x Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.legalArrayLength = function (x) {
  var n = x >>> 0;
  // Array length must be between 0 and 2^32-1 (inclusive).
  return (n === Number(x)) ? n : NaN;
};

/**
 * Is a value a legal integer for an array index?
 * @param {Interpreter.Value} x Value to check.
 * @return {number} Zero, or a positive integer if the value can be
 *     converted to such.  NaN otherwise.
 */
Interpreter.legalArrayIndex = function (x) {
  var n = x >>> 0;
  // Array index cannot be 2^32-1, otherwise length would be 2^32.
  // 0xffffffff is 2^32-1.
  return (String(n) === String(x) && n !== 0xffffffff) ? n : NaN;
};

/**
 * Typedef for JS values.
 * @typedef {!Interpreter.Object|boolean|number|string|undefined|null}
 */
Interpreter.Value;

/**
 * Class for an object.
 * @param {Interpreter.Object} proto Prototype object or null.
 * @constructor
 */
Interpreter.Object = function (proto) {
  this.getter = Object.create(null);
  this.setter = Object.create(null);
  this.properties = Object.create(null);
  this.proto = proto;
};

/** @type {Interpreter.Object} */
Interpreter.Object.prototype.proto = null;

/** @type {boolean} */
Interpreter.Object.prototype.isObject = true;

/** @type {string} */
Interpreter.Object.prototype.class = 'Object';

/** @type {Date|RegExp|boolean|number|string|undefined|null} */
Interpreter.Object.prototype.data = null;

/**
 * Convert this object into a string.
 * @return {string} String value.
 * @override
 */
Interpreter.Object.prototype.toString = function () {
  if (this.class === 'Array') {
    // Array
    var cycles = Interpreter.toStringCycles_;
    cycles.push(this);
    try {
      var strs = [];
      for (var i = 0; i < this.properties.length; i++) {
        var value = this.properties[i];
        strs[i] = (value && value.isObject && cycles.indexOf(value) !== -1) ?
          '...' : value;
      }
    } finally {
      cycles.pop();
    }
    return strs.join(',');
  }
  if (this.class === 'Error') {
    var cycles = Interpreter.toStringCycles_;
    if (cycles.indexOf(this) !== -1) {
      return '[object Error]';
    }
    var name, message;
    // Bug: Does not support getters and setters for name or message.
    var obj = this;
    do {
      if ('name' in obj.properties) {
        name = obj.properties['name'];
        break;
      }
    } while ((obj = obj.proto));
    var obj = this;
    do {
      if ('message' in obj.properties) {
        message = obj.properties['message'];
        break;
      }
    } while ((obj = obj.proto));
    cycles.push(this);
    try {
      name = name && String(name);
      message = message && String(message);
    } finally {
      cycles.pop();
    }
    return message ? name + ': ' + message : String(name);
  }

  // RegExp, Date, and boxed primitives.
  if (this.data !== null) {
    return String(this.data);
  }

  return '[object ' + this.class + ']';
};

/**
 * Return the object's value.
 * @return {Interpreter.Value} Value.
 * @override
 */
Interpreter.Object.prototype.valueOf = function () {
  if (this.data === undefined || this.data === null ||
    this.data instanceof RegExp) {
    return this; // An Object.
  }
  if (this.data instanceof Date) {
    return this.data.valueOf();  // Milliseconds.
  }
  return /** @type {(boolean|number|string)} */ (this.data);  // Boxed primitive.
};

/**
 * Create a new data object based on a constructor's prototype.
 * @param {Interpreter.Object} constructor Parent constructor function,
 *     or null if scope object.
 * @return {!Interpreter.Object} New data object.
 */
Interpreter.prototype.createObject = function (constructor) {
  return this.createObjectProto(constructor &&
    constructor.properties['prototype']);
};

/**
 * Create a new data object based on a prototype.
 * @param {Interpreter.Object} proto Prototype object.
 * @return {!Interpreter.Object} New data object.
 */
Interpreter.prototype.createObjectProto = function (proto) {
  if (typeof proto !== 'object') {
    throw Error('Non object prototype');
  }
  var obj = new Interpreter.Object(proto);
  // Functions have prototype objects.
  if (this.isa(obj, this.FUNCTION)) {
    this.setProperty(obj, 'prototype',
      this.createObjectProto(this.OBJECT_PROTO || null),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
    obj.class = 'Function';
  }
  // Arrays have length.
  if (this.isa(obj, this.ARRAY)) {
    this.setProperty(obj, 'length', 0,
      { configurable: false, enumerable: false, writable: true });
    obj.class = 'Array';
  }
  if (this.isa(obj, this.ERROR)) {
    obj.class = 'Error';
  }
  return obj;
};

/**
 * Create a new function.
 * @param {!Object} node AST node defining the function.
 * @param {!Object} scope Parent scope.
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createFunction = function (node, scope) {
  var func = this.createObjectProto(this.FUNCTION_PROTO);
  func.parentScope = scope;
  func.node = node;
  this.setProperty(func, 'length', func.node['params'].length,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  return func;
};

/**
 * Create a new native function.
 * @param {!Function} nativeFunc JavaScript function.
 * @param {boolean=} opt_constructor If true, the function's
 * prototype will have its constructor property set to the function.
 * If false, the function cannot be called as a constructor (e.g. escape).
 * Defaults to undefined.
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createNativeFunction =
  function (nativeFunc, opt_constructor) {
    var func = this.createObjectProto(this.FUNCTION_PROTO);
    func.nativeFunc = nativeFunc;
    nativeFunc.id = this.functionCounter_++;
    this.setProperty(func, 'length', nativeFunc.length,
      Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
    if (opt_constructor) {
      this.setProperty(func.properties['prototype'], 'constructor', func,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
    } else if (opt_constructor === false) {
      func.illegalConstructor = true;
      this.setProperty(func, 'prototype', undefined,
        Interpreter.NONENUMERABLE_DESCRIPTOR);
    }
    return func;
  };

/**
 * Create a new native asynchronous function.
 * @param {!Function} asyncFunc JavaScript function.
 * @return {!Interpreter.Object} New function.
 */
Interpreter.prototype.createAsyncFunction = function (asyncFunc) {
  var func = this.createObjectProto(this.FUNCTION_PROTO);
  func.asyncFunc = asyncFunc;
  asyncFunc.id = this.functionCounter_++;
  this.setProperty(func, 'length', asyncFunc.length,
    Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR);
  return func;
};

/**
 * Converts from a native JS object or value to a JS interpreter object.
 * Can handle JSON-style values, does NOT handle cycles.
 * @param {*} nativeObj The native JS object to be converted.
 * @return {Interpreter.Value} The equivalent JS interpreter object.
 */
Interpreter.prototype.nativeToPseudo = function (nativeObj) {
  if ((typeof nativeObj !== 'object' && typeof nativeObj !== 'function') ||
    nativeObj === null) {
    return nativeObj;
  }

  if (nativeObj instanceof RegExp) {
    var pseudoRegexp = this.createObjectProto(this.REGEXP_PROTO);
    this.populateRegExp(pseudoRegexp, nativeObj);
    return pseudoRegexp;
  }

  if (nativeObj instanceof Date) {
    var pseudoDate = this.createObjectProto(this.DATE_PROTO);
    pseudoDate.data = nativeObj;
    return pseudoDate;
  }

  if (nativeObj instanceof Function) {
    var interpreter = this;
    var wrapper = function () {
      return interpreter.nativeToPseudo(
        nativeObj.apply(interpreter,
          Array.prototype.slice.call(arguments)
            .map(function (i) {
              return interpreter.pseudoToNative(i);
            })
        )
      );
    };
    return this.createNativeFunction(wrapper, undefined);
  }

  var pseudoObj;
  if (Array.isArray(nativeObj)) {  // Array.
    pseudoObj = this.createObjectProto(this.ARRAY_PROTO);
    for (var i = 0; i < nativeObj.length; i++) {
      if (i in nativeObj) {
        this.setProperty(pseudoObj, i, this.nativeToPseudo(nativeObj[i]));
      }
    }
  } else {  // Object.
    pseudoObj = this.createObjectProto(this.OBJECT_PROTO);
    for (var key in nativeObj) {
      this.setProperty(pseudoObj, key, this.nativeToPseudo(nativeObj[key]));
    }
  }
  return pseudoObj;
};

/**
 * Converts from a JS interpreter object to native JS object.
 * Can handle JSON-style values, plus cycles.
 * @param {Interpreter.Value} pseudoObj The JS interpreter object to be
 * converted.
 * @param {Object=} opt_cycles Cycle detection (used in recursive calls).
 * @return {*} The equivalent native JS object or value.
 */
Interpreter.prototype.pseudoToNative = function (pseudoObj, opt_cycles) {
  if ((typeof pseudoObj !== 'object' && typeof pseudoObj !== 'function') ||
    pseudoObj === null) {
    return pseudoObj;
  }

  if (this.isa(pseudoObj, this.REGEXP)) {  // Regular expression.
    return pseudoObj.data;
  }

  if (this.isa(pseudoObj, this.DATE)) {  // Date.
    return pseudoObj.data;
  }

  var cycles = opt_cycles || {
    pseudo: [],
    native: []
  };
  var i = cycles.pseudo.indexOf(pseudoObj);
  if (i !== -1) {
    return cycles.native[i];
  }
  cycles.pseudo.push(pseudoObj);
  var nativeObj;
  if (this.isa(pseudoObj, this.ARRAY)) {  // Array.
    nativeObj = [];
    cycles.native.push(nativeObj);
    var length = this.getProperty(pseudoObj, 'length');
    for (var i = 0; i < length; i++) {
      if (this.hasProperty(pseudoObj, i)) {
        nativeObj[i] =
          this.pseudoToNative(this.getProperty(pseudoObj, i), cycles);
      }
    }
  } else {  // Object.
    nativeObj = {};
    cycles.native.push(nativeObj);
    var val;
    for (var key in pseudoObj.properties) {
      val = pseudoObj.properties[key];
      nativeObj[key] = this.pseudoToNative(val, cycles);
    }
  }
  cycles.pseudo.pop();
  cycles.native.pop();
  return nativeObj;
};

/**
 * Converts from a native JS array to a JS interpreter array.
 * Does handle non-numeric properties (like str.match's index prop).
 * Does NOT recurse into the array's contents.
 * @param {!Array} nativeArray The JS array to be converted.
 * @return {!Interpreter.Object} The equivalent JS interpreter array.
 */
Interpreter.prototype.arrayNativeToPseudo = function (nativeArray) {
  var pseudoArray = this.createObjectProto(this.ARRAY_PROTO);
  var props = Object.getOwnPropertyNames(nativeArray);
  for (var i = 0; i < props.length; i++) {
    this.setProperty(pseudoArray, props[i], nativeArray[props[i]]);
  }
  return pseudoArray;
};

/**
 * Converts from a JS interpreter array to native JS array.
 * Does handle non-numeric properties (like str.match's index prop).
 * Does NOT recurse into the array's contents.
 * @param {!Interpreter.Object} pseudoArray The JS interpreter array,
 *     or JS interpreter object pretending to be an array.
 * @return {!Array} The equivalent native JS array.
 */
Interpreter.prototype.arrayPseudoToNative = function (pseudoArray) {
  var nativeArray = [];
  for (var key in pseudoArray.properties) {
    nativeArray[key] = this.getProperty(pseudoArray, key);
  }
  // pseudoArray might be an object pretending to be an array.  In this case
  // it's possible that length is non-existent, invalid, or smaller than the
  // largest defined numeric property.  Set length explicitly here.
  nativeArray.length = Interpreter.legalArrayLength(
    this.getProperty(pseudoArray, 'length')) || 0;
  return nativeArray;
};

/**
 * Look up the prototype for this value.
 * @param {Interpreter.Value} value Data object.
 * @return {Interpreter.Object} Prototype object, null if none.
 */
Interpreter.prototype.getPrototype = function (value) {
  switch (typeof value) {
    case 'number':
      return this.NUMBER.properties['prototype'];
    case 'boolean':
      return this.BOOLEAN.properties['prototype'];
    case 'string':
      return this.STRING.properties['prototype'];
  }
  if (value) {
    return value.proto;
  }
  return null;
};

/**
 * Fetch a property value from a data object.
 * @param {Interpreter.Value} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @return {Interpreter.Value} Property value (may be undefined).
 */
Interpreter.prototype.getProperty = function (obj, name) {
  name = String(name);
  if (obj === undefined || obj === null) {
    this.throwException(this.TYPE_ERROR,
      "Cannot read property '" + name + "' of " + obj);
  }
  if (name === 'length') {
    // Special cases for magic length property.
    if (this.isa(obj, this.STRING)) {
      return String(obj).length;
    }
  } else if (name.charCodeAt(0) < 0x40) {
    // Might have numbers in there?
    // Special cases for string array indexing
    if (this.isa(obj, this.STRING)) {
      var n = Interpreter.legalArrayIndex(name);
      if (!isNaN(n) && n < String(obj).length) {
        return String(obj)[n];
      }
    }
  }
  do {
    if (obj.properties && name in obj.properties) {
      var getter = obj.getter[name];
      if (getter) {
        // Flag this function as being a getter and thus needing immediate
        // execution (rather than being the value of the property).
        getter.isGetter = true;
        return getter;
      }
      return obj.properties[name];
    }
  } while ((obj = this.getPrototype(obj)));
  return undefined;
};

/**
 * Does the named property exist on a data object.
 * @param {Interpreter.Value} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @return {boolean} True if property exists.
 */
Interpreter.prototype.hasProperty = function (obj, name) {
  if (!obj.isObject) {
    throw TypeError('Primitive data type has no properties');
  }
  name = String(name);
  if (name === 'length' && this.isa(obj, this.STRING)) {
    return true;
  }
  if (this.isa(obj, this.STRING)) {
    var n = Interpreter.legalArrayIndex(name);
    if (!isNaN(n) && n < String(obj).length) {
      return true;
    }
  }
  do {
    if (obj.properties && name in obj.properties) {
      return true;
    }
  } while ((obj = this.getPrototype(obj)));
  return false;
};

/**
 * Set a property value on a data object.
 * @param {!Interpreter.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @param {Interpreter.Value} value New property value.
 *     Use Interpreter.VALUE_IN_DESCRIPTOR if value is handled by
 *     descriptor instead.
 * @param {Object=} opt_descriptor Optional descriptor object.
 * @return {!Interpreter.Object|undefined} Returns a setter function if one
 *     needs to be called, otherwise undefined.
 */
Interpreter.prototype.setProperty = function (obj, name, value, opt_descriptor) {
  name = String(name);
  if (obj === undefined || obj === null) {
    this.throwException(this.TYPE_ERROR,
      "Cannot set property '" + name + "' of " + obj);
  }
  if (opt_descriptor && ('get' in opt_descriptor || 'set' in opt_descriptor) &&
    ('value' in opt_descriptor || 'writable' in opt_descriptor)) {
    this.throwException(this.TYPE_ERROR, 'Invalid property descriptor. ' +
      'Cannot both specify accessors and a value or writable attribute');
  }
  var strict = !this.stateStack || this.getScope().strict;
  if (!obj.isObject) {
    if (strict) {
      this.throwException(this.TYPE_ERROR, "Can't create property '" + name +
        "' on '" + obj + "'");
    }
    return;
  }
  if (this.isa(obj, this.STRING)) {
    var n = Interpreter.legalArrayIndex(name);
    if (name === 'length' || (!isNaN(n) && n < String(obj).length)) {
      // Can't set length or letters on String objects.
      if (strict) {
        this.throwException(this.TYPE_ERROR, "Cannot assign to read only " +
          "property '" + name + "' of String '" + obj.data + "'");
      }
      return;
    }
  }
  if (obj.class === 'Array') {
    // Arrays have a magic length variable that is bound to the elements.
    var length = obj.properties.length;
    var i;
    if (name === 'length') {
      // Delete elements if length is smaller.
      if (opt_descriptor) {
        if (!('value' in opt_descriptor)) {
          return;
        }
        value = opt_descriptor.value;
      }
      value = Interpreter.legalArrayLength(value);
      if (isNaN(value)) {
        this.throwException(this.RANGE_ERROR, 'Invalid array length');
      }
      if (value < length) {
        for (i in obj.properties) {
          i = Interpreter.legalArrayIndex(i);
          if (!isNaN(i) && value <= i) {
            delete obj.properties[i];
          }
        }
      }
    } else if (!isNaN(i = Interpreter.legalArrayIndex(name))) {
      // Increase length if this index is larger.
      obj.properties.length = Math.max(length, i + 1);
    }
  }
  if (obj.preventExtensions && !(name in obj.properties)) {
    if (strict) {
      this.throwException(this.TYPE_ERROR, "Can't add property '" + name +
        "', object is not extensible");
    }
    return;
  }
  if (opt_descriptor) {
    // Define the property.
    if ('get' in opt_descriptor) {
      if (opt_descriptor.get) {
        obj.getter[name] = opt_descriptor.get;
      } else {
        delete obj.getter[name];
      }
    }
    if ('set' in opt_descriptor) {
      if (opt_descriptor.set) {
        obj.setter[name] = opt_descriptor.set;
      } else {
        delete obj.setter[name];
      }
    }
    var descriptor = {};
    if ('configurable' in opt_descriptor) {
      descriptor.configurable = opt_descriptor.configurable;
    }
    if ('enumerable' in opt_descriptor) {
      descriptor.enumerable = opt_descriptor.enumerable;
    }
    if ('writable' in opt_descriptor) {
      descriptor.writable = opt_descriptor.writable;
      delete obj.getter[name];
      delete obj.setter[name];
    }
    if ('value' in opt_descriptor) {
      descriptor.value = opt_descriptor.value;
      delete obj.getter[name];
      delete obj.setter[name];
    } else if (value !== Interpreter.VALUE_IN_DESCRIPTOR) {
      descriptor.value = value;
      delete obj.getter[name];
      delete obj.setter[name];
    }
    try {
      Object.defineProperty(obj.properties, name, descriptor);
    } catch (e) {
      this.throwException(this.TYPE_ERROR, 'Cannot redefine property: ' + name);
    }
  } else {
    // Set the property.
    if (value === Interpreter.VALUE_IN_DESCRIPTOR) {
      throw ReferenceError('Value not specified.');
    }
    // Determine the parent (possibly self) where the property is defined.
    var defObj = obj;
    while (!(name in defObj.properties)) {
      defObj = this.getPrototype(defObj);
      if (!defObj) {
        // This is a new property.
        defObj = obj;
        break;
      }
    }
    if (defObj.setter && defObj.setter[name]) {
      return defObj.setter[name];
    }
    if (defObj.getter && defObj.getter[name]) {
      if (strict) {
        this.throwException(this.TYPE_ERROR, "Cannot set property '" + name +
          "' of object '" + obj + "' which only has a getter");
      }
    } else {
      // No setter, simple assignment.
      try {
        obj.properties[name] = value;
      } catch (e) {
        if (strict) {
          this.throwException(this.TYPE_ERROR, "Cannot assign to read only " +
            "property '" + name + "' of object '" + obj + "'");
        }
      }
    }
  }
};

/**
 * Convenience method for adding a native function as a non-enumerable property
 * onto an object's prototype.
 * @param {!Interpreter.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @param {!Function} wrapper Function object.
 */
Interpreter.prototype.setNativeFunctionPrototype =
  function (obj, name, wrapper) {
    this.setProperty(obj.properties['prototype'], name,
      this.createNativeFunction(wrapper, false),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  };

/**
 * Convenience method for adding an async function as a non-enumerable property
 * onto an object's prototype.
 * @param {!Interpreter.Object} obj Data object.
 * @param {Interpreter.Value} name Name of property.
 * @param {!Function} wrapper Function object.
 */
Interpreter.prototype.setAsyncFunctionPrototype =
  function (obj, name, wrapper) {
    this.setProperty(obj.properties['prototype'], name,
      this.createAsyncFunction(wrapper),
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  };
