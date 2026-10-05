-- ============================================================
-- seed.sql · 种子脚本（Day 16｜2026-10-05）
-- 项目：个人主页（王畅达）
-- 数据库：腾讯云 CloudBase · SQL 型数据库（PostgreSQL）
-- 用途：给两张表插入可复现的示例数据，用于 select 验证。
--
-- ★ 可重复执行：先删光数据、再重新插入，跑多少遍结果都一样、不报错。
--   最后用 setval 把自增序列拨回最大 id——因为种子数据显式指定了 id，
--   不重置的话，以后接口自动插入作品时主键会从 1 开始、和现有数据冲突。
-- ============================================================

-- 1) 先删子表（works 有外键依赖 users），再删父表
DELETE FROM "works";
DELETE FROM "users";

-- 2) 插入账号：1 个真实账号 + 4 个测试账号
--    password_hash 是占位示意值，不是真实密码！
--    真实密码绝不写进 seed.sql（PRD 8.3 安全底线：明文不入库、不入 git）。
--    test_user_1~4 是为满足「每张核心表 select ≥5 行」验证标准而造的测试数据，
--    业务上系统仍只有 changda 一个真实账号（不开放注册）；后续联调完可清理。
INSERT INTO "users" ("id", "username", "password_hash") VALUES
  (1, 'changda',     'salt$hashed_password_placeholder'),
  (2, 'test_user_1', 'salt$test_placeholder_1'),
  (3, 'test_user_2', 'salt$test_placeholder_2'),
  (4, 'test_user_3', 'salt$test_placeholder_3'),
  (5, 'test_user_4', 'salt$test_placeholder_4');

-- 3) 插入 8 条作品（四板块，覆盖有图 / 纯文字 / 外链 / 隐藏 四种情况）
INSERT INTO "works"
  ("id", "user_id", "category", "title", "description", "img", "link", "status") VALUES
  -- 涂鸦 4 条：对应 data.js 里现有的 4 张画
  (1, 1, 'doodle',   '手',     '速写课第一节，画自己的手，感觉还不错，看来美术功底还在', 'img-hand.jpg',        NULL, 'public'),
  (2, 1, 'doodle',   '涂鸦',   'emmm，我想想……',                                        'img-doodle-math.jpg', NULL, 'public'),
  (3, 1, 'doodle',   '冲鸭',   '冲鸭！继续加油',                                         'img-chongya.jpg',     NULL, 'public'),
  (4, 1, 'doodle',   '线条狗', '被阳光晾晒的小狗，云朵也化作小狗的模样，把可爱晒得蓬松柔软。', 'img-dog-line.jpg', NULL, 'public'),
  -- 随笔 1 条：纯文字（img 为 NULL，验证「随笔可不配图」）
  (5, 1, 'essay',    '下一个灵气复苏时代', '非洲大地可以等下一个雨季，但人的一生那么短，还能等到下一个灵气复苏的时代吗？', NULL, NULL, 'public'),
  -- 合影 1 条：有图
  (6, 1, 'photo',    '宿舍合影', '和室友的第一张合照，纪念一起搬进新宿舍', 'img-portrait.jpg', NULL, 'public'),
  -- 资源 2 条：只有外链（img 为 NULL，验证「资源用 link」）；第 8 条顺带验证 hidden 状态
  (7, 1, 'resource', '浙大自动化课程资料', '专业课课件与习题整理，按学期归档', NULL, 'https://example.com/course-material', 'public'),
  (8, 1, 'resource', '我的常用工具', '写代码、画图、记笔记常用的一些工具合集', NULL, 'https://example.com/my-tools', 'hidden');

-- 4) 重置两张表的自增序列到当前最大 id
--    （显式插入 id 后序列仍停在 1，不重置的话下次自动插入会主键冲突）
SELECT setval(pg_get_serial_sequence('"users"', 'id'), (SELECT COALESCE(MAX("id"), 1) FROM "users"));
SELECT setval(pg_get_serial_sequence('"works"', 'id'), (SELECT COALESCE(MAX("id"), 1) FROM "works"));
