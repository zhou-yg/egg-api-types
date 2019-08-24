const ZakuCore = require('./lib2/zaku-core');

const zaku = new ZakuCore();

zaku.start({
  entry: './source/ast-test.ts',
});
