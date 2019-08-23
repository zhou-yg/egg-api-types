const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const Process = require('./common/Process')
const fs = require('fs');

class Entry extends Process{
  constructor () {
    this.hooks = {
      getEntry: new SyncBailHook(['read']),
    };
    this.entry = null; // parse入口
    this.fileString = '';
  }

  prepare () {
    this.hooks.getEntry.tap('normalRead', (filePath) => {
      this.entry = filePath;
      this.fileString = fs.readFileSync(filePath).toString();
    });
  }

  start (file) {
    this.hooks.getEntry.call(file);
  }
}


module.exports = new Entry();