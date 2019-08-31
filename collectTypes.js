const json = require('./program.json')
const types = require('./lib2/analyze/types');

const oldTypes = Object.values(types)

const set = new Set();

function dog (obj) {
  if (obj && obj.type) {
    set.add(obj.type);
  }

  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        dog(item);
      });
    } else {
      Object.keys(obj).forEach(k => {
        dog(obj[k]);
      });
    }
  }
}


dog(json);

[...set].forEach(s => {
  if (oldTypes.indexOf(s) !== -1 || /^TS/.test(s)) {
    set.delete(s);
  }
})

console.log([...set]);