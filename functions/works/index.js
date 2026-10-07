// ============================================================
// 云函数：works —— 分享区读写接口（HTTP 函数）
// Day 17 GET 读接口 + Day 18 POST 写接口 + Day 19 拆出数据访问层
//
// GET  /api/works      读分享列表（公开作品）
// POST /api/works      新增一条作品
//
// 这是「HTTP 函数」：标准 Web 服务，监听 9000 端口，
// 由 scf_bootstrap 启动（内容：node index.js）。
//
// Day 19 重构：本文件只保留「接口长什么样」（HTTP 的事），
// 「数据怎么进出」（数据库的事）已拆到同目录 db.js（数据访问层）。
// 接口路径、字段名、返回结构一律没动，契约不变。
// ============================================================

const http = require("http");
const { URL } = require("url");

// 引入数据访问层（Day 19 新增）
const db = require("./db");

// 板块白名单（用于输入校验）
const CATEGORIES = db.CATEGORIES;

// CORS 头：允许网页跨域访问（POST 需要额外允许 Content-Type 和 POST 方法）
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS
  });
  res.end(JSON.stringify(obj));
}

// 读请求体（异步，返回 Promise<string>）
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = "";
    req.on("data", function (chunk) { data += chunk; });
    req.on("end", function () { resolve(data); });
    req.on("error", reject);
  });
}

const server = http.createServer(async function (req, res) {
  // CORS 预检请求直接放行
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");

  // ============ POST /api/works：新增作品 ============
  if (req.method === "POST") {
    if (!process.env.CLOUDBASE_API_KEY) {
      return sendJson(res, 500, { ok: false, error: "服务端未配置 API Key" });
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

    const category = (body.category || "").trim();
    const title = (body.title || "").trim();
    const desc = (body.desc || "").trim();
    const img = (body.img || "").trim();
    const link = (body.link || "").trim();

    // —— 校验①：必填字段（中文提示）——
    if (!category) {
      return sendJson(res, 400, { ok: false, error: "缺少必填字段：板块（category）" });
    }
    if (!title) {
      return sendJson(res, 400, { ok: false, error: "缺少必填字段：标题（title）" });
    }

    // —— 校验②：板块白名单（中文提示）——
    if (CATEGORIES.indexOf(category) === -1) {
      return sendJson(res, 400, {
        ok: false,
        error: "板块不合法，应为 doodle / essay / photo / resource 之一"
      });
    }

    // 板块与字段的对应关系：资源板块用 link，其余用 img
    const finalImg = category === "resource" ? null : (img || null);
    const finalLink = category === "resource" ? (link || null) : null;

    try {
      // —— 防重复：交给数据访问层查重 ——
      const existing = await db.findDuplicate(category, title);
      if (existing) {
        return sendJson(res, 409, {
          ok: false,
          error: "该作品已存在，请勿重复提交",
          duplicateId: existing.id
        });
      }

      // —— 写入：交给数据访问层 ——
      const result = await db.insertWork({
        category: category,
        title: title,
        description: desc || null,   // 接口字段 desc → 落库 description（在 db.js 内翻译）
        img: finalImg,
        link: finalLink
      });

      return sendJson(res, 201, {
        ok: true,
        id: result.id,
        category: result.category,
        title: result.title
      });

    } catch (err) {
      // 数据库层抛出的错误，原样把状态码和详情透传出去
      const status = err.status || 500;
      return sendJson(res, status, {
        ok: false,
        error: err.message || "云函数内部错误",
        detail: err.detail
      });
    }
  }

  // ============ GET /api/works：读分享列表 ============
  if (req.method === "GET") {
    const category = url.searchParams.get("category");
    const limit = parseInt(url.searchParams.get("limit"), 10);

    try {
      if (!process.env.CLOUDBASE_API_KEY) {
        return sendJson(res, 500, { ok: false, error: "服务端未配置 API Key" });
      }

      // —— 读取：交给数据访问层 ——
      const data = await db.listWorks({ category: category, limit: limit });

      return sendJson(res, 200, { ok: true, count: data.length, data: data });
    } catch (err) {
      const status = err.status || 500;
      return sendJson(res, status, {
        ok: false,
        error: err.message || "云函数内部错误",
        detail: err.detail
      });
    }
  }

  // 其他方法（PATCH/DELETE/PUT 等）—— 今日不做，一律拒绝
  return sendJson(res, 405, { ok: false, error: "只支持 GET 和 POST 请求" });
});

// 必须监听 9000 端口（平台要求）
server.listen(9000, "0.0.0.0", function () {
  console.log("works function listening on 9000");
});
