# API 契约（api-contract.md）

> 本文档记录项目前后端约定的接口规范。Day 15 起维护，新增接口时在下方追加。

## 环境信息

| 项 | 值 |
|----|-----|
| 云环境 | 腾讯云 CloudBase（体验版） |
| 环境 ID | `changda-vibecoding-d8c0v64bdbf7c` |
| 云函数公网域名 | `https://changda-vibecoding-d8c0v64bdbf7c-1500185360.ap-shanghai.app.tcloudbase.com` |
| 前端静态托管域名 | `https://changda-vibecoding-d8c0v64bdbf7c-1500185360.tcloudbaseapp.com` |
| 到期时间 | 2027-04-04 |

---

## 0. 代码分层（Day 19 起）

> Day 19 重构：把 works 云函数里「接口的事」和「数据库的事」拆成两层，各管一摊。

```
                    ┌─────────────────────────────┐
      浏览器/前端     │  HTTP 层：index.js          │
      ───────────►  │  只管「接口长什么样」          │
                    │  · 路由（GET/POST）           │
                    │  · 输入校验、中文提示          │
                    │  · 包 JSON 返回、状态码        │
                    └──────────┬──────────────────┘
                               │ 调用 db.listWorks()
                               │      db.findDuplicate()
                               │      db.insertWork()
                               ▼
                    ┌─────────────────────────────┐
                    │  数据访问层：db.js（DAO）      │
                    │  只管「数据怎么进出」          │
                    │  · 拼 REST 网关查询串          │
                    │  · fetch 查重 / 读 / 插入      │
                    │  · description ↔ desc 翻译    │
                    └──────────┬──────────────────┘
                               │ fetch REST 网关
                               ▼
                    ┌─────────────────────────────┐
                    │  PostgreSQL（works 表）       │
                    └─────────────────────────────┘
```

**为什么拆**：接口格式（怎么返回）和数据存取（怎么查库）是两个会各自变化的维度，分开后改一处不牵连另一处；数据层函数还能被后台、管理页复用。

**约束**：接口路径、字段名、返回结构是「契约」，两层之间只通过函数调用传递，契约本身不因分层而改变。

---

## 1. GET /api/health —— 健康检查

**用途**：验证云函数部署成功、公网链路通畅。前端首次加载时可调用它探测后端是否可用（Day 15 的 mock 版暂不调用，仅手动验证）。

### 请求

- 方法：`GET`
- 路径：`/api/health`
- 参数：无
- 请求头：无需鉴权（身份认证已关闭）

### 成功响应

- 状态码：`200`
- Content-Type：`application/json; charset=utf-8`

