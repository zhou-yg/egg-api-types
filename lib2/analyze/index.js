require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const T = require('@babel/types');

const { callFunc, match } = require('./serializeNode');
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
    return node;
  } else  {
    return T.callExpression(node, [])
  }
}

function initScope(ast, topScope) {
  ast.program.body.forEach(topNode => {
    match(topNode, topScope);
  });
  console.log(`topScope:`, topScope);
  console.log('-----topScope init------');
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
  topScope.setMode(ast.analyzeMode);

  initScope(ast, topScope);

  let arr = findEntry(ast, topScope);

  let r = arr.map((path) => {

    const callExpressionNode = wrapperToCallExpression(path)
    console.log("TCL: exports.analyze -> callExpressionNode", callExpressionNode)

    let r = callFunc(callExpressionNode, topScope);
    return r;
  });
  return r;
};

exports.PARSE_MODE = PARSE_MODE;