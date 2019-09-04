// chair plugin
const fs = require('fs');
const path = require('path');
const ZakuPlugin = require('../lib2/zaku-plugin');
const traverse = require('@babel/traverse').default;

const config = {
  pwd: '/Users/zhouyunge/Documents/ant-works/pcreditweb',
  chairApp: '/Users/zhouyunge/Documents/ant-works/pcreditweb/app',
  router: '/Users/zhouyunge/Documents/ant-works/pcreditweb/app/router.ts',
};

function equalRpc (a, b) {
  return String(a).replace(/com\.alipay\.pcreditweb\./, '') === String(b).replace(/com\.alipay\.pcreditweb\./, '');
}

class PluginChair extends ZakuPlugin {
  constructor (config) {
    super();

    this.config = Object.assign({
      rpcs: [],
    }, config);
  }
  start (zaku) {
    zaku.zakuAnalyzer.hooks.analyzeStart.tap('markStart', ({ ast, startTag }) => {

      traverse(ast, {
        CallExpression: (path) => {
          let findRpcRegister = false;
          path.traverse({
            Identifier (path) {
              if (path.node.name === 'rpcAndGet') {
                findRpcRegister = true;
              }
            },
          });
          if (findRpcRegister) {
            const rpcRegisterArgs = path.node.arguments;
            const rpcName = rpcRegisterArgs[0].value;

            if (this.config.rpcs.some(configRpc => {
              let b = equalRpc(configRpc, rpcName);
              return b;
            })) {
              const controller = rpcRegisterArgs[rpcRegisterArgs.length - 1];

              path.traverse({
                enter (p) {
                  if (p.node === controller) {
                    p[startTag] = true;
                  }
                },
              });
            }
          }
        },
      });


      const astText = JSON.stringify(ast.program.body, null, 2);
      fs.writeFileSync('default-program.json', astText);
    });

    zaku.zakuAnalyzer.hooks.analyzeEnd.tap('getResult', ({ result }) => {
      console.log(`result :`, JSON.stringify(result, null, 2));
    });
  }
}

PluginChair.chairProject = config;


module.exports = PluginChair;
