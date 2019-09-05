const Parser = require('../lib2/zaku-parser');
const Analyzer = require('../lib2/zaku-analyzer');
const fs = require('fs');
const path = require('path');

const analyzer = new Analyzer();
const parser = new Parser();

exports.loadCode = () => {

  const output = {};
  const dir = path.join(__dirname, './ts-code/');
  fs.readdirSync(dir).forEach(dir2 => {
    if (!output[dir2]) {
      output[dir2] = {};
    }

    let dir2Obj = output[dir2];

    dir2 = (path.join(dir, dir2));

    fs.readdirSync(dir2).forEach(file => {
      const filePath = path.join(dir2, file);
      let code = fs.readFileSync(filePath).toString();
      
      parser.parse(code);
      analyzer.defaultMain(parser.ast);

      dir2Obj[String(file).replace(/\.ts$/, '')] = parser.ast;
    });
  });

  return output;
}