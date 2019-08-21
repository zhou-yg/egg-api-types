const { analyze } = require('./analyze');
const { parse } = require('./parse');
const { registerPlugin, getPlugins } = require('./plugin');

function start (...arg) {
}

exports.analyze = analyze;
exports.parse = parse;
exports.registerPlugin = registerPlugin;
exports.start = start;