```json
{
  "status": "ok",
  "service": "api/health",
  "message": "CloudBase 云函数运行正常",
  "time": "2026-10-04T12:05:56.711Z"
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 固定 `"ok"`，表示函数运行正常 |
| `service` | string | 接口标识，固定 `"api/health"` |
| `message` | string | 人类可读的状态说明（中文） |
| `time` | string | 本次响应的服务端时间（ISO 8601 UTC，比北京时间慢 8 小时） |

### 失败情况

| 现象 | 可能原因 | 处理 |
|------|---------|------|
| 浏览器显示 404 | 路由未配置或未生效 | 检查「HTTP 网关 → 路由管理」是否有 `/api/health` → 云函数 `health` 的映射 |
| 页面无响应 / 超时 | 函数未部署或被停用 | 进「函数管理 → health → 函数代码」确认已部署、状态正常 |
| 返回非 JSON 内容 | 函数代码不是 Web（http server）形式 | 确认 index.js 使用 `http.createServer` 并监听 `9000` 端口 |

### 实现备注

- 函数类型：HTTP 型（Web 函数），监听端口 `9000`
- 代码位置：项目内 `functions/health/index.js`（与线上一致）；控制台在线编辑器亦可改
- 部署方式：控制台「函数代码 → 部署」按钮

---

## 数据模型（Day 16 起）

> 本节是数据库表结构的契约来源。前端/接口读写的数据字段，一律以这里为准。
> 建表脚本见 `db/schema.sql`，示例数据见 `db/seed.sql`（可重复执行）。

### 数据库实现说明

| 项 | 值 |
|----|-----|
| 数据库类型 | **PostgreSQL**（CloudBase「SQL 型数据库」，控制台标题：PostgreSQL 管理） |
| Schema | `public` |
| 建表方式 | `db/schema.sql`（先 DROP 再 CREATE，可重复执行） |
| 种子数据 | `db/seed.sql`（先 DELETE 再 INSERT，可重复执行） |
| 执行方式 | 控制台「SQL 编辑器」粘贴执行，或 CLI：`tcb db execute -e <envId> --sql "<SQL>"` |

> 术语提示：`desc` 是 SQL 保留字（`ORDER BY ... DESC`），故数据库列名用 `description`，
> 接口层（Day 17 起）映射回前端惯用的 `desc` 字段名。

### 两张表分别存什么、靠哪个字段关联

| 表 | 存什么 | 角色 |
|----|--------|------|
| `users`（账号表） | 登录凭据：谁可以登录后台 | 「一」的一方 |
| `works`（作品表） | 分享区四板块作品（涂鸦/随笔/合影/资源） | 「多」的一方 |

**关联字段**：`works.user_id` → `users.id`（外键）。一个账号可以有多条作品，作品归属某个账号。

### 表 1：users（账号表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT | 主键、IDENTITY 自增 | 用户主键 |
| `username` | VARCHAR(32) | 唯一、非空 | 登录用户名（不开放注册，仅本人一个账号） |
| `password_hash` | VARCHAR(255) | 非空 | 密码哈希（加盐，绝不存明文） |
| `created_at` | TIMESTAMP | 默认 `now()` | 账号创建时间 |

> 种子数据说明：`users` 表含 1 个真实账号（`changda`）+ 4 个测试账号（`test_user_1~4`，密码同为占位值）。
> 测试账号仅为满足「每张核心表 select ≥5 行」的验证标准，业务上系统只有本人一个账号；后续可清理。

### 表 2：works（作品表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | BIGINT | 主键、IDENTITY 自增 | 作品主键 |
| `user_id` | BIGINT | 非空、外键 → `users.id` | 所属账号（★关联字段） |
| `category` | VARCHAR(16) | 非空 | 板块：`doodle`/`essay`/`photo`/`resource` |
| `title` | VARCHAR(120) | 非空 | 作品标题 |
| `description` | TEXT | 可空 | 作品简介（随笔为正文，可较长）；接口层映射为 `desc` |
| `img` | VARCHAR(255) | 可空 | 图片文件名（涂鸦/随笔/合影用，资源类可空） |
| `link` | VARCHAR(2048) | 可空 | 外链网址（仅资源板块使用） |
| `status` | VARCHAR(8) | 非空、默认 `public` | 可见性：`public` 公开 / `hidden` 隐藏 |
| `created_at` | TIMESTAMP | 默认 `now()` | 作品发布时间 |

索引：`idx_works_user (user_id)`、`idx_works_category (category)`。
外键行为：`ON DELETE CASCADE ON UPDATE CASCADE`（删除账号时其作品一并删除）。

**板块与字段对应**（对齐 `data.js` 原 mock 结构）：

| 板块 | category 值 | 用到的字段 |
|------|-------------|-----------|
| 涂鸦 | `doodle` | title / desc / img |
| 随笔 | `essay` | title / desc / img（可空） |
| 合影 | `photo` | title / desc / img |
| 资源 | `resource` | title / desc / link |

---

## 2. GET /api/works —— 分享列表读接口

**用途**：给前端分享区提供作品列表。从 PostgreSQL 的 `works` 表读取「公开」作品，返回前做字段翻译（数据库 `description` → 前端 `desc`）。

### 请求

- 方法：`GET`
- 路径：`/api/works`
- 参数（均可选）：
  | 参数 | 类型 | 说明 |
  |------|------|------|
  | `category` | string | 按板块筛选：`doodle`/`essay`/`photo`/`resource`，不传则返回全部 |
  | `limit` | number | 返回条数上限，不传则返回全部 |
- 请求头：无需鉴权（公开只读）

### 成功响应

- 状态码：`200`
- Content-Type：`application/json; charset=utf-8`

```json
{
  "ok": true,
  "count": 7,
  "data": [
    {
      "id": 1,
      "category": "doodle",
      "title": "手",
      "desc": "速写课第一节，画自己的手，感觉还不错，看来美术功底还在",
      "img": "img-hand.jpg",
      "link": null
    }
  ]
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 固定 `true` 表示成功 |
| `count` | number | 本次返回的条数 |
| `data` | array | 作品数组，每项字段：`id`（作品ID）、`category`（板块）、`title`（标题）、`desc`（简介，★由数据库 `description` 翻译而来）、`img`（图片文件名，可 null）、`link`（外链，可 null） |

> **关键约定（Day 17 思考题答案）**：数据库列名是 `description`（`desc` 是 SQL 保留字），
> 接口返回时翻译成 `desc`，与前端 `data.js` 的旧字段名对齐。所以「接口返回里和表对不上的那一项」就是 **`desc`（接口）↔ `description`（表）**。

### 失败情况

| 现象 | 可能原因 | 处理 |
|------|---------|------|
| 返回 `{"ok":false,"error":"服务端未配置 API Key"}` | 函数环境变量 `CLOUDBASE_API_KEY` 未配置 | 控制台 → 云函数 → works → 函数配置 → 环境变量，添加 Key |
| 返回 `{"ok":false,"error":"数据库读取失败"}` | REST 网关返回非 200 | 查看响应 `detail` 字段的原始错误 |
| 404 / INVALID_PATH | HTTP 访问服务路由未配置 | 确认「HTTP 访问服务」有 `/api/works` → `works` 的映射 |

### 实现备注

- 函数类型：HTTP 型（Web 函数），监听 `9000` 端口，`scf_bootstrap` 启动（`node index.js`）
- 代码位置：`functions/works/index.js`（含 `scf_bootstrap`、`package.json`）
- 数据来源：通过 REST 网关 `https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest/works`，以 API Key（service_role）鉴权
- 只返回 `status=public` 的公开作品（`hidden` 不对外）
- 环境变量：`CLOUDBASE_API_KEY`（函数环境变量注入，不写死、不进 git）

---

## 3. POST /api/works —— 作品写入接口（新增作品）

**用途**：给登录后的后台「上传作品」用。向 `works` 表新增一条作品，成功后返回新作品的 id。

### 请求

- 方法：`POST`
- 路径：`/api/works`
- 请求头：`Content-Type: application/json`
- 请求体（JSON）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | ✅ 必填 | 板块：`doodle`/`essay`/`photo`/`resource`（白名单校验） |
| `title` | string | ✅ 必填 | 作品标题 |
| `desc` | string | 可空 | 简介（接口层字段名，落库时映射为 `description`） |
| `img` | string | 可空 | 图片文件名（资源板块忽略） |
| `link` | string | 可空 | 外链网址（仅资源板块使用） |

```json
{
  "category": "essay",
  "title": "下一个灵气复苏时代",
  "desc": "非洲大地可以等下一个雨季……",
  "img": null,
  "link": null
}
```

### 成功响应

- 状态码：`201`
- Content-Type：`application/json; charset=utf-8`

```json
{
  "ok": true,
  "id": 10,
  "category": "essay",
  "title": "下一个灵气复苏时代"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 固定 `true` |
| `id` | number | 新作品的数据库主键（自增） |
| `category` / `title` | string | 回显写入的板块与标题 |

### 失败情况（含「防重复提交」与「错误输入」的防护）

| 现象 | 状态码 | 说明 |
|------|--------|------|
| `{"ok":false,"error":"该作品已存在，请勿重复提交","duplicateId":10}` | 409 | ★防重复提交：同 `category`+`title` 已存在，拒绝写入 |
| `{"ok":false,"error":"缺少必填字段：标题（title）"}` | 400 | ★错误输入：缺必填字段，中文提示 |
| `{"ok":false,"error":"板块不合法，应为 doodle / essay / photo / resource 之一"}` | 400 | ★错误输入：`category` 不在白名单，中文提示 |
| `{"ok":false,"error":"请求体不是合法的 JSON"}` | 400 | 请求体解析失败 |
| `{"ok":false,"error":"服务端未配置 API Key"}` | 500 | 函数环境变量 `CLOUDBASE_API_KEY` 缺失 |
| `{"ok":false,"error":"数据库写入失败", ...}` | 非 2xx | REST 网关写入失败，`detail` 含原始错误 |

### 实现备注

- 函数类型：HTTP 型（Web 函数），与 GET 共用 `functions/works/index.js`
- 归属账号：`user_id` 固定为 `1`（`changda`，系统唯一账号、不开放注册）；登录鉴权留待后续
- 字段映射：接口 `desc` → 数据库 `description`（与 Day 17 读接口相反方向）
- 板块字段规则：`resource` 板块用 `link`、其余用 `img`
- **防重复方式**：应用层查重（POST 前按 `category+title` 查），未加唯一约束（避免 Day 18 改表结构）
- 服务端日志：每次写入 `console.log` 打一条（余力加练，便于排查）

---

## 后续接口（占位）

Day 19 起新增：登录/账号接口、PATCH（修改）、DELETE（删除，第 4 周）。新增时按上面的格式追加：用途 / 请求 / 成功响应 / 失败情况 / 实现备注。
