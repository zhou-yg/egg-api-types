const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");
const ZakuBase = require('./zaku-base');
const traverse = require('@babel/traverse').default;
const { analyze, ZAKU_START, PARSE_MODE } = require('./analyze/index');

const DEFAULT_MAIN = 'main';

function findEntry(ast) {
  const arr = [];
  traverse(ast, {
    enter(path) {
      if (path[ZAKU_START]) {
        arr.push(path);
        if (path.node.type) {
        }
      }
    },
  });

  return arr;
}

class ZakuAnalyzer extends ZakuBase {
  constructor () {
    super();
    this.hooks = {
      analyzeStart: new SyncHook(['markStart']),
      matchNode: new SyncHook(['??']),
      intoNewScope: new SyncHook(['??']),
      analyzeEnd: new SyncHook(['broadcastResult']),
    };

    this.analyzeMode = PARSE_MODE.PARSE;
  }

  defaultMain (ast) {
    if (!findEntry(ast).length) {
      traverse(ast, {
        enter(path) {
          let hasReturn = false;

          path.traverse({
            ReturnStatement(p) {
              hasReturn = true;
            },
          });
          if (hasReturn && (path.node.id || path.node.key || {}).name === DEFAULT_MAIN) {
            path[ZAKU_START] = true;
          }
        },
      });
    }
  }

  start (core) {
    const ast = core.zakuParser.ast;

    this.hooks.analyzeStart.call({
      ast, 
      startTag: ZAKU_START,
    });

    this.defaultMain(ast);

    const result = analyze(ast);

    this.hooks.analyzeEnd.call({
      result,
    });
  }
}

module.exports = ZakuAnalyzer;