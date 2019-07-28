const path = require('path');

const root = path.join(process.env.HOME, './Documents/ant-works/pcreditweb/');

global.chairConfig = {
  controller: path.join(root, './app/controller/'),
  service: path.join(root, './app/service/'),
  proxy: path.join(root, './app/proxy/'),
};