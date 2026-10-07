// ============================================================
// 云函数：works —— 分享区读写接口（HTTP 函数）
// Day 17 GET 读接口 + Day 18 POST 写接口
//
// GET  /api/works      读分享列表（公开作品）
// POST /api/works      新增一条作品（今天 Day 18 的主任务）
//
// 这是「HTTP 函数」：标准 Web 服务，监听 9000 端口，
// 由 scf_bootstrap 启动（内容：node index.js）。
//
// Day 18 思考题答案（你防了哪一种重复提交/错误输入）：
//   ① 防「重复提交」：POST 前按 category+title 查重，已存在就拒绝
//      并返回中文提示「该作品已存在，请勿重复提交」。
//   ② 防「错误输入」：
//       - 缺必填字段（category 或 title 为空）→ 中文提示缺少哪个字段
//       - category 不是四板块之一 → 中文提示「板块不合法」
//   怎么测：curl 连发三次（正常 / 重复 / 缺字段），看三种不同返回。
// ============================================================

const http = require("http");
const { URL } = require("url");

// 环境变量（部署时配置，绝不写死、不进 git）
const ENV_ID = process.env.CLOUDBASE_ENV_ID || "changda-vibecoding-d8c0v64bdbf7c";
const API_KEY = process.env.CLOUDBASE_API_KEY;

// 板块白名单（对应 data.js 四板块）
const CATEGORIES = ["doodle", "essay", "photo", "resource"];

// 作品归属账号：系统只有一个账号（changda，id=1，不开放注册），
// 登录鉴权是后续的事，今天 POST 先固定 user_id=1。
const OWNER_USER_ID = 1;

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

// REST 网关基础地址（PostgREST 风格）
const GW = "https://" + ENV_ID + ".api.tcloudbasegateway.com/v1/rdb/rest/works";

// 读请求体（异步，返回 Promise<string>）
function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = "";
    req.on("data", function (chunk) { data += chunk; });
    req.on("end", function () { resolve(data); });
    req.on("error", reject);
  });
}

// 服务端日志（余力加练：每次写入打一条，方便以后排查）
function log(...args) {
  console.log("[works " + new Date().toISOString() + "]", ...args);
}

const server = http.createServer(async function (req, res) {
  // CORS 预检请求直接放行
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");

  // ============ POST /api/works：新增作品（Day 18）============
  if (req.method === "POST") {
    if (!API_KEY) {
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

    // 板块与字段的对应关系（对齐 api-contract）：资源板块用 link，其余用 img
    const finalImg = category === "resource" ? null : (img || null);
    const finalLink = category === "resource" ? (link || null) : null;

    try {
      // —— 防重复：先查重（同 category + 同 title 视为重复）——
      const checkQs = "select=id&category=eq." + encodeURIComponent(category)
        + "&title=eq." + encodeURIComponent(title);
      const checkRes = await fetch(GW + "?" + checkQs, {
        method: "GET",
        headers: { Authorization: "Bearer " + API_KEY }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing && existing.length > 0) {
          return sendJson(res, 409, {
            ok: false,
            error: "该作品已存在，请勿重复提交",
            duplicateId: existing[0].id
          });
        }
      }

      // —— 写入：POST 到 REST 网关 ——
      const insertRes = await fetch(GW, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + API_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=representation"   // 让网关返回插入后的完整行（含自增 id）
        },
        body: JSON.stringify({
          user_id: OWNER_USER_ID,
          category: category,
          title: title,
          description: desc || null,   // 数据库列名 description（接口字段 desc → 翻译回库）
          img: finalImg,
          link: finalLink,
          status: "public"             // 默认公开
        })
      });

      if (!insertRes.ok) {
        const errBody = await insertRes.text();
        log("插入失败", insertRes.status, errBody);
        return sendJson(res, insertRes.status, {
          ok: false,
          error: "数据库写入失败",
          detail: errBody
        });
      }

      const inserted = await insertRes.json();
      const newId = inserted && (inserted.id || (inserted[0] && inserted[0].id));

      log("新增作品成功", JSON.stringify({ id: newId, category, title }));

      return sendJson(res, 201, { ok: true, id: newId, category: category, title: title });

    } catch (err) {
      log("写入异常", String(err && err.message));
      return sendJson(res, 500, { ok: false, error: "云函数内部错误", detail: String(err && err.message) });
    }
  }

  // ============ GET /api/works：读分享列表（Day 17）============
  if (req.method === "GET") {
    const category = url.searchParams.get("category");
    const limit = parseInt(url.searchParams.get("limit"), 10);

    let qs = "select=*&status=eq.public";
    if (category) qs += "&category=eq." + encodeURIComponent(category);
    if (limit > 0) qs += "&limit=" + limit;

    const gw = GW + "?" + qs;

    try {
      if (!API_KEY) {
        return sendJson(res, 500, { ok: false, error: "服务端未配置 API Key" });
      }

      const r = await fetch(gw, {
        method: "GET",
        headers: { Authorization: "Bearer " + API_KEY }
      });

      if (!r.ok) {
        const body = await r.text();
        return sendJson(res, r.status, { ok: false, error: "数据库读取失败", detail: body });
      }

      const rows = await r.json();

      const data = rows.map(function (row) {
        return {
          id: row.id,
          category: row.category,
          title: row.title,
          desc: row.description,
          img: row.img || null,
          link: row.link || null
        };
      });

      return sendJson(res, 200, { ok: true, count: data.length, data: data });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: "云函数内部错误", detail: String(err && err.message) });
    }
  }

  // 其他方法（PATCH/DELETE/PUT 等）—— 今日不做，一律拒绝
  return sendJson(res, 405, { ok: false, error: "只支持 GET 和 POST 请求" });
});

// 必须监听 9000 端口（平台要求）
server.listen(9000, "0.0.0.0", function () {
  console.log("works function listening on 9000");
});
