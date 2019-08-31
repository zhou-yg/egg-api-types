const ZakuCore = require('./lib2/zaku-core');

const chairPlugin = require('./plugins/plugin-chair');

console.log(chairPlugin.chairProject);

const zaku = new ZakuCore({
  entry: chairPlugin.chairProject.router,
  plugins: [
    new chairPlugin({
      rpcs: [
        'com.alipay.pcreditweb.huabei.pay.queryAmount',
      ],
    }),
  ],
});

zaku.start();
