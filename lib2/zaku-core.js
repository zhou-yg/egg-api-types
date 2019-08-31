const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');
const ZakuParser = require('./zaku-parser');
const ZakuAnalyzer = require('./zaku-analyzer');

class ZakuCore extends ZakuBase {

  constructor (config = {}) {
    super();

    this.config = Object.assign({
      entry: null,
      plugins: [],
    }, config);

    this.zakuParser = new ZakuParser();
    this.zakuAnalyzer = new ZakuAnalyzer();

    this.hooks = {
      beforeEntry: new SyncHook(['setEntry']),
      parser: this.zakuParser.hooks,
      analyzer: this.zakuAnalyzer.hooks,
    };
  }

  start () {
    this.config.plugins.forEach(plugin => plugin.start(this));

    // generate ast
    this.zakuParser.start(this);

    this.zakuAnalyzer.start(this);
  }
}

module.exports = ZakuCore;