const pluginList = [];

function registerPlugin (plugin) {
  pluginList.push(plugin);
}

exports.registerPlugin = registerPlugin;
exports.getPlugins = () => pluginList;