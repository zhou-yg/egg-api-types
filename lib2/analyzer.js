const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const Process = require('./common/Process')
const analyze = require('./analyze/index');

class Analyzer extends Process {
  constructor() {
    this.hooks = {
      parser: new SyncHook(),
    }
  }

  prepare() {
    this.hooks.parser.tap('findClassMethod', (ast) => {
      
      this.result = analyze(ast);
    });
  }

  start(ast) {
    this.hooks.parser.call(ast);
  }
}


module.exports = new Analyzer();