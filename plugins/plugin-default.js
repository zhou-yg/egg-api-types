const ZakuPlugin = require('../lib2/zaku-plugin');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

class PluginDefault extends ZakuPlugin{
  constructor () {
    super();
  }

  start(zaku) {

    zaku.zakuAnalyzer.hooks.beforeStart.tap('markStart', ({ast, startTag}) => {
      traverse(ast, {
        ClassMethod(path) {
          let hasReturn = false;
          path.traverse({
            ReturnStatement(p) {
              hasReturn = true;
            },
          });
          if (hasReturn) {
            path.node[startTag] = true;
          }
        },
      });

      const astText = JSON.stringify(ast.program.body, null, 2);
      fs.writeFileSync('default-program.json', astText);
    });
  }
}

module.exports = PluginDefault;