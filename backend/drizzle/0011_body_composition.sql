-- 身体成分指标：体脂率(%) 与 骨骼肌量(kg)
-- 两列均可空：历史记录没有这两个值，用户也可能只有普通体重秤
ALTER TABLE weight_records ADD COLUMN body_fat REAL;
ALTER TABLE weight_records ADD COLUMN skeletal_muscle REAL;

-- profile 保存「当前值」快照，语义同已有的 weight 列
ALTER TABLE bmi_profiles ADD COLUMN body_fat REAL;
ALTER TABLE bmi_profiles ADD COLUMN skeletal_muscle REAL;
