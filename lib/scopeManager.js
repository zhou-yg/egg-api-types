const PARSE_MODE = {
  PARSE: 0, // 仅parse，不计算
  LAZY_RUN: 1, // 链路串联
  REAL_RUN: 2, // 基于串联链路计算
  RUN: 3, // 直接运算
};

class ScopeManager {
  constructor (parentScope = null) {
    this.mode = parentScope ? parentScope.mode : PARSE_MODE.PARSE;
    this.parentScope = parentScope;
    this.scope = new Map();
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
