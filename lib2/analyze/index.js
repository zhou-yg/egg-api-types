require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { callFunc, match } = require('./serializeNode');
const { ScopeManager, PARSE_MODE } = require('./scopeManager');

const ZAKU_START = 'ZAKU_START';

function initScope(ast, topScope) {
  ast.program.body.forEach(topNode => {
    match(topNode, topScope);
  });
  // console.log(`topScope:`, topScope);
  // console.log('-----topScope init------');
}

function findEntry(ast, topScope) {
  const arr = [];
  traverse(ast, {
    enter(path) {
      if (path[ZAKU_START]) {
        arr.push(path);
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
    let r = callFunc(path.node, [], topScope);
    return r;
  });
  return r;
};

exports.PARSE_MODE = PARSE_MODE;