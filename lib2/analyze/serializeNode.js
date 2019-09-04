const NodeTypes = require('./types');
const {ScopeManager, GLOBAL} = require('./scopeManager');

function matchFunc(node, scope) {
  if (node.body.type === NodeTypes.BlockStatement) {
    scope.setById(node.id, node);
  } else {
    throw new Error('matchFunc:' + node.type + ' ' + node.body.type);
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
        switch (propNode.type) {
          case NodeTypes.ObjectProperty:
            return obj[propNode.key.name] = match(propNode.value, scope);
          case NodeTypes.ObjectMethod:
            return obj[propNode.key.name] = match(propNode, scope);
        }
      });
      return obj;
    case NodeTypes.MemberExpression:
      {
        const obj = match(node.object, scope);
        const propName = node.property.name;
        
        if (obj) {
          if (NodeTypes.FunctionTypes.includes(obj.type)) {
            if ([NodeTypes.FUNCTION_CALL, NodeTypes.FUNCTION_APPLY].includes(propName)) {
              return obj;
            }
          }
          if (obj && Object.keys(obj).includes(propName)) {
            return obj[propName];
          }
        } else {
          return `${obj}.${propName}`          
        }
      }
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
        {
          const targetObj = match(left.object, scope);
          const key = left.computed ? match(left.property, scope) : left.property.name;
          const value = match(right, scope);
          targetObj[key] = value;
        }
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
        return scope.getByName(node.name) || node.name;
      }
    
    case NodeTypes.ClassDeclaration:
      return initClass(node, scope);
    case NodeTypes.FunctionDeclaration:
    case NodeTypes.ClassMethod:
    case NodeTypes.ObjectMethod:
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
    case NodeTypes.MemberExpression:
      return findExpression(node, scope)
    case NodeTypes.ExpressionStatement:
      return makeExpressionStatement(node, scope)
    case NodeTypes.CallExpression:
      {
        return callFunc(node, scope);
      }
    case NodeTypes.Literal:
    case NodeTypes.NumericLiteral:
    case NodeTypes.StringLiteral:
    case NodeTypes.BooleanLiteral:
    case NodeTypes.NullLiteral:
    case NodeTypes.TemplateLiteral:
      return getPrimitiveType(node, scope);
    case NodeTypes.ThisExpression:
      return scope.getThis();
  }
}

function findThis (node, scope) {
  
  switch (node.type) {
    case NodeTypes.CallExpression:
      if (node.callee.type === NodeTypes.MemberExpression) {

        return match(node.callee.object, scope);
      }
      break;
    case NodeTypes.ClassMethod:
    case NodeTypes.MethodDefinition:
      //
      break;
  }

  return GLOBAL;
}

function initClass(node, scope) {
  let classIns = {};

  node.body.body.forEach(classBodyNode => {
    if (classBodyNode.key.name === 'constructor') {
      callFunc(classBodyNode, scope, classIns);
    } else {
      classIns[classBodyNode.key.name] = classBodyNode;
    }
  });

  scope.setById(node.id, classIns);
}


function callFunc (node, scope, classIns) {
  let calleeNode, args;
  let thisObject;

  if (node.type === NodeTypes.CallExpression) {
    calleeNode = match(node.callee, scope);
    args = node.arguments;
    thisObject = findThis(node, scope);
  } else {
    if (node.type === NodeTypes.ClassMethod) {
      thisObject = classIns;
    } else {
      thisObject = GLOBAL;
    }
    // will loss this
    calleeNode = node;
    args = [];
  }

  if (!calleeNode) {
    // throw new Error('callFunc: calleeNode is undefined or noexist');
    return {
      ...node,
      arguments: node.arguments.map(n => match(n, scope)),
    };
  }
  console.log("TCL: callFunc -> thisObject", calleeNode, thisObject)

  const scopeInFunc = new ScopeManager(scope, thisObject);

  console.log("TCL: callFunc -> scopeInFunc", thisObject)

  
  calleeNode.params.forEach((paramId, i) => {
    scopeInFunc.setById(paramId, match(args[i], scope));
  });

  // console.log("TCL: callFunc -> calleeNode", calleeNode, scopeInFunc)

  if (calleeNode.body.type === NodeTypes.BlockStatement) {
    switch (calleeNode.type) {
      case NodeTypes.ClassMethod:
      case NodeTypes.FunctionExpression:
      case NodeTypes.FunctionDeclaration:
      case NodeTypes.MethodDefinition:
      case NodeTypes.ObjectMethod:
        scopeInFunc.setById('arguments', args); // 只有箭头函数没有arguments
      case NodeTypes.ArrowFunctionExpression:
        const funcBody = calleeNode.body.body;
        funcBody.filter(n => n.type !== NodeTypes.ReturnStatement).forEach(n => {
          match(n, scopeInFunc);
        });
        const returnNode = funcBody.find(n => n.type === NodeTypes.ReturnStatement);
        return returnNode ? match(returnNode, scopeInFunc) : undefined;
    }
  } else {
    return match(calleeNode.body, scopeInFunc);
  }
}

exports.match = match;
exports.callFunc = callFunc;
