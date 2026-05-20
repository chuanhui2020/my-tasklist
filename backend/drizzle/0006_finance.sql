-- Finance passwords (one per user)
CREATE TABLE finance_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Loans (mortgage and bank loans)
CREATE TABLE loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('mortgage', 'bank_loan')),
  principal REAL NOT NULL,
  annual_rate REAL NOT NULL,
  total_months INTEGER NOT NULL,
  repayment_method TEXT NOT NULL CHECK (repayment_method IN ('equal_installment', 'equal_principal')),
  start_date TEXT NOT NULL,
  paid_months INTEGER NOT NULL DEFAULT 0,
  prepayment_total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_loans_user_status ON loans(user_id, status);
