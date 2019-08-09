const NodeTypes = require('./types');

function match (node) {
  const type = node.type;
  switch (type) {
    case NodeTypes.ArrowFunctionExpression:
    case NodeTypes.FunctionExpression:
    case NodeTypes.FunctionDeclaration:
    case NodeTypes.ClassMethod:
      return matchFunc(node);
  }
}