const { SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");

const PARSE_MODE = {
  PARSE: 'PARSE_0', // 仅parse，不计算
  LAZY_RUN: 'LAZY_RUN_1', // 链路串联
  REAL_RUN: 'REAL_RUN_2', // 基于串联链路计算
  RUN: 'RUN_3', // 直接运算
};

class ScopeManager {
  constructor (parentScope = null) {
    this.mode = parentScope ? parentScope.mode : PARSE_MODE.PARSE;
    this.parentScope = parentScope;
    this.scope = new Map();
  }
  setMode (m) {
    if (!Object.values(PARSE_MODE).includes(m)) {
      throw new Error('invalid mode')
    }
  }
  setByName (name, v){
    this.scope.set(name, v);
  }
  setById (id, v){
    this.scope.set(id.name, v);
  }
  getByName (name) {
    let value = this.scope.get(name);
    if (value !== undefined) {
      return value;
    } else if(this.parentScope){
      return this.parentScope.getByName(name);
    }
  }
}

exports.ScopeManager = ScopeManager;
exports.PARSE_MODE = PARSE_MODE;
