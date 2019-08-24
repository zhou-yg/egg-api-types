const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');

class ZakuParser extends ZakuBase {
  constructor () {
    this.hooks = {
      beforeParse: new SyncHook(['addPlugin']),
      afterParse: new SyncHook(['editAst']),
    }
    this.defaultPlugins = [
      'typescript',
      ['decorators', { decoratorsBeforeExport: true }]
    ];
    this.extraPlugins = [];

  }

  parse(code) {
    // add plugins
    this.hooks.beforeParse.call((newPlugins) => {
      this.extraPlugins = this.extraPlugins.concat(newPlugins);
    });

    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        ...this.defaultPlugins,
        ...this.extraPlugins,
      ]
    });

    this.ast = ast; 


 
    // only visit "ast" prop
    const proxyAst = new Proxy({}, {
      get: (target, key) => {
        if (key === 'ast') {
          return this.ast;
        }
      },
      set (target, key, value) {
        if (key === 'ast') {
          this.ast = value;
        }
      },
    })

    this.hooks.afterParse.call(proxyAst);
  }

  wart (core) {

    const code = fs.readFileSync(core.config.entry).toString();
    
    this.parse(code)
  }
}

module.exports = ZakuParser;