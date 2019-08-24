const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');
const ZakuParser = require('./zaku-parser');
const ZakuAnalyzer = require('./zaku-analyzer');

class ZakuCore extends ZakuBase {

  constructor () {
    super();

    this.config = {
      entry: null,
    };

    this.zakuParser = new ZakuParser();
    this.zakuAnalyzer = new ZakuAnalyzer();

    this.hooks = {
      beforeEntry: new SyncHook(['setEntry']),
      parser: this.zakuParser.hooks,
      analyzer: this.zakuAnalyzer.hooks,
    };
  }

  start (config = {}) {
    this.config = Object.assign(this.config, config);

    // generate ast
    this.zakuParser.start(this);

    this.zakuAnalyzer.start(this);
  }
}

module.exports = ZakuCore;