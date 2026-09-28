interface D1Result<T=Record<string,unknown>> { results?: T[]; success?: boolean; }
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T=Record<string,unknown>>(): Promise<T|null>;
  all<T=Record<string,unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface DB { prepare(sql:string): Statement; }
interface Env { RFQ_DB?: DB; RFQ_HASH_SALT?: string; OFFICE_PASSWORD?: string; }
type Context = { request: Request; env: Env };

const COOKIE = 'ribloxen_office_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
let schemaReady = false;

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      ...headers
    }
  });

const ready = (env: Env) =>
  Boolean(env.RFQ_DB && env.RFQ_HASH_SALT && env.RFQ_HASH_SALT.length >= 32 && env.OFFICE_PASSWORD && env.OFFICE_PASSWORD.length >= 12);

const trim = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const bool = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';
const dateMs = (value: unknown, fallback = Date.now()) => {
  const v = trim(value, 32);
  if (!v) return fallback;
  const n = Date.parse(v.length === 10 ? v + 'T00:00:00Z' : v);
  return Number.isFinite(n) ? n : fallback;
};

async function ensureSchema(db: DB) {
  if (schemaReady) return;
  const statements = [
    "CREATE TABLE IF NOT EXISTS office_materials (id TEXT PRIMARY KEY, part_number TEXT NOT NULL UNIQUE COLLATE NOCASE, brand TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', specs TEXT NOT NULL DEFAULT '', aliases TEXT NOT NULL DEFAULT '', alternatives TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS office_materials_part_number ON office_materials(part_number)",
    "CREATE INDEX IF NOT EXISTS office_materials_brand ON office_materials(brand)",
    "CREATE TABLE IF NOT EXISTS office_suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', wechat TEXT NOT NULL DEFAULT '', channel_type TEXT NOT NULL DEFAULT '', link TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS office_customers (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', wechat TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS office_supplier_quotes (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, supplier_id TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', tax_included INTEGER NOT NULL DEFAULT 0, shipping_included INTEGER NOT NULL DEFAULT 0, lead_time TEXT NOT NULL DEFAULT '', quoted_at INTEGER NOT NULL, valid_until INTEGER, source TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS office_supplier_quotes_material ON office_supplier_quotes(material_id, quoted_at DESC)",
    "CREATE INDEX IF NOT EXISTS office_supplier_quotes_supplier ON office_supplier_quotes(supplier_id, quoted_at DESC)",
    "CREATE TABLE IF NOT EXISTS office_purchases (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, supplier_id TEXT NOT NULL, customer_id TEXT, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', tax_included INTEGER NOT NULL DEFAULT 0, shipping_included INTEGER NOT NULL DEFAULT 0, purchased_at INTEGER NOT NULL, order_ref TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS office_purchases_material ON office_purchases(material_id, purchased_at DESC)",
    "CREATE TABLE IF NOT EXISTS office_sales (id TEXT PRIMARY KEY, material_id TEXT NOT NULL, customer_id TEXT, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, cost_unit_price REAL, currency TEXT NOT NULL DEFAULT 'CNY', tax_included INTEGER NOT NULL DEFAULT 0, shipping_included INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'quoted', quoted_at INTEGER NOT NULL, ordered_at INTEGER, order_ref TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS office_sales_material ON office_sales(material_id, quoted_at DESC)",
    "CREATE TABLE IF NOT EXISTS office_login_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS office_login_limits_expiry ON office_login_limits(expires_at)"
  ];
  for (const sql of statements) await db.prepare(sql).run();
  schemaReady = true;
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get('Cookie') || '';
  for (const item of raw.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function constantEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = aa.length ^ bb.length;
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (aa[i % Math.max(aa.length, 1)] || 0) ^ (bb[i % Math.max(bb.length, 1)] || 0);
  return diff === 0;
}

async function makeSession(secret: string) {
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const payload = String(expires);
  return payload + '.' + await hmac(secret, payload);
}

async function authenticated(request: Request, env: Env) {
  if (!env.RFQ_HASH_SALT) return false;
  const token = cookieValue(request, COOKIE);
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmac(env.RFQ_HASH_SALT, payload);
  return constantEqual(signature, expected);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function body(request: Request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('application/json')) throw new Error('content-type');
  const raw = await request.text();
  if (raw.length > 30000) throw new Error('too-large');
  const parsed = JSON.parse(raw || '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('json');
  return parsed as Record<string,unknown>;
}

async function loginRate(db: DB, request: Request, salt: string) {
  const now = Date.now();
  const hour = Math.floor(now / 3600000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = await hmac(salt, hour + ':' + ip);
  await db.prepare('DELETE FROM office_login_limits WHERE expires_at < ?').bind(now).run();
  const row = await db.prepare('INSERT INTO office_login_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket, (hour + 2) * 3600000).first<{count:number}>();
  return row?.count || 99;
}

async function listRows<T=Record<string,unknown>>(stmt: Statement) {
  const result = await stmt.all<T>();
  return result.results || [];
}

async function materialDetail(db: DB, id: string) {
  const material = await db.prepare('SELECT * FROM office_materials WHERE id=?').bind(id).first();
  if (!material) return null;
  const supplierQuotes = await listRows(db.prepare("SELECT q.*,s.name AS supplier_name,s.channel_type AS supplier_channel FROM office_supplier_quotes q LEFT JOIN office_suppliers s ON s.id=q.supplier_id WHERE q.material_id=? ORDER BY q.quoted_at DESC LIMIT 200").bind(id));
  const purchases = await listRows(db.prepare("SELECT p.*,s.name AS supplier_name,c.name AS customer_name FROM office_purchases p LEFT JOIN office_suppliers s ON s.id=p.supplier_id LEFT JOIN office_customers c ON c.id=p.customer_id WHERE p.material_id=? ORDER BY p.purchased_at DESC LIMIT 200").bind(id));
  const sales = await listRows(db.prepare("SELECT x.*,c.name AS customer_name FROM office_sales x LEFT JOIN office_customers c ON c.id=x.customer_id WHERE x.material_id=? ORDER BY x.quoted_at DESC LIMIT 200").bind(id));
  return { material, supplierQuotes, purchases, sales };
}

export async function onRequest({ request, env }: Context) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/office\/?/, '').replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 405 });

  if (route === 'status' && method === 'GET') {
    const ok = ready(env);
    return json({ ready: ok, authenticated: ok ? await authenticated(request, env) : false });
  }

  if (!ready(env)) return json({ message: '内部报价库尚未完成安全配置。' }, 503);
  const db = env.RFQ_DB!;
  await ensureSchema(db);

  if (route === 'login' && method === 'POST') {
    if (!sameOrigin(request)) return json({ message: '请求来源无效。' }, 403);
    const attempts = await loginRate(db, request, env.RFQ_HASH_SALT!);
    if (attempts > 12) return json({ message: '尝试次数过多，请稍后再试。' }, 429);
    let data: Record<string,unknown>;
    try { data = await body(request); } catch { return json({ message: '请求格式有误。' }, 400); }
    if (!constantEqual(trim(data.password, 200), env.OFFICE_PASSWORD!)) return json({ message: '密码不正确。' }, 401);
    const session = await makeSession(env.RFQ_HASH_SALT!);
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': COOKIE + '=' + encodeURIComponent(session) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + SESSION_SECONDS }
    );
  }

  if (route === 'logout' && method === 'POST') {
    if (!sameOrigin(request)) return json({ message: '请求来源无效。' }, 403);
    return json({ ok: true }, 200, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }

  if (!await authenticated(request, env)) return json({ message: '请先登录。' }, 401);
  if (['POST','PUT','PATCH','DELETE'].includes(method) && !sameOrigin(request)) return json({ message: '请求来源无效。' }, 403);

  try {
    if (route === 'dashboard' && method === 'GET') {
      const [materials, suppliers, quotes, purchases, sales] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS count FROM office_materials').first<{count:number}>(),
        db.prepare('SELECT COUNT(*) AS count FROM office_suppliers').first<{count:number}>(),
        db.prepare('SELECT COUNT(*) AS count FROM office_supplier_quotes').first<{count:number}>(),
        db.prepare('SELECT COUNT(*) AS count FROM office_purchases').first<{count:number}>(),
        db.prepare('SELECT COUNT(*) AS count FROM office_sales').first<{count:number}>()
      ]);
      const recent = await listRows(db.prepare("SELECT m.id,m.part_number,m.brand,m.name,MAX(h.when_at) AS last_activity FROM office_materials m LEFT JOIN (SELECT material_id,quoted_at AS when_at FROM office_supplier_quotes UNION ALL SELECT material_id,purchased_at FROM office_purchases UNION ALL SELECT material_id,quoted_at FROM office_sales) h ON h.material_id=m.id GROUP BY m.id ORDER BY COALESCE(last_activity,m.updated_at) DESC LIMIT 8"));
      return json({ counts: { materials: materials?.count||0, suppliers: suppliers?.count||0, supplierQuotes: quotes?.count||0, purchases: purchases?.count||0, sales: sales?.count||0 }, recent });
    }

    if (route === 'materials' && method === 'GET') {
      const q = trim(url.searchParams.get('q'), 120);
      const like = '%' + q.replace(/[%_]/g, '\\$&') + '%';
      const rows = q
        ? await listRows(db.prepare("SELECT m.*, (SELECT unit_price FROM office_purchases p WHERE p.material_id=m.id ORDER BY purchased_at DESC LIMIT 1) AS latest_purchase_price, (SELECT unit_price FROM office_supplier_quotes q WHERE q.material_id=m.id ORDER BY quoted_at DESC LIMIT 1) AS latest_supplier_price, (SELECT unit_price FROM office_sales s WHERE s.material_id=m.id ORDER BY quoted_at DESC LIMIT 1) AS latest_sale_price FROM office_materials m WHERE part_number LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' OR alternatives LIKE ? ESCAPE '\\' ORDER BY CASE WHEN part_number=? THEN 0 ELSE 1 END, updated_at DESC LIMIT 60").bind(like,like,like,like,like,like,q))
        : await listRows(db.prepare("SELECT m.*, (SELECT unit_price FROM office_purchases p WHERE p.material_id=m.id ORDER BY purchased_at DESC LIMIT 1) AS latest_purchase_price, (SELECT unit_price FROM office_supplier_quotes q WHERE q.material_id=m.id ORDER BY quoted_at DESC LIMIT 1) AS latest_supplier_price, (SELECT unit_price FROM office_sales s WHERE s.material_id=m.id ORDER BY quoted_at DESC LIMIT 1) AS latest_sale_price FROM office_materials m ORDER BY updated_at DESC LIMIT 60"));
      return json({ results: rows });
    }

    if (route === 'materials' && method === 'POST') {
      const data = await body(request);
      const partNumber = trim(data.part_number, 120);
      if (!partNumber) return json({ message: '料号不能为空。' }, 400);
      const now = Date.now();
      const id = crypto.randomUUID();
      try {
        await db.prepare('INSERT INTO office_materials (id,part_number,brand,name,category,specs,aliases,alternatives,source_url,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id,partNumber,trim(data.brand,100),trim(data.name,160),trim(data.category,120),trim(data.specs,5000),trim(data.aliases,1000),trim(data.alternatives,1000),trim(data.source_url,1000),trim(data.notes,5000),now,now).run();
      } catch {
        return json({ message: '这个料号已经存在。' }, 409);
      }
      return json({ id }, 201);
    }

    const materialMatch = route.match(/^materials\/([^/]+)$/);
    if (materialMatch && method === 'GET') {
      const detail = await materialDetail(db, materialMatch[1]);
      return detail ? json(detail) : json({ message: '物料不存在。' }, 404);
    }

    if (materialMatch && method === 'PUT') {
      const data = await body(request);
      const partNumber = trim(data.part_number, 120);
      if (!partNumber) return json({ message: '料号不能为空。' }, 400);
      await db.prepare('UPDATE office_materials SET part_number=?,brand=?,name=?,category=?,specs=?,aliases=?,alternatives=?,source_url=?,notes=?,updated_at=? WHERE id=?')
        .bind(partNumber,trim(data.brand,100),trim(data.name,160),trim(data.category,120),trim(data.specs,5000),trim(data.aliases,1000),trim(data.alternatives,1000),trim(data.source_url,1000),trim(data.notes,5000),Date.now(),materialMatch[1]).run();
      return json({ ok: true });
    }

    if (route === 'suppliers' && method === 'GET') {
      const q = trim(url.searchParams.get('q'), 120);
      const like = '%' + q.replace(/[%_]/g, '\\$&') + '%';
      const rows = q
        ? await listRows(db.prepare("SELECT * FROM office_suppliers WHERE name LIKE ? ESCAPE '\\' OR contact_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR wechat LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 100").bind(like,like,like,like))
        : await listRows(db.prepare('SELECT * FROM office_suppliers ORDER BY updated_at DESC LIMIT 200'));
      return json({ results: rows });
    }

    if (route === 'suppliers' && method === 'POST') {
      const data = await body(request);
      const name = trim(data.name, 160);
      if (!name) return json({ message: '供应商名称不能为空。' }, 400);
      const now = Date.now(), id = crypto.randomUUID();
      try {
        await db.prepare('INSERT INTO office_suppliers (id,name,contact_name,phone,wechat,channel_type,link,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(id,name,trim(data.contact_name,100),trim(data.phone,80),trim(data.wechat,100),trim(data.channel_type,100),trim(data.link,1000),trim(data.notes,4000),now,now).run();
      } catch { return json({ message: '这个供应商已经存在。' }, 409); }
      return json({ id }, 201);
    }

    if (route === 'customers' && method === 'GET') {
      const q = trim(url.searchParams.get('q'), 120);
      const like = '%' + q.replace(/[%_]/g, '\\$&') + '%';
      const rows = q
        ? await listRows(db.prepare("SELECT * FROM office_customers WHERE name LIKE ? ESCAPE '\\' OR contact_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR wechat LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 100").bind(like,like,like,like))
        : await listRows(db.prepare('SELECT * FROM office_customers ORDER BY updated_at DESC LIMIT 200'));
      return json({ results: rows });
    }

    if (route === 'customers' && method === 'POST') {
      const data = await body(request);
      const name = trim(data.name, 160);
      if (!name) return json({ message: '客户名称不能为空。' }, 400);
      const now = Date.now(), id = crypto.randomUUID();
      try {
        await db.prepare('INSERT INTO office_customers (id,name,contact_name,phone,wechat,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
          .bind(id,name,trim(data.contact_name,100),trim(data.phone,80),trim(data.wechat,100),trim(data.notes,4000),now,now).run();
      } catch { return json({ message: '这个客户已经存在。' }, 409); }
      return json({ id }, 201);
    }

    if (route === 'supplier-quotes' && method === 'POST') {
      const data = await body(request);
      const materialId = trim(data.material_id, 80), supplierId = trim(data.supplier_id, 80);
      const unitPrice = number(data.unit_price), quantity = number(data.quantity) ?? 1;
      if (!materialId || !supplierId || unitPrice === null || unitPrice < 0 || quantity <= 0) return json({ message: '请检查物料、供应商、数量和价格。' }, 400);
      const now = Date.now();
      await db.prepare('INSERT INTO office_supplier_quotes (id,material_id,supplier_id,quantity,unit_price,currency,tax_included,shipping_included,lead_time,quoted_at,valid_until,source,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),materialId,supplierId,quantity,unitPrice,trim(data.currency,12)||'CNY',bool(data.tax_included)?1:0,bool(data.shipping_included)?1:0,trim(data.lead_time,120),dateMs(data.quoted_at),trim(data.valid_until,32)?dateMs(data.valid_until):null,trim(data.source,120),trim(data.notes,4000),now).run();
      await db.prepare('UPDATE office_materials SET updated_at=? WHERE id=?').bind(now,materialId).run();
      return json({ ok: true }, 201);
    }

    if (route === 'purchases' && method === 'POST') {
      const data = await body(request);
      const materialId = trim(data.material_id, 80), supplierId = trim(data.supplier_id, 80);
      const unitPrice = number(data.unit_price), quantity = number(data.quantity) ?? 1;
      if (!materialId || !supplierId || unitPrice === null || unitPrice < 0 || quantity <= 0) return json({ message: '请检查物料、供应商、数量和采购价。' }, 400);
      const now = Date.now();
      await db.prepare('INSERT INTO office_purchases (id,material_id,supplier_id,customer_id,quantity,unit_price,currency,tax_included,shipping_included,purchased_at,order_ref,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),materialId,supplierId,trim(data.customer_id,80)||null,quantity,unitPrice,trim(data.currency,12)||'CNY',bool(data.tax_included)?1:0,bool(data.shipping_included)?1:0,dateMs(data.purchased_at),trim(data.order_ref,160),trim(data.notes,4000),now).run();
      await db.prepare('UPDATE office_materials SET updated_at=? WHERE id=?').bind(now,materialId).run();
      return json({ ok: true }, 201);
    }

    if (route === 'sales' && method === 'POST') {
      const data = await body(request);
      const materialId = trim(data.material_id, 80);
      const unitPrice = number(data.unit_price), quantity = number(data.quantity) ?? 1;
      if (!materialId || unitPrice === null || unitPrice < 0 || quantity <= 0) return json({ message: '请检查物料、数量和销售价。' }, 400);
      const cost = number(data.cost_unit_price);
      const status = ['quoted','won','lost'].includes(trim(data.status,20)) ? trim(data.status,20) : 'quoted';
      const now = Date.now();
      await db.prepare('INSERT INTO office_sales (id,material_id,customer_id,quantity,unit_price,cost_unit_price,currency,tax_included,shipping_included,status,quoted_at,ordered_at,order_ref,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID(),materialId,trim(data.customer_id,80)||null,quantity,unitPrice,cost,trim(data.currency,12)||'CNY',bool(data.tax_included)?1:0,bool(data.shipping_included)?1:0,status,dateMs(data.quoted_at),status==='won'?dateMs(data.ordered_at || data.quoted_at):null,trim(data.order_ref,160),trim(data.notes,4000),now).run();
      await db.prepare('UPDATE office_materials SET updated_at=? WHERE id=?').bind(now,materialId).run();
      return json({ ok: true }, 201);
    }

    return json({ message: '接口不存在。' }, 404);
  } catch (error) {
    console.error('office api error', error);
    return json({ message: '数据处理失败，请稍后重试。' }, 500);
  }
}
