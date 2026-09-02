-- 移除财务管理模块：删除 loans / finance_passwords 两张表
-- 对应代码已在同一提交中删除（routes/finance.ts、views/Finance.vue 等）
-- 注意：本迁移会永久删除贷款记录与财务模块独立密码，执行前请确认无需保留

DROP INDEX IF EXISTS idx_loans_user_status;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS finance_passwords;
