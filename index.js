const { parse } = require('@babel/parser');
const generate = require('@babel/generator').default;

const a = 'var a = 1;';
const b = "b().c('aaa')";
const astA = parse(a);
const astB = parse(b);
let astB2 = {
  type: 'Program',
  body: astB.program.body
}
let ast = {
  type: 'Program',
  body: [
    {
      "type": "ExpressionStatement",
      "start": 0,
      "end": 10,
      "expression": {
        "type": "CallExpression",
        "start": 0,
        "end": 10,
        "callee": {
          "type": "MemberExpression",
          "start": 0,
          "end": 5,
          "object": {
            "type": "CallExpression",
            "start": 0,
            "end": 3,
            "callee": {
              "type": "Identifier",
              "start": 0,
              "end": 1,
              "name": "b"
            },
            "arguments": []
          },
          "property": {
            "type": "Identifier",
            "start": 4,
            "end": 5,
            "name": "a"
          },
          "computed": false
        },
        "arguments": [

        ]
      }
    }
  ]
};

ast = JSON.parse(JSON.stringify(ast));

const { code, map } = generate(astB2);

console.log(JSON.stringify(astB.program.body, null ,2));

console.log(code)

