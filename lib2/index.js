const entry = require('./entry');
const { runPlugins } = require('./plugin');


runPlugins('entry', entry)



exports.start = (f) => {
  entry.start(f);
};
