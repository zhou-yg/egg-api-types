const ZakuPlugin = require('../lib/zaku-plugin');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const generate = require('@babel/generator').default;

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
      console.log(`result2 :`, generate({
        type: 'Program',
        body: [
          result[0]
        ],
      }).code);
    });
  }
}

module.exports = PluginDefault;