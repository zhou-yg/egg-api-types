require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { serializeFunc} = require('./base/function');

function findEntry(output) {
  let preMethod;
  let name;
  let r = [];
  traverse(output, {
    // ClassMethod: {
    //   enter(path) {
    //     console.log(path);
    //     // console.log('===')
    //   }
    // },
    ClassMethod (path) {
      preMethod = path.node;
    },
    ReturnStatement (path) {
      if (preMethod) {
        console.log(path.node.argument.name);

        name = path.node.argument.name;

        console.log('<--findEntry end-->')
        r.push([preMethod, name]);

        preMethod = null;
        name = null;
      }
    },
  });

  return r;
}

module.exports = (output) => {
  const astText = JSON.stringify(output.program.body, null, 2);
  fs.writeFileSync('program.json', astText);

  let arr = findEntry(output);

  arr.forEach(([methodNode]) => {
    let r = serializeFunc(methodNode);
    console.log(r);
  });
};
