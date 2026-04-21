ALTER TABLE users ADD COLUMN last_login_at TEXT;
UPDATE users SET last_login_at = created_at;
