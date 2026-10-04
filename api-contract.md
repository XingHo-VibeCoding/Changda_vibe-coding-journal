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

## 后续接口（占位）

Day 16–20 计划新增：登录/账号接口、分享列表接口、数据读写接口。新增时按上面的格式追加：用途 / 请求 / 成功响应 / 失败情况 / 实现备注。
