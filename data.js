// ===== 分享数据源（本地 mock 数据）=====
// 「作品」是真实内容；「资源」暂为空，等你以后给了真实内容再往里加。
//
// 往 resources 里加一条资源，照着下面的格式写即可：
//   { title: "标题", desc: "一句话说明", link: "https://完整网址" }
// （img 是可选字段，资源一般不需要图，留空即可）

var SITE_DATA = {
  works: [
    { title: "速写", desc: "速写课第一节，画自己的手，感觉还不错，看来美术功底还在", img: "img-sketch-hand.jpg" },
    { title: "涂鸦", desc: "emmm，我想想……", img: "img-doodle-math.jpg" },
    { title: "冲鸭", desc: "冲鸭！继续加油", img: "img-duck-chong.jpg" }
  ],
  resources: [
    // 待补充：学习资料链接 / 常用工具 / 网盘文档 等
  ]
};
