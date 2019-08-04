function serializeExpression(node) {
  switch (node.type) {
    case NodeTypes.CallExpression:
      return node.name;
      break;
    default:

  }
}
