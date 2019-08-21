const {start, registerPlugin} = require('./lib/index');

const chairPlugin = require('./plugins/plugin-chair');

registerPlugin(chairPlugin);

const r = start();

console.log('r', r);