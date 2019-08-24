const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');

const {analyze} = require('./analyze/index');

class ZakuAnalyzer extends ZakuBase {
  constructor () {
    super();
    this.hooks = {
      matchNode: new SyncHook(['??']),
      intoNewScope: new SyncHook(['??'])
    };
  }

  start (core) {
    const ast = core.zakuParser.ast;

    analyze(ast);
  }
}

module.exports = ZakuAnalyzer;