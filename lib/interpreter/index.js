require('./acorn');
const Interpreter = require('./core');
require('./init');
require('./native');
require('./scope');
require('./utils');
require('./step');

this['Interpreter'] = Interpreter;
Interpreter.prototype['step'] = Interpreter.prototype.step;
Interpreter.prototype['run'] = Interpreter.prototype.run;
Interpreter.prototype['appendCode'] = Interpreter.prototype.appendCode;
Interpreter.prototype['createObject'] = Interpreter.prototype.createObject;
Interpreter.prototype['createObjectProto'] =
  Interpreter.prototype.createObjectProto;
Interpreter.prototype['createAsyncFunction'] =
  Interpreter.prototype.createAsyncFunction;
Interpreter.prototype['createNativeFunction'] =
  Interpreter.prototype.createNativeFunction;
Interpreter.prototype['getProperty'] = Interpreter.prototype.getProperty;
Interpreter.prototype['setProperty'] = Interpreter.prototype.setProperty;
Interpreter.prototype['nativeToPseudo'] = Interpreter.prototype.nativeToPseudo;
Interpreter.prototype['pseudoToNative'] = Interpreter.prototype.pseudoToNative;
// Obsolete.  Do not use.
Interpreter.prototype['createPrimitive'] = function (x) { return x; };

module.exports = Interpreter;