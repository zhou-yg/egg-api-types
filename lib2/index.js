const entry = require('./entry');
const parser = require('./parser');
const analyzer = require('./analyzer')
const { runPlugins } = require('./plugin');

[
  ['entry',entry],
  ['parse', parser],
  ['analyze', analyzer]
].forEach(([processName, processer]) => {

  runPlugins(processName, processer)

});

exports.start = (f) => {
  entry.start(f);

  parser.start(entry.fileString);

  analyzer.start(parser.ast)
};
