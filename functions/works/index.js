// ============================================================
// 云函数：works —— 分享区读写接口（HTTP 函数）
// Day 17 GET 读接口 + Day 18 POST 写接口 + Day 19 拆出数据访问层
// Day 22 新增 PATCH / DELETE + 写操作鉴权（管理后台）
//
// GET    /api/works      读分享列表（公开作品；?all=1 读全部含 hidden）
// POST   /api/works      新增一条作品（需 token）
// PATCH  /api/works      修改一条作品（需 token）
// DELETE /api/works      删除一条作品（需 token）
//
// 这是「HTTP 函数」：标准 Web 服务，监听 9000 端口，
// 由 scf_bootstrap 启动（内容：node index.js）。
//
// Day 19 重构：本文件只保留「接口长什么样」（HTTP 的事），
// 「数据怎么进出」（数据库的事）已拆到同目录 db.js（数据访问层）。
// 接口路径、字段名、返回结构一律没动，契约不变。
//
// Day 22 鉴权：POST/PATCH/DELETE 需要请求头
//   Authorization: Bearer <token>，token 与 login 函数的环境变量
//   LOGIN_TOKEN 相同（部署时两函数配成同一个值）。
// ============================================================

const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

// 引入数据访问层（Day 19 新增）
const db = require("./db");

// 板块白名单（用于输入校验）
const CATEGORIES = db.CATEGORIES;

// 管理 token（与 login 函数的 LOGIN_TOKEN 是同一个值，部署时注入）
const ADMIN_TOKEN = process.env.LOGIN_TOKEN || "";

// CORS 头：允许网页跨域访问（POST/PATCH/DELETE 需要额外允许方法和 Content-Type）
// 注意：这里【不】写 Access-Control-Allow-Origin —— CloudBase 网关会自动追加来源域名，
// 若云函数自己再写会合并成「域名,*」非法值，浏览器判 CORS 失败（登录已踩过这个坑）。
const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
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

// 恒定时间比较，防止通过响应时间差猜 token（与 login 函数一致）
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// 鉴权：校验请求头 Authorization: Bearer <token>
// 返回 true 表示通过；false 表示未通过（未带 / token 不匹配 / 服务端未配置）
function isAuthorized(req) {
  if (!ADMIN_TOKEN) return false;   // 服务端没配 token → 一律拒绝（安全起见）
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  return safeEqual(m[1].trim(), ADMIN_TOKEN);
}

