const NodeTypes = require('./types');
const {ScopeManager} = require('./scopeManager');

function matchFunc(node, scope) {
  if (node.body.type === NodeTypes.BlockStatement) {
    // node.body.body.map(bodyNode => {
    //   let r = match(bodyNode, scopeInFunc);
    // });
    scope.setById(node.id, node);
  } else {
  }
}


function matchDeclaration(node ,scope) {
  return node.declarations.map(decNode => {
    const init = match(decNode.init, scope);
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
    case NodeTypes.BinaryExpression:
      return {
        left: match(node.left, scope),
        operator: node.operator,
        right: match(node.right, scope),
      };
    case NodeTypes.ObjectExpression:
      const obj = {};
      node.properties.forEach(propNode => {
        obj[propNode.key.name] = match(propNode.value, scope);
      });
      return obj;
    case NodeTypes.Identifier:
      return scope.getByName(node.name);
    default:

  }
}

function getPrimitiveType (node, scope) {
  switch (node.type) {
    case NodeTypes.NullLiteral:
      return null;
    case NodeTypes.TemplateLiteral:
      const { quasis, expressions } = node;
      return [...quasis, ...expressions].sort((p, n)=> {
        return p.start >= n.start ? 1 : -1;
      }).map(n => {
        switch (n.type) {
          case NodeTypes.TemplateElement:
            return n.value.raw;
          default:
            return match(n, scope);
        }
      }).join('');
    default:
      return node.value;
  }
}

function makeExpressionStatement (node, scope) {
  if (node.expression.type === NodeTypes.AssignmentExpression) {
    const left = node.expression.left;
    const right = node.expression.right;
    switch (left.type) {
      case NodeTypes.MemberExpression:
        const targetObj = scope.getByName(left.object.name);
        const key = left.computed ? match(left.property, scope) : left.property.name;
        const value = match(right, scope);
        targetObj[key] = value;
        break;
      case NodeTypes.Identifier:
        const targetValue = match(right, scope);
        scope.setByName(left.name, targetValue);
    }
  }
}

function match (node, scope) {
  const type = node.type;
  switch (type) {
    case NodeTypes.Identifier:
      if (node.name === 'undefined') {
        return undefined
      } else {
        return scope.getByName(node.name);
      }
    case NodeTypes.FunctionDeclaration:
    case NodeTypes.ClassMethod:
      return matchFunc(node, scope);
    case NodeTypes.MethodDefinition:
      return matchFunc(node.value, scope)
    case NodeTypes.VariableDeclaration:
      return matchDeclaration(node, scope)
    case NodeTypes.ReturnStatement:
      return match(node.argument, scope);
    case NodeTypes.ArrowFunctionExpression:
    case NodeTypes.FunctionExpression:
    case NodeTypes.ArrayExpression:
    case NodeTypes.BinaryExpression:
    case NodeTypes.ObjectExpression:
      return findExpression(node, scope)
    case NodeTypes.ExpressionStatement:
      return makeExpressionStatement(node, scope)
    case NodeTypes.CallExpression:
      return callFunc(scope.getByName(node.callee.name), scope);
    case NodeTypes.Literal:
    case NodeTypes.NumericLiteral:
    case NodeTypes.StringLiteral:
    case NodeTypes.BooleanLiteral:
    case NodeTypes.NullLiteral:
    case NodeTypes.TemplateLiteral:
      return getPrimitiveType(node, scope);
  }
}

function callFunc (node, scope) {
  if (!node) {
    throw new Error('callFunc: node is undefined');
  }
  let scopeInFunc = new ScopeManager(scope);
  console.log('-----> callFunc', 
    node.type, (node.id || node.key).name, node.body.type,
    scope,
  ' <---- ');
  if (node.body.type === NodeTypes.BlockStatement) {
    switch (node.type) {
      case NodeTypes.ClassMethod:
      case NodeTypes.ArrowFunctionExpression:
      case NodeTypes.FunctionExpression:
      case NodeTypes.FunctionDeclaration:
      case NodeTypes.MethodDefinition:
        const funcBody = node.body.body;
        funcBody.filter(n => n.type !== NodeTypes.ReturnStatement).forEach(n => {
          let r = match(n, scopeInFunc);
        });
        const returnNode = funcBody.find(n => n.type === NodeTypes.ReturnStatement);
        return match(returnNode, scopeInFunc);
    }
  } else if (node.body.type === NodeTypes.ReturnStatement) {
    return match(node.body, scope);
  }
}

exports.match = match;
exports.callFunc = callFunc;
