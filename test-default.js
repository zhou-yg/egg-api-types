const {start, registerPlugin} = require('./lib/index');

const defaultPlugin = require('./plugins/plugin-default');

registerPlugin(defaultPlugin);

const r = start('./source/ast-test.ts');

console.log('r', r);