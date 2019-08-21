const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");

const Process = require('./common/Process')

class Parser extends Process{
  constructor () {
    this.hooks = {
      getEntry: new SyncHook(),
    }
  }


  start (entry) {

    this.hooks.getEntry.call(entry);
  }
}