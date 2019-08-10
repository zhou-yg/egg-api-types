const NodeTypes = require('./types');
const ScopeManager = require('./scopeManager');

function matchFunc(node, scope) {
  let scopeInFunc = new ScopeManager(scope);
  if (node.body.type === NodeTypes.BlockStatement) {
    node.body.body.map(bodyNode => {
      let r = match(bodyNode, scopeInFunc);
      console.log('bodyNode r:', r);
    })
  }
}

function matchDeclaration(node ,scope) {
  node.declarations.map(decNode => {
    const init = match(decNode.init, scope);
    console.log('id:', decNode.id.name, init)
  })
}

function findExpression(node, scope) {
  switch (node.type) {
    case NodeTypes.CallExpression:
      let r = scope.getByName(node.callee.name)
      return r;
      break;
    default:

  }
}

function match (node, scope) {
  const type = node.type;
  console.log(type)
  switch (type) {
    case NodeTypes.ArrowFunctionExpression:
    case NodeTypes.FunctionExpression:
    case NodeTypes.FunctionDeclaration:
    case NodeTypes.ClassMethod:
      return matchFunc(node, scope);
    case NodeTypes.MethodDefinition:
      return matchFunc(node.value, scope)
    case NodeTypes.VariableDeclaration:
      return matchDeclaration(node, scope)
    case NodeTypes.CallExpression:
      return findExpression(node, scope)
  }
}

exports.match = match;
