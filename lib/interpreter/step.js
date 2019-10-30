import Interpreter from './core';

/**
  * Completion Value Types.
  * @enum {number}
  */
Interpreter.Completion = {
  NORMAL: 0,
  BREAK: 1,
  CONTINUE: 2,
  RETURN: 3,
  THROW: 4
};

/**
 * Throw an exception in the interpreter that can be handled by an
 * interpreter try/catch statement.  If unhandled, a real exception will
 * be thrown.  Can be called with either an error class and a message, or
 * with an actual object to be thrown.
 * @param {!Interpreter.Object} errorClass Type of error (if message is
 *   provided) or the value to throw (if no message).
 * @param {string=} opt_message Message being thrown.
 */
Interpreter.prototype.throwException = function (errorClass, opt_message) {
  if (opt_message === undefined) {
    var error = errorClass;  // This is a value to throw, not an error class.
  } else {
    var error = this.createObject(errorClass);
    this.setProperty(error, 'message', opt_message,
      Interpreter.NONENUMERABLE_DESCRIPTOR);
  }
  this.unwind(Interpreter.Completion.THROW, error, undefined);
  // Abort anything related to the current step.
  throw Interpreter.STEP_ERROR;
};

/**
 * Unwind the stack to the innermost relevant enclosing TryStatement,
 * For/ForIn/WhileStatement or Call/NewExpression.  If this results in
 * the stack being completely unwound the thread will be terminated
 * and the appropriate error being thrown.
 * @param {Interpreter.Completion} type Completion type.
 * @param {Interpreter.Value} value Value computed, returned or thrown.
 * @param {string|undefined} label Target label for break or return.
 */
Interpreter.prototype.unwind = function (type, value, label) {
  if (type === Interpreter.Completion.NORMAL) {
    throw TypeError('Should not unwind for NORMAL completions');
  }

  loop: for (var stack = this.stateStack; stack.length > 0; stack.pop()) {
    var state = stack[stack.length - 1];
    switch (state.node['type']) {
      case 'TryStatement':
        state.cv = { type: type, value: value, label: label };
        return;
      case 'CallExpression':
      case 'NewExpression':
        if (type === Interpreter.Completion.RETURN) {
          state.value = value;
          return;
        } else if (type !== Interpreter.Completion.THROW) {
          throw Error('Unsynatctic break/continue not rejected by Acorn');
        }
        break;
      case 'Program':
        // Don't pop the stateStack.
        // Leave the root scope on the tree in case the program is appended to.
        state.done = true;
        break loop;
    }
    if (type === Interpreter.Completion.BREAK) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
        (state.isLoop || state.isSwitch)) {
        stack.pop();
        return;
      }
    } else if (type === Interpreter.Completion.CONTINUE) {
      if (label ? (state.labels && state.labels.indexOf(label) !== -1) :
        state.isLoop) {
        return;
      }
    }
  }

  // Unhandled completion.  Throw a real error.
  var realError;
  if (this.isa(value, this.ERROR)) {
    var errorTable = {
      'EvalError': EvalError,
      'RangeError': RangeError,
      'ReferenceError': ReferenceError,
      'SyntaxError': SyntaxError,
      'TypeError': TypeError,
      'URIError': URIError
    };
    var name = String(this.getProperty(value, 'name'));
    var message = this.getProperty(value, 'message').valueOf();
    var errorConstructor = errorTable[name] || Error;
    realError = errorConstructor(message);
  } else {
    realError = String(value);
  }
  throw realError;
};

/**
 * Create a call to a getter function.
 * @param {!Interpreter.Object} func Function to execute.
 * @param {!Interpreter.Object|!Array} left
 *     Name of variable or object/propname tuple.
 * @private
 */
Interpreter.prototype.createGetter_ = function (func, left) {
  // Normally 'this' will be specified as the object component (o.x).
  // Sometimes 'this' is explicitly provided (o).
  var funcThis = Array.isArray(left) ? left[0] : left;
  var node = new this.nodeConstructor({ options: {} });
  node['type'] = 'CallExpression';
  var state = new Interpreter.State(node,
    this.stateStack[this.stateStack.length - 1].scope);
  state.doneCallee_ = true;
  state.funcThis_ = funcThis;
  state.func_ = func;
  state.doneArgs_ = true;
  state.arguments_ = [];
  return state;
};

/**
 * Create a call to a setter function.
 * @param {!Interpreter.Object} func Function to execute.
 * @param {!Interpreter.Object|!Array} left
 *     Name of variable or object/propname tuple.
 * @param {Interpreter.Value} value Value to set.
 * @private
 */
