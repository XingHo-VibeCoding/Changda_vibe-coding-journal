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

## 后续接口（占位）

Day 17 起新增：登录/账号接口、分享列表接口、数据读写接口。新增时按上面的格式追加：用途 / 请求 / 成功响应 / 失败情况 / 实现备注。
