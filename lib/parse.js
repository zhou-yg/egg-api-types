const parser = require('@babel/parser');

exports.parse = (code) => {
  const output = parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'typescript',
      ['decorators', { decoratorsBeforeExport: true }],
      // 'decorators-legacy',
    ]
  });
  return output;
}
