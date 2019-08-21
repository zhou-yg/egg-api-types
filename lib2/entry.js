const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const Process = require('./common/Process')

class Entry extends Process{
  constructor () {
    this.hooks = {
      getEntry: new SyncBailHook(['read']),
    };
    this.entry = []; // parse入口
  }

  prepare () {
    this.hooks.getEntry.tap('normalRead', (filePath) => {
      this.entry = filePath;
    });
  }

  start (file) {
    this.hooks.getEntry.call(file);
  }
}


module.exports = new Entry();