// ===== 分享数据源（本地 mock 数据）=====
// 分享区分为四个板块：涂鸦 / 随笔 / 合影 / 资源。
//
// 各板块字段说明：
//   涂鸦（doodles） ：{ title, desc, img }
//   随笔（essays）  ：{ title, desc, img }   （img 可空，纯文字时留 ""）
//   合影（photos）  ：{ title, desc, img }
//   资源（resources）：{ title, desc, link }  （link 是外链网址）
//
// 现在只有「涂鸦」有真实内容（3 张画），其余三类留空，等以后上传了再往里加。

var SITE_DATA = {
  // 涂鸦：手 / 涂鸦 / 冲鸭 / 线条狗
  doodles: [
    { title: "手", desc: "速写课第一节，画自己的手，感觉还不错，看来美术功底还在", img: "img-hand.jpg" },
    { title: "涂鸦", desc: "emmm，我想想……", img: "img-doodle-math.jpg" },
    { title: "冲鸭", desc: "冲鸭！继续加油", img: "img-chongya.jpg" },
    { title: "线条狗", desc: "被阳光晾晒的小狗，云朵也化作小狗的模样，把可爱晒得蓬松柔软。", img: "img-dog-line.jpg" }
  ],
  // 随笔：文字短文（可配图）
  essays: [
    { title: "下一个灵气复苏时代", desc: "非洲大地可以等下一个雨季，但人的一生那么短，还能等到下一个灵气复苏的时代吗？", img: "" }
  ],
  // 合影：和朋友/家人的合照
  photos: [
    // 待补充：{ title: "标题", desc: "说明", img: "img-xxx.jpg" }
  ],
  // 资源：学习资料链接 / 常用工具 / 网盘文档
  resources: [
    // 待补充：{ title: "标题", desc: "一句话说明", link: "https://完整网址" }
  ]
};
