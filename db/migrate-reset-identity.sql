-- ============================================================
-- Day 24：创建 reset_works_identity RPC 函数
-- 用途：改作品 id（排序）后，把 works 表的自增序列拨回当前最大 id，
--       避免下次新增时主键与已手动设置的 id 撞车。
--
-- 通过 REST 网关以 RPC 方式调用（POST /rpc/reset_works_identity）。
-- ============================================================

-- 先删旧的（幂等，可重复执行）
DROP FUNCTION IF EXISTS reset_works_identity();

CREATE OR REPLACE FUNCTION reset_works_identity()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _max bigint;
BEGIN
  SELECT COALESCE(MAX(id), 1) INTO _max FROM works;
  PERFORM setval(pg_get_serial_sequence('works', 'id'), _max);
  RETURN _max;
END;
$$;
