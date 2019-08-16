require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { callFunc, match } = require('./serializeNode');
const {ScopeManager} = require('./scopeManager');

function initScope(output, topScope) {
  output.program.body.forEach(topNode => {
    const r = match(topNode, topScope);
  });
  console.log(`topScope:`, topScope);
}

function findEntry(output, topScope) {
  const arr = [];
  traverse(output, {
    ClassMethod (path) {
      let hasReturn = false;
      path.traverse({
        ReturnStatement (p) {
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

module.exports = (output) => {
  const astText = JSON.stringify(output.program.body, null, 2);
  fs.writeFileSync('program.json', astText);

  const topScope = new ScopeManager();

  initScope(output, topScope);

  let arr = findEntry(output, topScope);

  console.log('-----init----')
  arr.forEach((methodNode) => {
    let r = callFunc(methodNode, topScope);
    console.log('callFunc entry: ', r);
  });
};
