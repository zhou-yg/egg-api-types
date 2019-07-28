require('./config');

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');

const billController = path.join(chairConfig.controller, './huabei/bill.ts');

const c = require('fs').readFileSync(billController).toString()

const code = c;
 
const output = parser.parse(code, {
  sourceType: 'module',
  plugins: [
    'typescript',
    ['decorators', { decoratorsBeforeExport: true }],
  ]
});

// console.log(output.program.body[1].body.body[0])

let preMethod = null;

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
      console.log(path.node.argument);
      preMethod = null;
      console.log('--->')
    }
  },
})