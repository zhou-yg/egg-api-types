global.NodeTypes = {};

// 函数
global.NodeTypes.ArrowFunctionExpression = 'ArrowFunctionExpression';
global.NodeTypes.FunctionExpression = 'FunctionExpression';
global.NodeTypes.FunctionDeclaration = 'FunctionDeclaration';
global.NodeTypes.ClassMethod = 'ClassMethod'; // ts
global.NodeTypes.MethodDefinition = 'MethodDefinition'; // js


global.NodeTypes.BlockStatement = 'BlockStatement';

global.NodeTypes.ReturnStatement = 'ReturnStatement';

global.NodeTypes.FunctionTypes = [
  global.NodeTypes.ArrowFunctionExpression,
  global.NodeTypes.FunctionExpression,
  global.NodeTypes.FunctionDeclaration,
  global.NodeTypes.ClassMethod,
];

// new操作生成实例
global.NodeTypes.NewExpression = 'NewExpression';

//声明
global.NodeTypes.VariableDeclaration = 'VariableDeclaration';
global.NodeTypes.VariableDeclarator = 'VariableDeclarator';

// 表达式
global.NodeTypes.CallExpression = 'CallExpression';
global.NodeTypes.ObjectExpression = 'ObjectExpression';
global.NodeTypes.ArrayExpression = 'ArrayExpression';

// primitive 原始类型
global.NodeTypes.Identifier = 'Identifier';
global.NodeTypes.Literal = 'Literal';
global.NodeTypes.NumericLiteral = 'NumericLiteral';
global.NodeTypes.StringLiteral = 'StringLiteral';
global.NodeTypes.BooleanLiteral = 'BooleanLiteral';
global.NodeTypes.NullLiteral = 'NullLiteral';

module.exports = NodeTypes;
