const T = require('@babel/types');

exports.createNodeByType = function createLiteralByType (v) {
  let type = typeof v;
  type = !v && type === 'object' ? 'null' : type;
  
  const map = {
    boolean: T.booleanLiteral,
    string: T.stringLiteral,
    number: T.numericLiteral,
    null: T.nullLiteral,
  };

  if (!map[type]) {
    throw new Error(`unsupport createNodeType ==> ${type} ${v}`)
  }

  return map[type](v);
}

exports.doCal = function doCal (l, r, op) {
  switch (op) {
    case '+':
      return l + r;
    case '-':
      return l - r;
    case '*':
      return l * r;
    case '/':
      return l / r;
    default: 
      throw new Error(`unsupport operator ==> ${op}`);
  }
}