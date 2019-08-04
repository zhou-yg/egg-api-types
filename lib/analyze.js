require('./types')
const fs = require('fs');
const traverse = require('@babel/traverse').default;

let preMethod = null;

function findDeclarationInClassMethod(output, method, varName) {
  let preMethod;
  traverse(output, {
    ClassMethod (path) {

      preMethod = path.node;
    },
    VariableDeclarator (path) {
      if (preMethod) {
        console.log(path.node.id);
        console.log(path.node.init);
      }
    }
  });
}

function findReturnState(output) {
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

        console.log('<--findReturnState end-->')
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

  let arr = findReturnState(output);

  console.log(arr)
  let r = arr.map(([method, returnName]) => {
    findDeclarationInClassMethod(output, method, returnName);
  });
};
