// ============================================================
// 数据访问层（DAO）：db.js
// Day 19 从 index.js 拆出来的「数据库的事」
// Day 22 新增管理后台三个函数：listAllWorks / updateWork / deleteWork
//
// 本文件只管「数据怎么进出」，不管「接口长什么样」：
//   - 拼 REST 网关查询串
//   - fetch 查重 / 读列表 / 插入 / 修改 / 删除
//   - 拿 API Key 做 Bearer 鉴权
//   - description ↔ desc 字段翻译
//
// 对外暴露六个函数（给 index.js 调用）：
//   listWorks({ category, limit })  → GET 读公开作品列表（前台分享区）
//   listAllWorks()                  → GET 读全部作品（管理后台，含 hidden）
//   findDuplicate(category, title)  → POST 查重
//   insertWork(fields)              → POST 写一条新作品
//   updateWork(id, fields)          → PATCH 修改一条作品
//   deleteWork(id)                  → DELETE 物理删除一条作品
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
    link: row.link || null,
    file: row.file || null,
    status: row.status || "public"
  };
}

// —— 列表读取（GET 用）——
// 返回：Promise<Array>，每项已是接口字段（含 desc）
async function listWorks(options) {
  options = options || {};
  const category = options.category;
  const limit = options.limit;

  // 显式按 id 升序排序，保证「上传顺序 / 手动调整的 id」决定展示顺序
  let qs = "select=*&status=eq.public&order=id.asc";
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
// fields：{ category, title, description, img, link, file }
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
      file: fields.file || null,                  // 文档地址（资源类附件）
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

// —— 读全部作品（管理后台用）：含 hidden，不按 status 过滤 ——
// 返回：Promise<Array>，每项已是接口字段（含 desc、status）
async function listAllWorks() {
  const qs = "select=*&order=id.asc";

  const r = await fetch(GW + "?" + qs, {
    method: "GET",
    headers: authHeaders()
  });

  if (!r.ok) {
    const body = await r.text();
    log("读全部作品失败", r.status, body);
    const err = new Error("数据库读取失败");
    err.status = r.status;
    err.detail = body;
    throw err;
  }

  const rows = await r.json();
  return rows.map(toApiRow);
}

// —— 查询某个 id 是否已被占用（改 id 前查重用）——
// 返回：Promise<boolean>，true 表示该 id 已存在（且不等于 excludeId）
async function idExists(id, excludeId) {
  let qs = "select=id&id=eq." + id;
  const r = await fetch(GW + "?" + qs, {
    method: "GET",
    headers: authHeaders()
  });
  if (!r.ok) {
    // 查询失败不阻断，返回 false 让后续写入时数据库兜底报主键冲突
    return false;
  }
  const rows = await r.json();
  if (!rows || rows.length === 0) return false;
  if (excludeId != null && rows.length === 1 && Number(rows[0].id) === Number(excludeId)) return false;
  return true;
}

// —— 修改一条作品（PATCH 用）——
// id：作品主键；fields：{ category, title, description, img, link, file, status, id(newId) }
// 支持改 id（方案 B：通过改 id 排序）。改 id 后需重置自增序列，避免下次新增撞车。
// 返回：Promise<Object>，包含修改后作品的新 id、category、title
async function updateWork(id, fields) {
  // 只允许更新白名单字段，避免误改 user_id / created_at
  const patch = {};
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.description !== undefined) patch.description = fields.description || null;
  if (fields.img !== undefined) patch.img = fields.img || null;
  if (fields.link !== undefined) patch.link = fields.link || null;
  if (fields.file !== undefined) patch.file = fields.file || null;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.id !== undefined) patch.id = fields.id;   // 改主键 id（排序用）

  const r = await fetch(GW + "?id=eq." + id, {
    method: "PATCH",
    headers: authHeaders({
      "Content-Type": "application/json",
      "Prefer": "return=representation"   // 返回更新后的完整行
    }),
    body: JSON.stringify(patch)
  });

  if (!r.ok) {
    const errBody = await r.text();
    log("修改失败", r.status, errBody);
    const err = new Error("数据库修改失败");
    err.status = r.status;
    err.detail = errBody;
    throw err;
  }

  const updated = await r.json();
  const row = updated && (updated[0] || updated);
  const newId = (fields.id !== undefined) ? fields.id : id;

  // 改 id 后，重置自增序列到当前最大 id，避免下次新增撞主键
  if (fields.id !== undefined) {
    try {
      await resetIdentity();
    } catch (e) {
      // 重置失败不致命（只是下次新增可能撞 id），记日志
      log("重置自增序列失败（可忽略）", e.message);
    }
  }

  log("修改作品成功", JSON.stringify({ id: id, newId: newId, category: fields.category, title: fields.title }));

  return {
    id: newId,
    category: row.category,
    title: row.title
  };
}

// —— 重置 works 表自增序列到当前最大 id ——
// 通过 REST 网关执行 SQL 函数（PostgREST 支持 RPC 调用）
async function resetIdentity() {
  const r = await fetch(GW.replace(/\/works$/, "/rpc/reset_works_identity"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: "{}"
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error("reset identity failed: " + r.status + " " + body);
  }
}

// —— 物理删除一条作品（DELETE 用，不可恢复）——
// 返回：Promise<Object>，包含被删除作品的 id
async function deleteWork(id) {
  const r = await fetch(GW + "?id=eq." + id, {
    method: "DELETE",
    headers: authHeaders()
  });

  if (!r.ok) {
    const errBody = await r.text();
    log("删除失败", r.status, errBody);
    const err = new Error("数据库删除失败");
    err.status = r.status;
    err.detail = errBody;
    throw err;
  }

  log("删除作品成功", JSON.stringify({ id: id }));

  return { id: id };
}

// 对外暴露（供 index.js require 使用）
module.exports = {
  CATEGORIES: CATEGORIES,
  listWorks: listWorks,
  listAllWorks: listAllWorks,
  findDuplicate: findDuplicate,
  insertWork: insertWork,
  updateWork: updateWork,
  deleteWork: deleteWork,
  idExists: idExists,
  resetIdentity: resetIdentity
};
