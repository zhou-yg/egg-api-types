exports.isCalleeNode = function isCalleeNode (target) {
  return target && NodeTypes.FunctionTypes.includes(target.type);
}

exports.isCanCalType = function isCanCalType (...args) {
  return args.every(arg => {
    return !arg.type;
  });
}
