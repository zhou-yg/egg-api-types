const { Tapable, SyncHook, SyncWaterfallHook, SyncBailHook } = require("tapable");


class MyDaily {
  constructor() {
    this.hooks = {
      beforeWork: new SyncHook(["getUp"]),
      atWork: new SyncWaterfallHook(["workTask"]),
      afterWork: new SyncBailHook(["activity"])
    };
  }
  tapTap() {
    //此处是行为
    this.hooks.beforeWork.tap("putOnCloth", (arg, b) => {
      console.log("穿衣服！", arg, b);
    })
    this.hooks.beforeWork.tap("getOut", (arg, b) => {
      console.trace();
      console.log("出门！", arg, b);
    });
    this.hooks.atWork.tap("makePPT", () => {
      console.log("做PPT！")
      return "你的ppt"
    })
    this.hooks.atWork.tap("meeting", (work) => {
      console.log("带着你的" + work + "开会！")
    })
    this.hooks.afterWork.tap("haveADate", () => {
      console.log("约会咯！")
      return "约会真开心～"
    })
    this.hooks.afterWork.tap("goHome", () => {
      console.log("溜了溜了！")
    })
  }
  run() {
    this.hooks.beforeWork.call('zzz', 'abc')
    this.hooks.atWork.call()
    this.hooks.afterWork.call()
  }
}


dd = new MyDaily();
dd.tapTap();
dd.run();