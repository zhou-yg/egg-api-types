const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const c = require('fs').readFileSync('./source/test.ts').toString()

const code = c;
// const code = `
// class A {
//   aaa () {

//   }
// }
// `;

const output = parser.parse(code, {
  sourceType: 'module',
  plugins: [
    'typescript',
    ['decorators', { decoratorsBeforeExport: true }],
    // 'decorators-legacy',
  ]
});

// console.log(output.program.body[0].body)