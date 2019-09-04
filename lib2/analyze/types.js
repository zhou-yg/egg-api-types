global.NodeTypes = {};

// class
global.NodeTypes.ClassDeclaration = 'ClassDeclaration';

// 函数
global.NodeTypes.ThisExpression = 'ThisExpression';
global.NodeTypes.ArrowFunctionExpression = 'ArrowFunctionExpression';
global.NodeTypes.FunctionExpression = 'FunctionExpression';
global.NodeTypes.FunctionDeclaration = 'FunctionDeclaration';
global.NodeTypes.ClassMethod = 'ClassMethod'; // ts
global.NodeTypes.MethodDefinition = 'MethodDefinition'; // js
global.NodeTypes.ObjectMethod = 'ObjectMethod';


global.NodeTypes.BlockStatement = 'BlockStatement';

global.NodeTypes.ReturnStatement = 'ReturnStatement';

global.NodeTypes.FUNCTION_CALL = 'call';
global.NodeTypes.FUNCTION_APPLY = 'APPLY';

global.NodeTypes.FunctionTypes = [
  NodeTypes.ClassMethod,
  NodeTypes.FunctionExpression,
  NodeTypes.FunctionDeclaration,
  NodeTypes.MethodDefinition,
  NodeTypes.ArrowFunctionExpression,
  NodeTypes.ObjectMethod,
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
global.NodeTypes.BinaryExpression = 'BinaryExpression';

// 赋值
global.NodeTypes.ExpressionStatement = 'ExpressionStatement';
global.NodeTypes.AssignmentExpression = 'AssignmentExpression';
// 赋值obj属性
global.NodeTypes.MemberExpression = 'MemberExpression';

// 使用变量
global.NodeTypes.Identifier = 'Identifier';
// primitive 原始类型
global.NodeTypes.Literal = 'Literal';
global.NodeTypes.NumericLiteral = 'NumericLiteral';
global.NodeTypes.StringLiteral = 'StringLiteral';
global.NodeTypes.BooleanLiteral = 'BooleanLiteral';
global.NodeTypes.NullLiteral = 'NullLiteral';
// ``模版字符串 & 模版字符串中的字符串单元
global.NodeTypes.TemplateLiteral = 'TemplateLiteral';
global.NodeTypes.TemplateElement = 'TemplateElement';

module.exports = NodeTypes;
