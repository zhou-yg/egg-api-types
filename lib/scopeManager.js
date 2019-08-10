class ScopeManager {
  constructor (parentScope = null) {
    this.parentScope = parentScope;
    this.scope = {};
  }
  setByName (name, v){
    this.scope[name] = v;
  }
  getByName (name) {
    if (this.scope[name] !== undefined) {
      return this.scope[name]
    } else if(this.parentScope){
      return this.parentScope.getByName(name);
    }
  }
}

module.exports = ScopeManager;
