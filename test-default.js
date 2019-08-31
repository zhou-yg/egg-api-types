const ZakuCore = require('./lib2/zaku-core');
const defaultPlugin = require('./plugins/plugin-default');

const zaku = new ZakuCore({
  entry: './source/ast-test.ts',
  plugins: [
    new defaultPlugin(),
  ],
});

zaku.start();
