const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');


class ZakuAnalyzer extends ZakuBase {
  constructor () {
    this.hooks = {
      matchNode: new SyncHook(['??']),
      intoNewScope: new SyncHook(['??'])
    };
  }

  start (core) {
    const ast = core.zakuParser.ast;
  }
}

module.exports = ZakuAnalyzer;