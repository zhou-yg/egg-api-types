import Interpreter from  './core';
import './init';
import './native';
import './scope';
import './utils';
import './step';

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

export default Interpreter;