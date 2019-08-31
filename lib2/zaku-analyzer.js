const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');

const {analyze} = require('./analyze/index');

const ZAKU_START = 'ZAKU_START';

class ZakuAnalyzer extends ZakuBase {
  constructor () {
    super();
    this.hooks = {
      beforeStart: new SyncHook(['markStart']),
      matchNode: new SyncHook(['??']),
      intoNewScope: new SyncHook(['??'])
    };
  }

  start (core) {
    const ast = core.zakuParser.ast;

    this.hooks.beforeStart.call({ 
      ast, 
      startTag: ZAKU_START,
    });
    // analyze(ast);
  }
}

module.exports = ZakuAnalyzer;