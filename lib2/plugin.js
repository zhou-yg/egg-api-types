const Process = require('./common/Process')

const pluginList = [];

class BasePlugin extends Process{
  entry () {

  }
  parse () {

  }
  analyze () {

  }
}

function registerPlugin (plugin) {
  if (plugin instanceof BasePlugin) {
    pluginList.push(plugin);
  } else {
    throw new Error('not a plugin')
  }
}

exports.BasePlugin = BasePlugin;
exports.registerPlugin = registerPlugin;
exports.runPlugins = (method, target) => {

  target.beforePrepare();

  pluginList.forEach(p => p[method](target));

  target.prepare();
};