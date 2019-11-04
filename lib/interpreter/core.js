var Interpreter = function (code, opt_initFunc) {
  if (typeof code === 'string') {
    code = acorn.parse(code, Interpreter.PARSE_OPTIONS);
  }
  this.ast = code;
  this.initFunc_ = opt_initFunc;
  this.paused_ = false;
  this.polyfills_ = [];
  // Unique identifier for native functions.  Used in serialization.
  this.functionCounter_ = 0;
  // Map node types to our step function names; a property lookup is faster
  // than string concatenation with "step" prefix.
  this.stepFunctions_ = Object.create(null);
  var stepMatch = /^step([A-Z]\w*)$/;
  var m;
  for (var methodName in this) {
    if ((typeof this[methodName] === 'function') &&
      (m = methodName.match(stepMatch))) {
      this.stepFunctions_[m[1]] = this[methodName].bind(this);
    }
  }
  // Create and initialize the global scope.
  this.global = this.createScope(this.ast, null);
  // Run the polyfills.
  this.ast = acorn.parse(this.polyfills_.join('\n'), Interpreter.PARSE_OPTIONS);
  this.polyfills_ = undefined;  // Allow polyfill strings to garbage collect.
  this.stripLocations_(this.ast, undefined, undefined);
  var state = new Interpreter.State(this.ast, this.global);
  state.done = false;
  this.stateStack = [state];
  this.run();
  this.value = undefined;
  // Point at the main program.
  this.ast = code;
  var state = new Interpreter.State(this.ast, this.global);
  state.done = false;
  this.stateStack.length = 0;
  this.stateStack[0] = state;
  // Get a handle on Acorn's node_t object.  It's tricky to access.
  this.nodeConstructor = state.node.constructor;
  // Preserve publicly properties from being pruned/renamed by JS compilers.
  // Add others as needed.
  this['stateStack'] = this.stateStack;
};

/**
 * @const {!Object} Configuration used for all Acorn parsing.
 */
Interpreter.PARSE_OPTIONS = {
  ecmaVersion: 5
};

/**
 * Property descriptor of readonly properties.
 */
Interpreter.READONLY_DESCRIPTOR = {
  configurable: true,
  enumerable: true,
  writable: false
};

/**
 * Property descriptor of non-enumerable properties.
 */
Interpreter.NONENUMERABLE_DESCRIPTOR = {
  configurable: true,
  enumerable: false,
  writable: true
};

/**
 * Property descriptor of readonly, non-enumerable properties.
 */
Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR = {
  configurable: true,
  enumerable: false,
  writable: false
};

/**
 * Property descriptor of variables.
 */
Interpreter.VARIABLE_DESCRIPTOR = {
  configurable: false,
  enumerable: true,
  writable: true
};

/**
 * Unique symbol for indicating that a step has encountered an error, has
 * added it to the stack, and will be thrown within the user's program.
 * When STEP_ERROR is thrown in the JS-Interpreter, the error can be ignored.
 */
Interpreter.STEP_ERROR = { 'STEP_ERROR': true };

/**
 * Unique symbol for indicating that a reference is a variable on the scope,
 * not an object property.
 */
Interpreter.SCOPE_REFERENCE = { 'SCOPE_REFERENCE': true };

/**
 * Unique symbol for indicating, when used as the value of the value
 * parameter in calls to setProperty and friends, that the value
 * should be taken from the property descriptor instead.
 */
Interpreter.VALUE_IN_DESCRIPTOR = { 'VALUE_IN_DESCRIPTOR': true };

/**
 * Unique symbol for indicating that a RegExp timeout has occurred in a VM.
 */
Interpreter.REGEXP_TIMEOUT = { 'REGEXP_TIMEOUT': true };

/**
 * For cycle detection in array to string and error conversion;
 * see spec bug github.com/tc39/ecma262/issues/289
 * Since this is for atomic actions only, it can be a class property.
 */
Interpreter.toStringCycles_ = [];

/**
 * Node's vm module, if loaded and required.
 * @type {Object}
 */
Interpreter.vm = null;

/**
 * Code for executing regular expressions in a thread.
 */
Interpreter.WORKER_CODE = [
  "onmessage = function(e) {",
  "var result;",
  "var data = e.data;",
  "switch (data[0]) {",
  "case 'split':",
  // ['split', string, separator, limit]
  "result = data[1].split(data[2], data[3]);",
  "break;",
  "case 'match':",
  // ['match', string, regexp]
  "result = data[1].match(data[2]);",
  "break;",
  "case 'search':",
  // ['search', string, regexp]
  "result = data[1].search(data[2]);",
  "break;",
  "case 'replace':",
  // ['replace', string, regexp, newSubstr]
  "result = data[1].replace(data[2], data[3]);",
  "break;",
  "case 'exec':",
  // ['exec', regexp, lastIndex, string]
  "var regexp = data[1];",
  "regexp.lastIndex = data[2];",
  "result = [regexp.exec(data[3]), data[1].lastIndex];",
  "break;",
  "default:",
  "throw 'Unknown RegExp operation: ' + data[0];",
  "}",
  "postMessage(result);",
  "};"];

/**
 * Some pathological regular expressions can take geometric time.
 * Regular expressions are handled in one of three ways:
 * 0 - throw as invalid.
 * 1 - execute natively (risk of unresponsive program).
 * 2 - execute in separate thread (not supported by IE 9).
 */
Interpreter.prototype.REGEXP_MODE = 2;

/**
 * If REGEXP_MODE = 2, the length of time (in ms) to allow a RegExp
 * thread to execute before terminating it.
 */
Interpreter.prototype.REGEXP_THREAD_TIMEOUT = 1000;

/**
 * Add more code to the interpreter.
 * @param {string|!Object} code Raw JavaScript text or AST.
 */
Interpreter.prototype.appendCode = function (code) {
  var state = this.stateStack[0];
  if (!state || state.node['type'] !== 'Program') {
    throw Error('Expecting original AST to start with a Program node.');
  }
  if (typeof code === 'string') {
    code = acorn.parse(code, Interpreter.PARSE_OPTIONS);
  }
  if (!code || code['type'] !== 'Program') {
    throw Error('Expecting new AST to start with a Program node.');
  }
  this.populateScope_(code, state.scope);
  // Append the new program to the old one.
  for (var i = 0, node; (node = code['body'][i]); i++) {
    state.node['body'].push(node);
  }
  state.done = false;
};

/**
 * Execute one step of the interpreter.
 * @return {boolean} True if a step was executed, false if no more instructions.
 */
Interpreter.prototype.step = function () {
  var stack = this.stateStack;
  var state = stack[stack.length - 1];
  if (!state) {
    return false;
  }
  var node = state.node, type = node['type'];
  if (type === 'Program' && state.done) {
    return false;
  } else if (this.paused_) {
    return true;
  }
  try {
    var nextState = this.stepFunctions_[type](stack, state, node);
  } catch (e) {
    // Eat any step errors.  They have been thrown on the stack.
    if (e !== Interpreter.STEP_ERROR) {
      // Uh oh.  This is a real error in the JS-Interpreter.  Rethrow.
      throw e;
    }
  }
  if (nextState) {
    stack.push(nextState);
  }
  if (!node['end']) {
    // This is polyfill code.  Keep executing until we arrive at user code.
    return this.step();
  }
  return true;
};

/**
 * Execute the interpreter to program completion.  Vulnerable to infinite loops.
 * @return {boolean} True if a execution is asynchronously blocked,
 *     false if no more instructions.
 */
Interpreter.prototype.run = function () {
  while (!this.paused_ && this.step()) { }
  return this.paused_;
};

module.exports = Interpreter;