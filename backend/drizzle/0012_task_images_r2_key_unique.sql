-- 幂等上传兜底：同一 upload_id（即同一 r2_key）的并发请求只能落一条记录。
-- 否则两条记录共用一个 R2 对象，删除其一会连带删掉文件，另一条随即 404。
-- r2_key 历来是随机 UUID，加约束前已核对线上无重复（2026-11-23：4 条 / 4 个不同 key）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_images_r2_key ON task_images(r2_key);
