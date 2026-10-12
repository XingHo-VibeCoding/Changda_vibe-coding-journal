-- ============================================================
-- migrate-add-file.sql · 增量迁移脚本（Day 22｜2026-10-10）
-- 用途：给【线上已有的】works 表新增 file 字段（文档地址）。
--
-- 为什么不用 schema.sql？因为 schema.sql 是「DROP 再 CREATE」，
-- 重跑会清空线上已有的作品数据。线上表里已经有数据了，
-- 所以用这条 ALTER 增量加字段，只加列、不动现有数据。
--
-- 执行方式（任选其一）：
--   ① CloudBase 控制台 → 数据库 → SQL 型数据库 → 在线执行 SQL，粘贴下面这句
--   ② 用你熟悉的数据库客户端连上去执行
--
-- 说明：file 字段存文档的云存储公开 URL，可空。
-- ============================================================

ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "file" VARCHAR(2048);

COMMENT ON COLUMN "works"."file" IS '文档地址（资源板块可上传的 PDF/Word 等附件云存储 URL，其余为 NULL）';
