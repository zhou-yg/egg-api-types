const parser = require('@babel/parser');

const c = require('fs').readFileSync('./source/ast-test.ts').toString()
const {analyze} = require('./lib2/analyze');

const code = c;

const output = parser.parse(code, {
  sourceType: 'module',
  plugins: [
    'typescript',
    ['decorators', { decoratorsBeforeExport: true }],
    // 'decorators-legacy',
  ]
});

analyze(output);
