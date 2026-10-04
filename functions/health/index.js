// 云函数：health
// 用途：健康检查接口，通过 HTTP 访问路径 /api/health 对外提供
// 返回：一段 JSON，告诉调用方"服务活着，现在是几点"
//
// Day 15｜2026-10-04｜部署环境：changda-vibecoding-d8c0v64bdbf7c（体验版，2027-04-04 到期）

exports.main = async function () {
  return {
    status: "ok",
    service: "api/health",
    message: "CloudBase 云函数运行正常",
    time: new Date().toISOString()
  };
};
