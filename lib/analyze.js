const fs = require('fs');
const traverse = require('@babel/traverse').default;

let preMethod = null;

function findReturnState(output) {
  let preMethod = null;
  let name;
  traverse(output, {
    // ClassMethod: {
    //   enter(path) {
    //     console.log(path);
    //     // console.log('===')
    //   }
    // },
    ClassMethod (path) {
      console.log(path.node.key.name);

      preMethod = path.node;
    },
    ReturnStatement (path) {
      if (preMethod) {
        console.log(path.node.argument.name);

        name = path.node.argument.name;

        preMethod = null;
        console.log('<--findReturnState end-->')
      }
    },
  });

  return name;
}

module.exports = (output) => {
  const astText = JSON.stringify(output.program.body, null, 2);
  fs.writeFileSync('program.json', astText);

  const returnName = findReturnState(output);
};
