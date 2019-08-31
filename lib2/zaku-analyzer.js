const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');

const { analyze, ZAKU_START } = require('./analyze/index');

class ZakuAnalyzer extends ZakuBase {
  constructor () {
    super();
    this.hooks = {
      analyzeStart: new SyncHook(['markStart']),
      matchNode: new SyncHook(['??']),
      intoNewScope: new SyncHook(['??']),
      analyzeEnd: new SyncHook(['broadcastResult']),
    };
  }

  start (core) {
    const ast = core.zakuParser.ast;

    this.hooks.analyzeStart.call({ 
      ast, 
      startTag: ZAKU_START,
    });
    
    const result = analyze(ast);

    this.hooks.analyzeEnd.call({
      result,
    });
  }
}

module.exports = ZakuAnalyzer;