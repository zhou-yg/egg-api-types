// chair plugin
const fs = require('fs');
const path = require('path');

const config = {
  pwd: '/Users/zhouyunge/Documents/ant-works/pcreditweb',
  chairApp: '/Users/zhouyunge/Documents/ant-works/pcreditweb/app',
  router: '/Users/zhouyunge/Documents/ant-works/pcreditweb/app/router.ts',
};

function findEntry (r) {
  const paths = r.split('.');

  let fileEntry;
  let entryClassMethod;

  paths.forEach((_, i) => {
    if (fileEntry) {
      return;
    }
    const file = path.join(config.pwd, ...paths.slice(0, i + 1));
    const jsFile = file + '.js';
    const tsFile = file + '.ts';
    if (fs.existsSync(jsFile)) {
      fileEntry = jsFile;
    } else if (fs.existsSync(tsFile)) {
      fileEntry = tsFile;
    }
    if (fileEntry) {
      entryClassMethod = paths[i + 1];
    }
  });

  if (!fileEntry) {
    throw new Error('dont find entry controller file');
  }

  return {
    fileEntry,
    entryClassMethod,
  };
}

function entry () {
  const routerCode = fs.readFileSync(config.router).toString();
  const r = routerCode.match(/app\.rpcAndGet\([\w\W]+?\)/g);

  let entryArr = [];
  r && r.forEach(line => {
    if (/app\.controller\.huabei\.recommend\.queryContent/.test(line)) {
      let r = line.match(/app[.a-zA-Z0-9]+?\)/);
      if (r) {
        r = r[0].replace(/\)$/, '');
        entryArr.push(findEntry(r));
      }
    }
  });

  return entryArr;
}

exports.entry = entry;
