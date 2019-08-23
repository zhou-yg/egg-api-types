const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const Process = require('./common/Process')

const parser = require('@babel/parser');

function parse(code, plugins) {
  const output = parser.parse(code, {
    sourceType: 'module',
    plugins: [
      // 'decorators-legacy',
      ...plugins,
    ]
  });
  return output;
}

class Parser extends Process{
  constructor () {
    this.hooks = {
      parser: new SyncHook(),
    }
    this.ast = null;
    // 默认插件
    this.plugins = [
      'typescript',
      ['decorators', { decoratorsBeforeExport: true }]
    ];
    // parse代码的插件，可由其它插件进行注入
    this.extraPlugins = []; 
  }

  prepare () {
    this.hooks.parser.tap('parseCode', (tsCode) => {
      const tsAst = parse(tsCode, [
        ...this.plugins,
        ...this.extraPlugins,
      ]);
      this.ast = tsAst;
    });
  }

  start (tsCode) {

    this.hooks.getEntry.call(tsCode);
  }
}


module.exports = new Parser();