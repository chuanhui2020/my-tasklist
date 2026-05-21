-- 重建 loans 表：简化为核心三字段模型（贷款消除计划）
DROP TABLE IF EXISTS loans;
CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  loan_type TEXT NOT NULL CHECK(loan_type IN ('mortgage', 'bank_loan')),
  remaining_balance REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  remaining_months INTEGER NOT NULL,
  annual_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'settled')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_loans_user_status ON loans(user_id, status);
