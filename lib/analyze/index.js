require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const T = require('@babel/types');

const { callFunc, match, initClass } = require('./serializeNode');
const { ScopeManager, PARSE_MODE } = require('./scopeManager');
const ZAKU_START = 'ZAKU_START';


function wrapperToCallExpression (path) {
  const node = path.node;

  if (node.type === NodeTypes.ClassMethod) {
    let object = T.identifier(path.scope.parent.path.node.id.name);
    let property = T.identifier(node.key.name);
    let me = T.memberExpression(object, property);

    return T.callExpression(me, []);

  } else if ([
    NodeTypes.CallExpression,
    ...NodeTypes.FunctionTypes,
  ].includes(node.type)) {
    const callFuncName = T.identifier(node.id.name);
    return T.callExpression(callFuncName, []);
  } else  {
    return T.callExpression(node, [])
  }
}

function initScope(ast, topScope) {
  ast.program.body.forEach(topNode => {
    match(topNode, topScope);
  });
}

function findEntry(ast, topScope) {
  const arr = [];
  traverse(ast, {
    enter(path) {
      if (path[ZAKU_START]) {
        arr.push(path);

        if (path.node.type) {          
        }
      }
    },
  })

  return arr;
}

exports.ZAKU_START = ZAKU_START;

exports.analyze = (ast) => {

  const topScope = new ScopeManager();

  initScope(ast, topScope);
  console.log("TCL: exports.analyze -> topScope", topScope)
  console.log('-----topScope init------');

  let arr = findEntry(ast, topScope);

  let r = arr.map((path) => {

    let callRessult;
    if (path.node.type === NodeTypes.ClassMethod) {
      let classIns = initClass(path.scope.parent.path.node);

      callRessult = callFunc(path.node, topScope, classIns, []);
    } else {
      const callExpressionNode = wrapperToCallExpression(path);
      console.log("TCL: exports.analyze -> callExpressionNode", callExpressionNode)
      
      callRessult = match(callExpressionNode, topScope);
    }

    return callRessult;
  });
  return r;
};

exports.PARSE_MODE = PARSE_MODE;