Interpreter.prototype.createSetter_ = function (func, left, value) {
  // Normally 'this' will be specified as the object component (o.x).
  // Sometimes 'this' is implicitly the global object (x).
  var funcThis = Array.isArray(left) ? left[0] : this.global;
  var node = new this.nodeConstructor({ options: {} });
  node['type'] = 'CallExpression';
  var state = new Interpreter.State(node,
    this.stateStack[this.stateStack.length - 1].scope);
  state.doneCallee_ = true;
  state.funcThis_ = funcThis;
  state.func_ = func;
  state.doneArgs_ = true;
  state.arguments_ = [value];
  return state;
};

/**
 * Class for a state.
 * @param {!Object} node AST node for the state.
 * @param {!Interpreter.Object} scope Scope object for the state.
 * @constructor
 */
Interpreter.State = function (node, scope) {
  this.node = node;
  this.scope = scope;
};


///////////////////////////////////////////////////////////////////////////////
// Functions to handle each node type.
///////////////////////////////////////////////////////////////////////////////

Interpreter.prototype['stepArrayExpression'] = function (stack, state, node) {
  var elements = node['elements'];
  var n = state.n_ || 0;
  if (!state.array_) {
    state.array_ = this.createObjectProto(this.ARRAY_PROTO);
    state.array_.properties.length = elements.length;
  } else {
    this.setProperty(state.array_, n, state.value);
    n++;
  }
  while (n < elements.length) {
    // Skip missing elements - they're not defined, not undefined.
    if (elements[n]) {
      state.n_ = n;
      return new Interpreter.State(elements[n], state.scope);
    }
    n++;
  }
  stack.pop();
  stack[stack.length - 1].value = state.array_;
};

Interpreter.prototype['stepAssignmentExpression'] =
  function (stack, state, node) {
    if (!state.doneLeft_) {
      state.doneLeft_ = true;
      var nextState = new Interpreter.State(node['left'], state.scope);
      nextState.components = true;
      return nextState;
    }
    if (!state.doneRight_) {
      if (!state.leftReference_) {
        state.leftReference_ = state.value;
      }
      if (state.doneGetter_) {
        state.leftValue_ = state.value;
      }
      if (!state.doneGetter_ && node['operator'] !== '=') {
        var leftValue = this.getValue(state.leftReference_);
        state.leftValue_ = leftValue;
        if (leftValue && typeof leftValue === 'object' && leftValue.isGetter) {
          // Clear the getter flag and call the getter function.
          leftValue.isGetter = false;
          state.doneGetter_ = true;
          var func = /** @type {!Interpreter.Object} */ (leftValue);
          return this.createGetter_(func, state.leftReference_);
        }
      }
      state.doneRight_ = true;
      return new Interpreter.State(node['right'], state.scope);
    }
    if (state.doneSetter_) {
      // Return if setter function.
      // Setter method on property has completed.
      // Ignore its return value, and use the original set value instead.
      stack.pop();
      stack[stack.length - 1].value = state.setterValue_;
      return;
    }
    var value = state.leftValue_;
    var rightValue = state.value;
    switch (node['operator']) {
      case '=': value = rightValue; break;
      case '+=': value += rightValue; break;
      case '-=': value -= rightValue; break;
      case '*=': value *= rightValue; break;
      case '/=': value /= rightValue; break;
      case '%=': value %= rightValue; break;
      case '<<=': value <<= rightValue; break;
      case '>>=': value >>= rightValue; break;
      case '>>>=': value >>>= rightValue; break;
      case '&=': value &= rightValue; break;
      case '^=': value ^= rightValue; break;
      case '|=': value |= rightValue; break;
      default:
        throw SyntaxError('Unknown assignment expression: ' + node['operator']);
    }
    var setter = this.setValue(state.leftReference_, value);
    if (setter) {
      state.doneSetter_ = true;
      state.setterValue_ = value;
      return this.createSetter_(setter, state.leftReference_, value);
    }
    // Return if no setter function.
    stack.pop();
    stack[stack.length - 1].value = value;
  };

