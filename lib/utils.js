exports.isCalleeNode = function isCalleeNode (target) {
  return target && NodeTypes.FunctionTypes.includes(target.type);
}