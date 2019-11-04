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
