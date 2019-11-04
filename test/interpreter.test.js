const Interpreter = require('../lib/interpreter/index');

const code = `
var a = 1;
var b = {
  c: a,
  fn: function () {
    return this.c;
  },
};
console.log(b.fn());
`;

const myInterpreter = new Interpreter(code, function (interpreter, scope) {
  // interpreter.setProperty(scope, 'console', console);
  interpreter.setProperty(scope, 'console', interpreter.nativeToPseudo(console));
});

myInterpreter.run();