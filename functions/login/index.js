// ============================================================
// 云函数：login —— 登录接口（HTTP 函数）
//
// POST /api/login  验证用户名密码，成功返回登录 token
//
// 轻量版实现（2026-10-08）：
//   - 账号密码通过环境变量 LOGIN_USERNAME / LOGIN_PASSWORD 配置
//     （绝不写死、不进 git、不进前端）
//   - 验证通过返回一个 token，前端存 localStorage，刷新不丢失
//   - token 用「环境变量 LOGIN_TOKEN」签发（部署时注入），不设过期（轻量版）
//
// 安全底线（遵守 PRD 8.3）：
//   - 明文密码只存在环境变量里，不出现在代码 / 仓库 / 前端
//   - 比对用恒定时间比较（防时序攻击），返回统一文案（防用户名枚举）
// ============================================================

const http = require("http");
const crypto = require("crypto");

// 环境变量（部署时注入）
const LOGIN_USERNAME = process.env.LOGIN_USERNAME || "";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "";
const LOGIN_TOKEN = process.env.LOGIN_TOKEN || "";

// 注意：这里【不】写 Access-Control-Allow-Origin。
// CloudBase 的 HTTP 网关会自动追加来源域名到 CORS 头，
// 若云函数自己再写一个，会合并成「域名,*」这样的非法值，
// 浏览器判定 CORS 失败 → 前端 fetch 报错 → 登录出现红色错误提示。
// 所以跨域头完全交给网关处理，云函数不写 origin。
const CORS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = "";
    req.on("data", function (chunk) { data += chunk; });
    req.on("end", function () { resolve(data); });
    req.on("error", reject);
  });
}

// 恒定时间比较，防止通过响应时间差猜密码长度/内容
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const server = http.createServer(async function (req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "只支持 POST 请求" });
  }

  // 服务端没配好账号密码 → 直接报 500，不泄露细节
  if (!LOGIN_USERNAME || !LOGIN_PASSWORD) {
    return sendJson(res, 500, { ok: false, error: "服务端未配置登录凭据" });
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: "读取请求体失败" });
  }

  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: "请求体不是合法的 JSON" });
  }

  const username = (body.username || "").trim();
  const password = (body.password || "");

  // 统一错误文案：不区分「用户名不存在」还是「密码错」，防枚举
  const okUser = safeEqual(username, LOGIN_USERNAME);
  const okPass = safeEqual(password, LOGIN_PASSWORD);

  if (!okUser || !okPass) {
    return sendJson(res, 401, { ok: false, error: "用户名或密码错误" });
  }

  // 登录成功，返回 token
  return sendJson(res, 200, {
    ok: true,
    token: LOGIN_TOKEN,
    username: LOGIN_USERNAME
  });
});

server.listen(9000, "0.0.0.0", function () {
  console.log("login function listening on 9000");
});
