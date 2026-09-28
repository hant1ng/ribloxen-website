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

CREATE TABLE IF NOT EXISTS office_materials (
 id TEXT PRIMARY KEY,
 part_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
 brand TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT '',
 specs TEXT NOT NULL DEFAULT '',
 aliases TEXT NOT NULL DEFAULT '',
 alternatives TEXT NOT NULL DEFAULT '',
 source_url TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS office_materials_part_number ON office_materials(part_number);
CREATE INDEX IF NOT EXISTS office_materials_brand ON office_materials(brand);

CREATE TABLE IF NOT EXISTS office_suppliers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL UNIQUE COLLATE NOCASE,
 contact_name TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 wechat TEXT NOT NULL DEFAULT '',
 channel_type TEXT NOT NULL DEFAULT '',
 link TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS office_customers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL UNIQUE COLLATE NOCASE,
 contact_name TEXT NOT NULL DEFAULT '',
 phone TEXT NOT NULL DEFAULT '',
 wechat TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS office_supplier_quotes (
 id TEXT PRIMARY KEY,
 material_id TEXT NOT NULL,
 supplier_id TEXT NOT NULL,
 quantity REAL NOT NULL DEFAULT 1,
 unit_price REAL NOT NULL,
 currency TEXT NOT NULL DEFAULT 'CNY',
 tax_included INTEGER NOT NULL DEFAULT 0,
 shipping_included INTEGER NOT NULL DEFAULT 0,
 lead_time TEXT NOT NULL DEFAULT '',
 quoted_at INTEGER NOT NULL,
 valid_until INTEGER,
 source TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS office_supplier_quotes_material ON office_supplier_quotes(material_id,quoted_at DESC);
CREATE INDEX IF NOT EXISTS office_supplier_quotes_supplier ON office_supplier_quotes(supplier_id,quoted_at DESC);

CREATE TABLE IF NOT EXISTS office_purchases (
 id TEXT PRIMARY KEY,
 material_id TEXT NOT NULL,
 supplier_id TEXT NOT NULL,
 customer_id TEXT,
 quantity REAL NOT NULL DEFAULT 1,
 unit_price REAL NOT NULL,
 currency TEXT NOT NULL DEFAULT 'CNY',
 tax_included INTEGER NOT NULL DEFAULT 0,
 shipping_included INTEGER NOT NULL DEFAULT 0,
 purchased_at INTEGER NOT NULL,
 order_ref TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS office_purchases_material ON office_purchases(material_id,purchased_at DESC);

CREATE TABLE IF NOT EXISTS office_sales (
 id TEXT PRIMARY KEY,
 material_id TEXT NOT NULL,
 customer_id TEXT,
 quantity REAL NOT NULL DEFAULT 1,
 unit_price REAL NOT NULL,
 cost_unit_price REAL,
 currency TEXT NOT NULL DEFAULT 'CNY',
 tax_included INTEGER NOT NULL DEFAULT 0,
 shipping_included INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'quoted',
 quoted_at INTEGER NOT NULL,
 ordered_at INTEGER,
 order_ref TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS office_sales_material ON office_sales(material_id,quoted_at DESC);

CREATE TABLE IF NOT EXISTS office_login_limits (
 bucket TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS office_login_limits_expiry ON office_login_limits(expires_at);
