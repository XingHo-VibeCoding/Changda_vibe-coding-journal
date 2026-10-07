// ============================================================
// 数据访问层（DAO）：db.js
// Day 19 从 index.js 拆出来的「数据库的事」
//
// 本文件只管「数据怎么进出」，不管「接口长什么样」：
//   - 拼 REST 网关查询串
//   - fetch 查重 / 读列表 / 插入
//   - 拿 API Key 做 Bearer 鉴权
//   - description ↔ desc 字段翻译
//
// 对外暴露三个函数（给 index.js 调用）：
//   listWorks({ category, limit })  → GET 读公开作品列表
//   findDuplicate(category, title)  → POST 查重
//   insertWork(fields)              → POST 写一条新作品
// ============================================================

// 环境变量（部署时配置，绝不写死、不进 git）
const ENV_ID = process.env.CLOUDBASE_ENV_ID || "changda-vibecoding-d8c0v64bdbf7c";
const API_KEY = process.env.CLOUDBASE_API_KEY;

// 板块白名单（对应 data.js 四板块）—— 校验放 index.js，这里只负责读写
const CATEGORIES = ["doodle", "essay", "photo", "resource"];

// 作品归属账号：系统只有一个账号（changda，id=1，不开放注册）
const OWNER_USER_ID = 1;

// REST 网关基础地址（PostgREST 风格）
const GW = "https://" + ENV_ID + ".api.tcloudbasegateway.com/v1/rdb/rest/works";

// 统一鉴权头
function authHeaders(extra) {
  return Object.assign(
    { Authorization: "Bearer " + API_KEY },
    extra || {}
  );
}

// 服务端日志
function log(...args) {
  console.log("[db " + new Date().toISOString() + "]", ...args);
}

// —— 把数据库一行翻译成接口返回的字段（description → desc）——
function toApiRow(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    desc: row.description,
    img: row.img || null,
    link: row.link || null
  };
}

// —— 列表读取（GET 用）——
// 返回：Promise<Array>，每项已是接口字段（含 desc）
async function listWorks(options) {
  options = options || {};
  const category = options.category;
  const limit = options.limit;

  let qs = "select=*&status=eq.public";
  if (category) qs += "&category=eq." + encodeURIComponent(category);
  if (limit > 0) qs += "&limit=" + limit;

  const r = await fetch(GW + "?" + qs, {
    method: "GET",
    headers: authHeaders()
  });

  if (!r.ok) {
    const body = await r.text();
    log("读列表失败", r.status, body);
    const err = new Error("数据库读取失败");
    err.status = r.status;
    err.detail = body;
    throw err;
  }

  const rows = await r.json();
  return rows.map(toApiRow);
}

// —— 查重（POST 用）：同 category + 同 title 视为重复 ——
// 返回：Promise<Object|null>，重复则返回已存在的那行，否则 null
async function findDuplicate(category, title) {
  const qs = "select=id&category=eq." + encodeURIComponent(category)
    + "&title=eq." + encodeURIComponent(title);

  const r = await fetch(GW + "?" + qs, {
    method: "GET",
    headers: authHeaders()
  });

  if (!r.ok) {
    const body = await r.text();
    log("查重失败", r.status, body);
    // 查重失败不阻断主流程（写入时数据库还会兜底），返回 null 表示「没查到重复」
    return null;
  }

  const existing = await r.json();
  if (existing && existing.length > 0) {
    return existing[0];
  }
  return null;
}

// —— 写入一条新作品（POST 用）——
// fields：{ category, title, description, img, link }
// 返回：Promise<Object>，包含新作品的 id、category、title
async function insertWork(fields) {
  const insertRes = await fetch(GW, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "Prefer": "return=representation"   // 让网关返回插入后的完整行（含自增 id）
    }),
    body: JSON.stringify({
      user_id: OWNER_USER_ID,
      category: fields.category,
      title: fields.title,
      description: fields.description || null,   // 数据库列名 description
      img: fields.img || null,
      link: fields.link || null,
      status: "public"                             // 默认公开
    })
  });

  if (!insertRes.ok) {
    const errBody = await insertRes.text();
    log("插入失败", insertRes.status, errBody);
    const err = new Error("数据库写入失败");
    err.status = insertRes.status;
    err.detail = errBody;
    throw err;
  }

  const inserted = await insertRes.json();
  const newId = inserted && (inserted.id || (inserted[0] && inserted[0].id));

  log("新增作品成功", JSON.stringify({ id: newId, category: fields.category, title: fields.title }));

  return {
    id: newId,
    category: fields.category,
    title: fields.title
  };
}

// 对外暴露（供 index.js require 使用）
module.exports = {
  CATEGORIES: CATEGORIES,
  listWorks: listWorks,
  findDuplicate: findDuplicate,
  insertWork: insertWork
};
