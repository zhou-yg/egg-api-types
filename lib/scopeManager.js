class ScopeManager {
  constructor (parentScope = null) {
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

module.exports = ScopeManager;
