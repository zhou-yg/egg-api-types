require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { callFunc, match } = require('./serializeNode');
const { ScopeManager } = require('./scopeManager');

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
    ClassMethod(path) {
      let hasReturn = false;
      path.traverse({
        ReturnStatement(p) {
          hasReturn = true;
        },
      });
      if (hasReturn) {
        arr.push(path.node)
      }
    },
  })

  return arr;
}

exports.analyze = (ast) => {

  const astText = JSON.stringify(ast.program.body, null, 2);
  fs.writeFileSync('program.json', astText);

  const topScope = new ScopeManager();

  initScope(ast, topScope);

  let arr = findEntry(ast, topScope);

  arr.forEach((methodNode) => {
    let r = callFunc(methodNode, topScope);
    console.log('callFunc entry: ', r);
  });
};
