const NodeTypes = require('./types');
const ScopeManager = require('./scopeManager');

function matchFunc(node, scope) {
  if (node.body.type === NodeTypes.BlockStatement) {
    // node.body.body.map(bodyNode => {
    //   let r = match(bodyNode, scopeInFunc);
    // });
    scope.setById(node.id, node.body.body);
  } else {
  }
}


function matchDeclaration(node ,scope) {
  return node.declarations.map(decNode => {
    const init = match(decNode.init, scope);
    console.log('id:', decNode.id.name, init);
    scope.setById(decNode.id, init)
    return decNode.init;
  })
}

function findExpression(node, scope) {
  switch (node.type) {
    case NodeTypes.ArrowFunctionExpression:
    case NodeTypes.FunctionExpression:
      return node;
    case NodeTypes.ArrayExpression:
      return node.elements.map(eleNode => match(eleNode, scope));
    default:

  }
}

function getPrimitiveType (node, scope) {
  switch (node.type) {
    case NodeTypes.NullLiteral:
      return null;
    default:
      return node.value;
  }
}

function match (node, scope) {
  const type = node.type;
  switch (type) {
    case NodeTypes.Identifier:
      if (node.name === 'undefined') {
        return undefined
      }
    case NodeTypes.FunctionDeclaration:
    case NodeTypes.ClassMethod:
      return matchFunc(node, scope);
    case NodeTypes.MethodDefinition:
      return matchFunc(node.value, scope)
    case NodeTypes.VariableDeclaration:
      return matchDeclaration(node, scope)
    case NodeTypes.ArrowFunctionExpression:
    case NodeTypes.FunctionExpression:
    case NodeTypes.ArrayExpression:
      return findExpression(node, scope)
    case NodeTypes.CallExpression:
      return 'callFunc';
    case NodeTypes.Literal:
    case NodeTypes.NumericLiteral:
    case NodeTypes.StringLiteral:
    case NodeTypes.BooleanLiteral:
    case NodeTypes.NullLiteral:
      return getPrimitiveType(node, scope);
  }
}

function callFunc (node, scope) {
  let scopeInFunc = new ScopeManager(scope);
  console.log(node.body);
  if (node.body.type === NodeTypes.BlockStatement) {
    switch (node.type) {
      case NodeTypes.ClassMethod:
      case NodeTypes.ArrowFunctionExpression:
      case NodeTypes.FunctionExpression:
      case NodeTypes.ArrayExpression:
      case NodeTypes.MethodDefinition:
        const blockBody = node.body.body;
        blockBody.forEach(n => {
          let r = match(n, scopeInFunc);
        })
    }
  } else {
    return match(node.body);
  }
}

exports.match = match;
exports.callFunc = callFunc;