const server = http.createServer(async function (req, res) {
  // CORS 预检请求直接放行
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");

  // ============ POST /api/works：新增作品（需 token）============
  if (req.method === "POST") {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: "未登录或登录已失效，请重新登录" });
    }

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
    const file = (body.file || "").trim();

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

    // 板块与字段的对应关系：资源板块用 link + file（文档），其余用 img
    const finalImg = category === "resource" ? null : (img || null);
    const finalLink = category === "resource" ? (link || null) : null;
    const finalFile = file || null;   // 文档地址，主要给资源板块，其余可空

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
        link: finalLink,
        file: finalFile
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
    // ?all=1 → 管理后台读全部（含 hidden）；否则只读公开作品
    const all = url.searchParams.get("all") === "1";

    try {
      if (!process.env.CLOUDBASE_API_KEY) {
        return sendJson(res, 500, { ok: false, error: "服务端未配置 API Key" });
      }

      // —— 读取：公开列表走 listWorks，管理后台全部走 listAllWorks ——
      const data = all
        ? await db.listAllWorks()
        : await db.listWorks({ category: category, limit: limit });

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

  // ============ PATCH /api/works：修改作品（需 token）============
  if (req.method === "PATCH") {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: "未登录或登录已失效，请重新登录" });
    }
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

    const id = parseInt(body.id, 10);
    if (!id || id <= 0) {
      return sendJson(res, 400, { ok: false, error: "缺少或非法的作品 id" });
    }

    // 需要更新的字段（只更新传了的字段）
    const category = body.category !== undefined ? (body.category || "").trim() : undefined;
    const title = body.title !== undefined ? (body.title || "").trim() : undefined;
    const desc = body.desc !== undefined ? (body.desc || "").trim() : undefined;
    const img = body.img !== undefined ? (body.img || "").trim() : undefined;
    const link = body.link !== undefined ? (body.link || "").trim() : undefined;
    const file = body.file !== undefined ? (body.file || "").trim() : undefined;
    const status = body.status !== undefined ? (body.status || "").trim() : undefined;
    // 新 id（改 id 排序用）：传了且不等于原 id 才算「改 id」
    let newId = undefined;
    if (body.newId !== undefined && body.newId !== null && body.newId !== "") {
      newId = parseInt(body.newId, 10);
      if (!newId || newId <= 0) {
        return sendJson(res, 400, { ok: false, error: "排序号（id）必须是正整数" });
      }
      if (newId === id) newId = undefined;   // 没变化就不动
    }

    // 校验：若提供了 category，必须在白名单内
    if (category !== undefined && CATEGORIES.indexOf(category) === -1) {
      return sendJson(res, 400, {
        ok: false,
        error: "板块不合法，应为 doodle / essay / photo / resource 之一"
      });
    }
    // 校验：若提供了 status，必须是 public / hidden
    if (status !== undefined && ["public", "hidden"].indexOf(status) === -1) {
      return sendJson(res, 400, { ok: false, error: "状态不合法，应为 public 或 hidden" });
    }

    // 组装数据访问层要的字段（只传有值的）
    const fields = {};
    if (category !== undefined) fields.category = category;
    if (title !== undefined) fields.title = title;
    if (desc !== undefined) fields.description = desc || null;
    if (img !== undefined) fields.img = img || null;
    if (link !== undefined) fields.link = link || null;
    if (file !== undefined) fields.file = file || null;
    if (status !== undefined) fields.status = status;
    if (newId !== undefined) fields.id = newId;   // 改主键 id（排序用）

    // 改 id 前查重：新 id 不能被其他作品占用
    if (newId !== undefined) {
      const occupied = await db.idExists(newId, id);
      if (occupied) {
        return sendJson(res, 409, { ok: false, error: "排序号（id）已被其他作品占用，请换一个" });
      }
    }

    // 没有可更新的字段
    if (Object.keys(fields).length === 0) {
      return sendJson(res, 400, { ok: false, error: "没有需要更新的字段" });
    }

    try {
      const result = await db.updateWork(id, fields);
      return sendJson(res, 200, {
        ok: true,
        id: result.id,
        category: result.category,
        title: result.title
      });
    } catch (err) {
      const status2 = err.status || 500;
      return sendJson(res, status2, {
        ok: false,
        error: err.message || "云函数内部错误",
        detail: err.detail
      });
    }
  }

  // ============ DELETE /api/works：删除作品（需 token，物理删除不可恢复）============
  if (req.method === "DELETE") {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { ok: false, error: "未登录或登录已失效，请重新登录" });
    }
    if (!process.env.CLOUDBASE_API_KEY) {
      return sendJson(res, 500, { ok: false, error: "服务端未配置 API Key" });
    }

    const id = parseInt(url.searchParams.get("id"), 10);
    if (!id || id <= 0) {
      return sendJson(res, 400, { ok: false, error: "缺少或非法的作品 id" });
    }

    try {
      const result = await db.deleteWork(id);
      return sendJson(res, 200, { ok: true, id: result.id, deleted: true });
    } catch (err) {
      const status2 = err.status || 500;
      return sendJson(res, status2, {
        ok: false,
        error: err.message || "云函数内部错误",
        detail: err.detail
      });
    }
  }

  // 其他方法（PUT 等）—— 一律拒绝
  return sendJson(res, 405, { ok: false, error: "不支持的请求方法" });
});

// 必须监听 9000 端口（平台要求）
server.listen(9000, "0.0.0.0", function () {
  console.log("works function listening on 9000");
});
