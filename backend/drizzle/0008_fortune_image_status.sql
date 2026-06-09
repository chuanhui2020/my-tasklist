-- 占卜生图异步化：记录图片生成状态
-- 取值：NULL/未开始, 'generating', 'done', 'failed'
ALTER TABLE fortune_records ADD COLUMN image_status TEXT;
