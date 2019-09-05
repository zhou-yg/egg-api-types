const ZakuPlugin = require('../lib2/zaku-plugin');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

class PluginDefault extends ZakuPlugin{
  constructor () {
    super();
  }

  start(zaku) {

    zaku.zakuAnalyzer.hooks.analyzeStart.tap('markStart', ({ast, startTag}) => {

      const astText = JSON.stringify(ast.program.body, null, 2);
      fs.writeFileSync('default-program.json', astText);
    });

    zaku.zakuAnalyzer.hooks.analyzeEnd.tap('getResult', ({ result}) => {
      console.log(`result :`, JSON.stringify(result, null, 2));
    });
  }
}

module.exports = PluginDefault;