Interpreter.prototype['stepBinaryExpression'] = function (stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (!state.doneRight_) {
    state.doneRight_ = true;
    state.leftValue_ = state.value;
    return new Interpreter.State(node['right'], state.scope);
  }
  stack.pop();
  var leftValue = state.leftValue_;
  var rightValue = state.value;
  var value;
  switch (node['operator']) {
    case '==': value = leftValue == rightValue; break;
    case '!=': value = leftValue != rightValue; break;
    case '===': value = leftValue === rightValue; break;
    case '!==': value = leftValue !== rightValue; break;
    case '>': value = leftValue > rightValue; break;
    case '>=': value = leftValue >= rightValue; break;
    case '<': value = leftValue < rightValue; break;
    case '<=': value = leftValue <= rightValue; break;
    case '+': value = leftValue + rightValue; break;
    case '-': value = leftValue - rightValue; break;
    case '*': value = leftValue * rightValue; break;
    case '/': value = leftValue / rightValue; break;
    case '%': value = leftValue % rightValue; break;
    case '&': value = leftValue & rightValue; break;
    case '|': value = leftValue | rightValue; break;
    case '^': value = leftValue ^ rightValue; break;
    case '<<': value = leftValue << rightValue; break;
    case '>>': value = leftValue >> rightValue; break;
    case '>>>': value = leftValue >>> rightValue; break;
    case 'in':
      if (!rightValue || !rightValue.isObject) {
        this.throwException(this.TYPE_ERROR,
          "'in' expects an object, not '" + rightValue + "'");
      }
      value = this.hasProperty(rightValue, leftValue);
      break;
    case 'instanceof':
      if (!this.isa(rightValue, this.FUNCTION)) {
        this.throwException(this.TYPE_ERROR,
          'Right-hand side of instanceof is not an object');
      }
      value = leftValue.isObject ? this.isa(leftValue, rightValue) : false;
      break;
    default:
      throw SyntaxError('Unknown binary operator: ' + node['operator']);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepBlockStatement'] = function (stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
};

Interpreter.prototype['stepBreakStatement'] = function (stack, state, node) {
  var label = node['label'] && node['label']['name'];
  this.unwind(Interpreter.Completion.BREAK, undefined, label);
};

Interpreter.prototype['stepCallExpression'] = function (stack, state, node) {
  if (!state.doneCallee_) {
    state.doneCallee_ = 1;
    // Components needed to determine value of 'this'.
    var nextState = new Interpreter.State(node['callee'], state.scope);
    nextState.components = true;
    return nextState;
  }
  if (state.doneCallee_ === 1) {
    // Determine value of the function.
    state.doneCallee_ = 2;
    var func = state.value;
    if (Array.isArray(func)) {
      state.func_ = this.getValue(func);
      if (func[0] === Interpreter.SCOPE_REFERENCE) {
        // (Globally or locally) named function.  Is it named 'eval'?
        state.directEval_ = (func[1] === 'eval');
      } else {
        // Method function, 'this' is object (ignored if invoked as 'new').
        state.funcThis_ = func[0];
      }
      func = state.func_;
      if (func && typeof func === 'object' && func.isGetter) {
        // Clear the getter flag and call the getter function.
        func.isGetter = false;
        state.doneCallee_ = 1;
        return this.createGetter_(/** @type {!Interpreter.Object} */(func),
          state.value);
      }
    } else {
      // Already evaluated function: (function(){...})();
      state.func_ = func;
    }
    state.arguments_ = [];
    state.n_ = 0;
  }
  var func = state.func_;
  if (!state.doneArgs_) {
    if (state.n_ !== 0) {
      state.arguments_.push(state.value);
    }
    if (node['arguments'][state.n_]) {
      return new Interpreter.State(node['arguments'][state.n_++], state.scope);
    }
    // Determine value of 'this' in function.
    if (node['type'] === 'NewExpression') {
      if (func.illegalConstructor) {
        // Illegal: new escape();
        this.throwException(this.TYPE_ERROR, func + ' is not a constructor');
      }
      // Constructor, 'this' is new object.
      var proto = func.properties['prototype'];
      if (typeof proto !== 'object' || proto === null) {
        // Non-object prototypes default to Object.prototype.
        proto = this.OBJECT_PROTO;
      }
      state.funcThis_ = this.createObjectProto(proto);
      state.isConstructor = true;
    } else if (state.funcThis_ === undefined) {
      // Global function, 'this' is global object (or 'undefined' if strict).
      state.funcThis_ = state.scope.strict ? undefined : this.global;
    }
    state.doneArgs_ = true;
  }
  if (!state.doneExec_) {
    state.doneExec_ = true;
    if (!func || !func.isObject) {
      this.throwException(this.TYPE_ERROR, func + ' is not a function');
    }
    var funcNode = func.node;
    if (funcNode) {
      var scope = this.createScope(funcNode['body'], func.parentScope);
      // Add all arguments.
      for (var i = 0; i < funcNode['params'].length; i++) {
        var paramName = funcNode['params'][i]['name'];
        var paramValue = state.arguments_.length > i ? state.arguments_[i] :
          undefined;
        this.setProperty(scope, paramName, paramValue);
      }
      // Build arguments variable.
      var argsList = this.createObjectProto(this.ARRAY_PROTO);
      for (var i = 0; i < state.arguments_.length; i++) {
        this.setProperty(argsList, i, state.arguments_[i]);
      }
      this.setProperty(scope, 'arguments', argsList);
      // Add the function's name (var x = function foo(){};)
      var name = funcNode['id'] && funcNode['id']['name'];
      if (name) {
        this.setProperty(scope, name, func);
      }
      this.setProperty(scope, 'this', state.funcThis_,
        Interpreter.READONLY_DESCRIPTOR);
      state.value = undefined;  // Default value if no explicit return.
      return new Interpreter.State(funcNode['body'], scope);
    } else if (func.eval) {
      var code = state.arguments_[0];
      if (typeof code !== 'string') {
        // JS does not parse String objects:
        // eval(new String('1 + 1')) -> '1 + 1'
        state.value = code;
      } else {
        try {
          var ast = acorn.parse(String(code), Interpreter.PARSE_OPTIONS);
        } catch (e) {
          // Acorn threw a SyntaxError.  Rethrow as a trappable error.
          this.throwException(this.SYNTAX_ERROR, 'Invalid code: ' + e.message);
        }
        var evalNode = new this.nodeConstructor({ options: {} });
        evalNode['type'] = 'EvalProgram_';
        evalNode['body'] = ast['body'];
        this.stripLocations_(evalNode, node['start'], node['end']);
        // Create new scope and update it with definitions in eval().
        var scope = state.directEval_ ? state.scope : this.global;
        if (scope.strict) {
          // Strict mode get its own scope in eval.
          scope = this.createScope(ast, scope);
        } else {
          // Non-strict mode pollutes the current scope.
          this.populateScope_(ast, scope);
        }
        this.value = undefined;  // Default value if no code.
        return new Interpreter.State(evalNode, scope);
      }
    } else if (func.nativeFunc) {
      state.value = func.nativeFunc.apply(state.funcThis_, state.arguments_);
    } else if (func.asyncFunc) {
      var thisInterpreter = this;
      var callback = function (value) {
        state.value = value;
        thisInterpreter.paused_ = false;
      };
      // Force the argument lengths to match, then append the callback.
      var argLength = func.asyncFunc.length - 1;
      var argsWithCallback = state.arguments_.concat(
        new Array(argLength)).slice(0, argLength);
      argsWithCallback.push(callback);
      this.paused_ = true;
      func.asyncFunc.apply(state.funcThis_, argsWithCallback);
      return;
    } else {
      /* A child of a function is a function but is not callable.  For example:
      var F = function() {};
      F.prototype = escape;
      var f = new F();
      f();
      */
      this.throwException(this.TYPE_ERROR, func.class + ' is not a function');
    }
  } else {
    // Execution complete.  Put the return value on the stack.
    stack.pop();
    if (state.isConstructor && typeof state.value !== 'object') {
      stack[stack.length - 1].value = state.funcThis_;
    } else {
      stack[stack.length - 1].value = state.value;
    }
  }
};

Interpreter.prototype['stepCatchClause'] = function (stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    // Create an empty scope.
    var scope = this.createSpecialScope(state.scope);
    // Add the argument.
    this.setProperty(scope, node['param']['name'], state.throwValue);
    // Execute catch clause.
    return new Interpreter.State(node['body'], scope);
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepConditionalExpression'] =
  function (stack, state, node) {
    var mode = state.mode_ || 0;
    if (mode === 0) {
      state.mode_ = 1;
      return new Interpreter.State(node['test'], state.scope);
    }
    if (mode === 1) {
      state.mode_ = 2;
      var value = Boolean(state.value);
      if (value && node['consequent']) {
        // Execute 'if' block.
        return new Interpreter.State(node['consequent'], state.scope);
      } else if (!value && node['alternate']) {
        // Execute 'else' block.
        return new Interpreter.State(node['alternate'], state.scope);
      }
      // eval('1;if(false){2}') -> undefined
      this.value = undefined;
    }
    stack.pop();
    if (node['type'] === 'ConditionalExpression') {
      stack[stack.length - 1].value = state.value;
    }
  };

Interpreter.prototype['stepContinueStatement'] = function (stack, state, node) {
  var label = node['label'] && node['label']['name'];
  this.unwind(Interpreter.Completion.CONTINUE, undefined, label);
};

Interpreter.prototype['stepDebuggerStatement'] = function (stack, state, node) {
  // Do nothing.  May be overridden by developers.
  stack.pop();
};

Interpreter.prototype['stepDoWhileStatement'] = function (stack, state, node) {
  if (node['type'] === 'DoWhileStatement' && state.test_ === undefined) {
    // First iteration of do/while executes without checking test.
    state.value = true;
    state.test_ = true;
  }
  if (!state.test_) {
    state.test_ = true;
    return new Interpreter.State(node['test'], state.scope);
  }
  if (!state.value) {  // Done, exit loop.
    stack.pop();
  } else if (node['body']) {  // Execute the body.
    state.test_ = false;
    state.isLoop = true;
    return new Interpreter.State(node['body'], state.scope);
  }
};

Interpreter.prototype['stepEmptyStatement'] = function (stack, state, node) {
  stack.pop();
};

Interpreter.prototype['stepEvalProgram_'] = function (stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['body'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = this.value;
};

Interpreter.prototype['stepExpressionStatement'] = function (stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['expression'], state.scope);
  }
  stack.pop();
  // Save this value to interpreter.value for use as a return value if
  // this code is inside an eval function.
  this.value = state.value;
};

Interpreter.prototype['stepForInStatement'] = function (stack, state, node) {
  // First, initialize a variable if exists.  Only do so once, ever.
  if (!state.doneInit_) {
    state.doneInit_ = true;
    if (node['left']['declarations'] &&
      node['left']['declarations'][0]['init']) {
      if (state.scope.strict) {
        this.throwException(this.SYNTAX_ERROR,
          'for-in loop variable declaration may not have an initializer.');
      }
      // Variable initialization: for (var x = 4 in y)
      return new Interpreter.State(node['left'], state.scope);
    }
  }
  // Second, look up the object.  Only do so once, ever.
  if (!state.doneObject_) {
    state.doneObject_ = true;
    if (!state.variable_) {
      state.variable_ = state.value;
    }
    return new Interpreter.State(node['right'], state.scope);
  }
  if (!state.isLoop) {
    // First iteration.
    state.isLoop = true;
    state.object_ = state.value;
    state.visited_ = Object.create(null);
  }
  // Third, find the property name for this iteration.
  if (state.name_ === undefined) {
    gotPropName: while (true) {
      if (state.object_ && state.object_.isObject) {
        if (!state.props_) {
          state.props_ = Object.getOwnPropertyNames(state.object_.properties);
        }
        while (true) {
          var prop = state.props_.shift();
          if (prop === undefined) {
            break;  // Reached end of this object's properties.
          }
          if (!Object.prototype.hasOwnProperty.call(state.object_.properties,
            prop)) {
            continue;  // Property has been deleted in the loop.
          }
          if (state.visited_[prop]) {
            continue;  // Already seen this property on a child.
          }
          state.visited_[prop] = true;
          if (!Object.prototype.propertyIsEnumerable.call(
            state.object_.properties, prop)) {
            continue;  // Skip non-enumerable property.
          }
          state.name_ = prop;
          break gotPropName;
        }
      } else if (state.object_ !== null && state.object_ !== undefined) {
        // Primitive value (other than null or undefined).
        if (!state.props_) {
          state.props_ = Object.getOwnPropertyNames(state.object_);
        }
        while (true) {
          var prop = state.props_.shift();
          if (prop === undefined) {
            break;  // Reached end of this value's properties.
          }
          state.visited_[prop] = true;
          if (!Object.prototype.propertyIsEnumerable.call(
            state.object_, prop)) {
            continue;  // Skip non-enumerable property.
          }
          state.name_ = prop;
          break gotPropName;
        }
      }
      state.object_ = this.getPrototype(state.object_);
      state.props_ = null;
      if (state.object_ === null) {
        // Done, exit loop.
        stack.pop();
        return;
      }
    }
  }
  // Fourth, find the variable
  if (!state.doneVariable_) {
    state.doneVariable_ = true;
    var left = node['left'];
    if (left['type'] === 'VariableDeclaration') {
      // Inline variable declaration: for (var x in y)
      state.variable_ =
        [Interpreter.SCOPE_REFERENCE, left['declarations'][0]['id']['name']];
    } else {
      // Arbitrary left side: for (foo().bar in y)
      state.variable_ = null;
      var nextState = new Interpreter.State(left, state.scope);
      nextState.components = true;
      return nextState;
    }
  }
  if (!state.variable_) {
    state.variable_ = state.value;
  }
  // Fifth, set the variable.
  if (!state.doneSetter_) {
    state.doneSetter_ = true;
    var value = state.name_;
    var setter = this.setValue(state.variable_, value);
    if (setter) {
      return this.createSetter_(setter, state.variable_, value);
    }
  }
  // Next step will be step three.
  state.name_ = undefined;
  // Reevaluate the variable since it could be a setter on the global object.
  state.doneVariable_ = false;
  state.doneSetter_ = false;
  // Sixth and finally, execute the body if there was one.  this.
  if (node['body']) {
    return new Interpreter.State(node['body'], state.scope);
  }
};

Interpreter.prototype['stepForStatement'] = function (stack, state, node) {
  var mode = state.mode_ || 0;
  if (mode === 0) {
    state.mode_ = 1;
    if (node['init']) {
      return new Interpreter.State(node['init'], state.scope);
    }
  } else if (mode === 1) {
    state.mode_ = 2;
    if (node['test']) {
      return new Interpreter.State(node['test'], state.scope);
    }
  } else if (mode === 2) {
    state.mode_ = 3;
    if (node['test'] && !state.value) {
      // Done, exit loop.
      stack.pop();
    } else {  // Execute the body.
      state.isLoop = true;
      return new Interpreter.State(node['body'], state.scope);
    }
  } else if (mode === 3) {
    state.mode_ = 1;
    if (node['update']) {
      return new Interpreter.State(node['update'], state.scope);
    }
  }
};

Interpreter.prototype['stepFunctionDeclaration'] =
  function (stack, state, node) {
    // This was found and handled when the scope was populated.
    stack.pop();
  };

Interpreter.prototype['stepFunctionExpression'] = function (stack, state, node) {
  stack.pop();
  stack[stack.length - 1].value = this.createFunction(node, state.scope);
};

Interpreter.prototype['stepIdentifier'] = function (stack, state, node) {
  stack.pop();
  if (state.components) {
    stack[stack.length - 1].value = [Interpreter.SCOPE_REFERENCE, node['name']];
    return;
  }
  var value = this.getValueFromScope(node['name']);
  // An identifier could be a getter if it's a property on the global object.
  if (value && typeof value === 'object' && value.isGetter) {
    // Clear the getter flag and call the getter function.
    value.isGetter = false;
    var scope = state.scope;
    while (!this.hasProperty(scope, node['name'])) {
      scope = scope.parentScope;
    }
    var func = /** @type {!Interpreter.Object} */ (value);
    return this.createGetter_(func, this.global);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepIfStatement'] =
  Interpreter.prototype['stepConditionalExpression'];

Interpreter.prototype['stepLabeledStatement'] = function (stack, state, node) {
  // No need to hit this node again on the way back up the stack.
  stack.pop();
  // Note that a statement might have multiple labels.
  var labels = state.labels || [];
  labels.push(node['label']['name']);
  var nextState = new Interpreter.State(node['body'], state.scope);
  nextState.labels = labels;
  return nextState;
};

Interpreter.prototype['stepLiteral'] = function (stack, state, node) {
  stack.pop();
  var value = node['value'];
  if (value instanceof RegExp) {
    var pseudoRegexp = this.createObjectProto(this.REGEXP_PROTO);
    this.populateRegExp(pseudoRegexp, value);
    value = pseudoRegexp;
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepLogicalExpression'] = function (stack, state, node) {
  if (node['operator'] !== '&&' && node['operator'] !== '||') {
    throw SyntaxError('Unknown logical operator: ' + node['operator']);
  }
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    return new Interpreter.State(node['left'], state.scope);
  }
  if (!state.doneRight_) {
    if ((node['operator'] === '&&' && !state.value) ||
      (node['operator'] === '||' && state.value)) {
      // Shortcut evaluation.
      stack.pop();
      stack[stack.length - 1].value = state.value;
    } else {
      state.doneRight_ = true;
      return new Interpreter.State(node['right'], state.scope);
    }
  } else {
    stack.pop();
    stack[stack.length - 1].value = state.value;
  }
};

Interpreter.prototype['stepMemberExpression'] = function (stack, state, node) {
  if (!state.doneObject_) {
    state.doneObject_ = true;
    return new Interpreter.State(node['object'], state.scope);
  }
  var propName;
  if (!node['computed']) {
    state.object_ = state.value;
    // obj.foo -- Just access 'foo' directly.
    propName = node['property']['name'];
  } else if (!state.doneProperty_) {
    state.object_ = state.value;
    // obj[foo] -- Compute value of 'foo'.
    state.doneProperty_ = true;
    return new Interpreter.State(node['property'], state.scope);
  } else {
    propName = state.value;
  }
  stack.pop();
  if (state.components) {
    stack[stack.length - 1].value = [state.object_, propName];
  } else {
    var value = this.getProperty(state.object_, propName);
    if (value && typeof value === 'object' && value.isGetter) {
      // Clear the getter flag and call the getter function.
      value.isGetter = false;
      var func = /** @type {!Interpreter.Object} */ (value);
      return this.createGetter_(func, state.object_);
    }
    stack[stack.length - 1].value = value;
  }
};

Interpreter.prototype['stepNewExpression'] =
  Interpreter.prototype['stepCallExpression'];

Interpreter.prototype['stepObjectExpression'] = function (stack, state, node) {
  var n = state.n_ || 0;
  var property = node['properties'][n];
  if (!state.object_) {
    // First execution.
    state.object_ = this.createObjectProto(this.OBJECT_PROTO);
    state.properties_ = Object.create(null);
  } else {
    // Determine property name.
    var key = property['key'];
    if (key['type'] === 'Identifier') {
      var propName = key['name'];
    } else if (key['type'] === 'Literal') {
      var propName = key['value'];
    } else {
      throw SyntaxError('Unknown object structure: ' + key['type']);
    }
    // Set the property computed in the previous execution.
    if (!state.properties_[propName]) {
      // Create temp object to collect value, getter, and/or setter.
      state.properties_[propName] = {};
    }
    state.properties_[propName][property['kind']] = state.value;
    state.n_ = ++n;
    property = node['properties'][n];
  }
  if (property) {
    return new Interpreter.State(property['value'], state.scope);
  }
  for (var key in state.properties_) {
    var kinds = state.properties_[key];
    if ('get' in kinds || 'set' in kinds) {
      // Set a property with a getter or setter.
      var descriptor = {
        configurable: true,
        enumerable: true,
        get: kinds['get'],
        set: kinds['set']
      };
      this.setProperty(state.object_, key, Interpreter.VALUE_IN_DESCRIPTOR,
        descriptor);
    } else {
      // Set a normal property with a value.
      this.setProperty(state.object_, key, kinds['init']);
    }
  }
  stack.pop();
  stack[stack.length - 1].value = state.object_;
};

Interpreter.prototype['stepProgram'] = function (stack, state, node) {
  var expression = node['body'].shift();
  if (expression) {
    state.done = false;
    return new Interpreter.State(expression, state.scope);
  }
  state.done = true;
  // Don't pop the stateStack.
  // Leave the root scope on the tree in case the program is appended to.
};

Interpreter.prototype['stepReturnStatement'] = function (stack, state, node) {
  if (node['argument'] && !state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['argument'], state.scope);
  }
  this.unwind(Interpreter.Completion.RETURN, state.value, undefined);
};

Interpreter.prototype['stepSequenceExpression'] = function (stack, state, node) {
  var n = state.n_ || 0;
  var expression = node['expressions'][n];
  if (expression) {
    state.n_ = n + 1;
    return new Interpreter.State(expression, state.scope);
  }
  stack.pop();
  stack[stack.length - 1].value = state.value;
};

Interpreter.prototype['stepSwitchStatement'] = function (stack, state, node) {
  if (!state.test_) {
    state.test_ = 1;
    return new Interpreter.State(node['discriminant'], state.scope);
  }
  if (state.test_ === 1) {
    state.test_ = 2;
    // Preserve switch value between case tests.
    state.switchValue_ = state.value;
    state.defaultCase_ = -1;
  }

  while (true) {
    var index = state.index_ || 0;
    var switchCase = node['cases'][index];
    if (!state.matched_ && switchCase && !switchCase['test']) {
      // Test on the default case is null.
      // Bypass (but store) the default case, and get back to it later.
      state.defaultCase_ = index;
      state.index_ = index + 1;
      continue;
    }
    if (!switchCase && !state.matched_ && state.defaultCase_ !== -1) {
      // Ran through all cases, no match.  Jump to the default.
      state.matched_ = true;
      state.index_ = state.defaultCase_;
      continue;
    }
    if (switchCase) {
      if (!state.matched_ && !state.tested_ && switchCase['test']) {
        state.tested_ = true;
        return new Interpreter.State(switchCase['test'], state.scope);
      }
      if (state.matched_ || state.value === state.switchValue_) {
        state.matched_ = true;
        var n = state.n_ || 0;
        if (switchCase['consequent'][n]) {
          state.isSwitch = true;
          state.n_ = n + 1;
          return new Interpreter.State(switchCase['consequent'][n],
            state.scope);
        }
      }
      // Move on to next case.
      state.tested_ = false;
      state.n_ = 0;
      state.index_ = index + 1;
    } else {
      stack.pop();
      return;
    }
  }
};

Interpreter.prototype['stepThisExpression'] = function (stack, state, node) {
  stack.pop();
  stack[stack.length - 1].value = this.getValueFromScope('this');
};

Interpreter.prototype['stepThrowStatement'] = function (stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    return new Interpreter.State(node['argument'], state.scope);
  } else {
    this.throwException(state.value);
  }
};

Interpreter.prototype['stepTryStatement'] = function (stack, state, node) {
  if (!state.doneBlock_) {
    state.doneBlock_ = true;
    return new Interpreter.State(node['block'], state.scope);
  }
  if (state.cv && state.cv.type === Interpreter.Completion.THROW &&
    !state.doneHandler_ && node['handler']) {
    state.doneHandler_ = true;
    var nextState = new Interpreter.State(node['handler'], state.scope);
    nextState.throwValue = state.cv.value;
    state.cv = undefined;  // This error has been handled, don't rethrow.
    return nextState;
  }
  if (!state.doneFinalizer_ && node['finalizer']) {
    state.doneFinalizer_ = true;
    return new Interpreter.State(node['finalizer'], state.scope);
  }
  stack.pop();
  if (state.cv) {
    // There was no catch handler, or the catch/finally threw an error.
    // Throw the error up to a higher try.
    this.unwind(state.cv.type, state.cv.value, state.cv.label);
  }
};

Interpreter.prototype['stepUnaryExpression'] = function (stack, state, node) {
  if (!state.done_) {
    state.done_ = true;
    var nextState = new Interpreter.State(node['argument'], state.scope);
    nextState.components = node['operator'] === 'delete';
    return nextState;
  }
  stack.pop();
  var value = state.value;
  if (node['operator'] === '-') {
    value = -value;
  } else if (node['operator'] === '+') {
    value = +value;
  } else if (node['operator'] === '!') {
    value = !value;
  } else if (node['operator'] === '~') {
    value = ~value;
  } else if (node['operator'] === 'delete') {
    var result = true;
    // If value is not an array, then it is a primitive, or some other value.
    // If so, skip the delete and return true.
    if (Array.isArray(value)) {
      var obj = value[0];
      if (obj === Interpreter.SCOPE_REFERENCE) {
        // 'delete foo;' is the same as 'delete window.foo'.
        obj = state.scope;
      }
      var name = String(value[1]);
      try {
        delete obj.properties[name];
      } catch (e) {
        if (state.scope.strict) {
          this.throwException(this.TYPE_ERROR, "Cannot delete property '" +
            name + "' of '" + obj + "'");
        } else {
          result = false;
        }
      }
    }
    value = result;
  } else if (node['operator'] === 'typeof') {
    value = (value && value.class === 'Function') ? 'function' : typeof value;
  } else if (node['operator'] === 'void') {
    value = undefined;
  } else {
    throw SyntaxError('Unknown unary operator: ' + node['operator']);
  }
  stack[stack.length - 1].value = value;
};

Interpreter.prototype['stepUpdateExpression'] = function (stack, state, node) {
  if (!state.doneLeft_) {
    state.doneLeft_ = true;
    var nextState = new Interpreter.State(node['argument'], state.scope);
    nextState.components = true;
    return nextState;
  }
  if (!state.leftSide_) {
    state.leftSide_ = state.value;
  }
  if (state.doneGetter_) {
    state.leftValue_ = state.value;
  }
  if (!state.doneGetter_) {
    var leftValue = this.getValue(state.leftSide_);
    state.leftValue_ = leftValue;
    if (leftValue && typeof leftValue === 'object' && leftValue.isGetter) {
      // Clear the getter flag and call the getter function.
      leftValue.isGetter = false;
      state.doneGetter_ = true;
      var func = /** @type {!Interpreter.Object} */ (leftValue);
      return this.createGetter_(func, state.leftSide_);
    }
  }
  if (state.doneSetter_) {
    // Return if setter function.
    // Setter method on property has completed.
    // Ignore its return value, and use the original set value instead.
    stack.pop();
    stack[stack.length - 1].value = state.setterValue_;
    return;
  }
  var leftValue = Number(state.leftValue_);
  var changeValue;
  if (node['operator'] === '++') {
    changeValue = leftValue + 1;
  } else if (node['operator'] === '--') {
    changeValue = leftValue - 1;
  } else {
    throw SyntaxError('Unknown update expression: ' + node['operator']);
  }
  var returnValue = node['prefix'] ? changeValue : leftValue;
  var setter = this.setValue(state.leftSide_, changeValue);
  if (setter) {
    state.doneSetter_ = true;
    state.setterValue_ = returnValue;
    return this.createSetter_(setter, state.leftSide_, changeValue);
  }
  // Return if no setter function.
  stack.pop();
  stack[stack.length - 1].value = returnValue;
};

Interpreter.prototype['stepVariableDeclaration'] = function (stack, state, node) {
  var declarations = node['declarations'];
  var n = state.n_ || 0;
  var declarationNode = declarations[n];
  if (state.init_ && declarationNode) {
    // This setValue call never needs to deal with calling a setter function.
    // Note that this is setting the init value, not defining the variable.
    // Variable definition is done when scope is populated.
    this.setValueToScope(declarationNode['id']['name'], state.value);
    state.init_ = false;
    declarationNode = declarations[++n];
  }
  while (declarationNode) {
    // Skip any declarations that are not initialized.  They have already
    // been defined as undefined in populateScope_.
    if (declarationNode['init']) {
      state.n_ = n;
      state.init_ = true;
      return new Interpreter.State(declarationNode['init'], state.scope);
    }
    declarationNode = declarations[++n];
  }
  stack.pop();
};

Interpreter.prototype['stepWithStatement'] = function (stack, state, node) {
  if (!state.doneObject_) {
    state.doneObject_ = true;
    return new Interpreter.State(node['object'], state.scope);
  } else if (!state.doneBody_) {
    state.doneBody_ = true;
    var scope = this.createSpecialScope(state.scope, state.value);
    return new Interpreter.State(node['body'], scope);
  } else {
    stack.pop();
  }
};

Interpreter.prototype['stepWhileStatement'] =
  Interpreter.prototype['stepDoWhileStatement'];