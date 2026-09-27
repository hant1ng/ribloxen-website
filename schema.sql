CREATE TABLE IF NOT EXISTS inquiries (
 id TEXT PRIMARY KEY,
 created_at INTEGER NOT NULL,
 type TEXT NOT NULL,
 name TEXT NOT NULL,
 contact TEXT NOT NULL,
 company TEXT NOT NULL DEFAULT '',
 product TEXT NOT NULL DEFAULT '',
 quantity TEXT NOT NULL DEFAULT '',
 delivery_date TEXT NOT NULL DEFAULT '',
 details TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_created_at ON inquiries(created_at);
CREATE TABLE IF NOT EXISTS rfq_limits (bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rfq_limits_expiry ON rfq_limits(expires_at);
