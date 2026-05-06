/**
 * ZENTO Backend — Node.js + Express + PostgreSQL (PlanetScale)
 * Host: ap-southeast-2.pg.psdb.cloud
 * Currency: MVR (Maldivian Rufiyaa)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'zento-secret-2026-maldives';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── DATABASE CONNECTION ───
const pool = new Pool({
  host:     process.env.DB_HOST     || 'ap-southeast-2.pg.psdb.cloud',
  port:     Number(process.env.DB_PORT)     || 6432,
  user:     process.env.DB_USERNAME || 'pscale_api_4d8067ohrisr.m2n45ghhdvik',
  password: process.env.DB_PASSWORD || 'pscale_pw_NVPiBB4hyVD8u86iTuud4Nilmr3B5wEm',
  database: process.env.DB_DATABASE || 'postgres',
  ssl: { rejectUnauthorized: false }
});

// ─── CREATE TABLES ───
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(20),
        avatar VARCHAR(10),
        active BOOLEAN DEFAULT true,
        created_at VARCHAR(30)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100),
        phone VARCHAR(30),
        role VARCHAR(50),
        basic_salary DECIMAL(10,2),
        join_date VARCHAR(20),
        status VARCHAR(10),
        avatar VARCHAR(10),
        email VARCHAR(100),
        address VARCHAR(200)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100),
        color VARCHAR(20),
        icon VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at VARCHAR(50)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100),
        color VARCHAR(20),
        icon VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at VARCHAR(50)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(36) PRIMARY KEY,
        date VARCHAR(20),
        category_id VARCHAR(36),
        amount DECIMAL(10,2),
        description TEXT,
        invoice_data TEXT,
        invoice_name VARCHAR(200),
        invoice_type VARCHAR(100),
        created_by VARCHAR(36),
        created_at VARCHAR(50)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(36) PRIMARY KEY,
        date VARCHAR(20),
        category_id VARCHAR(36),
        amount DECIMAL(10,2),
        shop_name VARCHAR(200),
        payment_method VARCHAR(50),
        description TEXT,
        recorded_by VARCHAR(36),
        created_at VARCHAR(50)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS salaries (
        id VARCHAR(36) PRIMARY KEY,
        staff_id VARCHAR(36),
        month VARCHAR(10),
        basic_salary DECIMAL(10,2),
        bonus DECIMAL(10,2) DEFAULT 0,
        deduction DECIMAL(10,2) DEFAULT 0,
        net_salary DECIMAL(10,2),
        payment_date VARCHAR(20),
        status VARCHAR(10),
        notes TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        action VARCHAR(20),
        module VARCHAR(50),
        description TEXT,
        created_at VARCHAR(50)
      )
    `);

    // ─── SEED DEFAULT DATA ───
    const { rows } = await client.query('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(rows[0].cnt) === 0) {
      console.log('🌱 Seeding default data...');

      const defaultUsers = [
        { id:'u1', name:'Ahmed Admin',      email:'admin@zento.mv',    pass:'admin123',    role:'admin',      av:'AA' },
        { id:'u2', name:'Hassan Manager',   email:'manager@zento.mv',  pass:'manager123',  role:'manager',    av:'HM' },
        { id:'u3', name:'Fathima Accounts', email:'accounts@zento.mv', pass:'accounts123', role:'accountant', av:'FA' },
      ];
      for (const u of defaultUsers) {
        await client.query(
          'INSERT INTO users VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [u.id, u.name, u.email, bcrypt.hashSync(u.pass,10), u.role, u.av, true, new Date().toISOString().split('T')[0]]
        );
      }

      const defaultStaff = [
        { id:'s1', name:'Fathima Mohamed', phone:'+960 777-1234', role:'Accountant', sal:8500,  join:'2023-01-15', st:'active',   av:'FM', email:'fathima@zento.mv', addr:'Malé' },
        { id:'s2', name:'Hassan Ali',      phone:'+960 777-5678', role:'Manager',    sal:11000, join:'2022-03-10', st:'active',   av:'HA', email:'hassan@zento.mv',  addr:'Malé' },
        { id:'s3', name:'Ali Rasheed',     phone:'+960 777-9012', role:'Sales',      sal:7500,  join:'2025-05-01', st:'active',   av:'AR', email:'ali@zento.mv',     addr:'Hulhumalé' },
        { id:'s4', name:'Aminath Sara',    phone:'+960 777-3456', role:'Staff',      sal:6000,  join:'2023-06-20', st:'inactive', av:'AS', email:'aminath@zento.mv', addr:'Addu City' },
      ];
      for (const s of defaultStaff) {
        await client.query(
          'INSERT INTO staff VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [s.id, s.name, s.phone, s.role, s.sal, s.join, s.st, s.av, s.email, s.addr]
        );
      }

      const eCats = [
        ['ec1','Rent','#38b2f8'],['ec2','Supplies','#ffb347'],['ec3','Transport','#22d3a0'],
        ['ec4','Utilities','#ff5f7e'],['ec5','Marketing','#b97dff'],['ec6','Maintenance','#f97316'],
      ];
      for (const c of eCats) {
        await client.query('INSERT INTO expense_categories VALUES ($1,$2,$3,$4,$5,$6)',
          [c[0], c[1], c[2], 'ti-tag', true, new Date().toISOString()]);
      }

      const sCats = [
        ['sc1','Product Sales','#38b2f8'],['sc2','Services','#22d3a0'],
        ['sc3','Consulting','#b97dff'],['sc4','Delivery','#ffb347'],
      ];
      for (const c of sCats) {
        await client.query('INSERT INTO sale_categories VALUES ($1,$2,$3,$4,$5,$6)',
          [c[0], c[1], c[2], 'ti-tag', true, new Date().toISOString()]);
      }

      console.log('✅ Default data seeded!');
    }
    console.log('✅ Database tables ready!');
  } finally {
    client.release();
  }
}

// ─── PERMISSIONS ───
const PERMISSIONS = {
  admin:      { dashboard:true, sales:true, expenses:true, staff:true, salary:true, reports:true, access:true, categories:true, delete:true },
  manager:    { dashboard:true, sales:true, expenses:true, staff:true, salary:false, reports:true, access:false, categories:false, delete:false },
  accountant: { dashboard:true, sales:false, expenses:true, staff:false, salary:true, reports:true, access:false, categories:false, delete:false },
  staff:      { dashboard:true, sales:true, expenses:false, staff:false, salary:false, reports:false, access:false, categories:false, delete:false },
};

// ─── MIDDLEWARE ───
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function requirePerm(module) {
  return (req, res, next) => {
    if (!PERMISSIONS[req.user.role]?.[module])
      return res.status(403).json({ error: 'Access denied' });
    next();
  };
}

async function logActivity(userId, action, module, description) {
  try {
    await pool.query('INSERT INTO activity_logs VALUES ($1,$2,$3,$4,$5,$6)',
      [uuidv4(), userId, action, module, description, new Date().toISOString()]);
  } catch {}
}

// ─── AUTH ───
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.active) return res.status(403).json({ error: 'Account disabled' });
    const token = jwt.sign(
      { id:user.id, name:user.name, email:user.email, role:user.role, avatar:user.avatar },
      JWT_SECRET, { expiresIn:'8h' }
    );
    await logActivity(user.id, 'LOGIN', 'auth', `${user.name} logged in`);
    res.json({ token, user: { id:user.id, name:user.name, email:user.email, role:user.role, avatar:user.avatar, permissions:PERMISSIONS[user.role] } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ...req.user, permissions: PERMISSIONS[req.user.role] });
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await logActivity(req.user.id, 'LOGOUT', 'auth', `${req.user.name} logged out`);
  res.json({ message: 'Logged out' });
});

// ─── DASHBOARD ───
app.get('/api/dashboard', authMiddleware, requirePerm('dashboard'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows:[ts] } = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM sales WHERE date=$1', [today]);
    const { rows:[te] } = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date=$1', [today]);
    const { rows:[sc] } = await pool.query("SELECT COUNT(*) as cnt FROM staff WHERE status='active'");
    const { rows:[ps] } = await pool.query("SELECT COUNT(*) as cnt FROM salaries WHERE status='pending'");

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday:'short' });
      const { rows:[s] } = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM sales WHERE date=$1', [ds]);
      const { rows:[e] } = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date=$1', [ds]);
      last7.push({ label, date:ds, sales:Number(s.total), expenses:Number(e.total) });
    }

    const { rows: expByCat } = await pool.query(`
      SELECT ec.name, ec.color, COALESCE(SUM(e.amount),0) as amount
      FROM expense_categories ec LEFT JOIN expenses e ON e.category_id=ec.id
      GROUP BY ec.id, ec.name, ec.color HAVING COALESCE(SUM(e.amount),0) > 0
    `);

    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-US', { month:'short' });
      const { rows:[s] } = await pool.query("SELECT COALESCE(SUM(amount),0) as total FROM sales WHERE date LIKE $1", [ym+'%']);
      const { rows:[e] } = await pool.query("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date LIKE $1", [ym+'%']);
      monthlyTrend.push({ label, month:ym, sales:Number(s.total), expenses:Number(e.total) });
    }

    const { rows: activity } = await pool.query(`
      SELECT a.*, u.name as user_name, u.avatar as user_avatar
      FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id
      ORDER BY a.created_at DESC LIMIT 8
    `);

    res.json({
      stats: { today_sales:Number(ts.total), today_expenses:Number(te.total), today_profit:Number(ts.total)-Number(te.total), total_staff:parseInt(sc.cnt), pending_salaries:parseInt(ps.cnt) },
      charts: { last7, expByCategory:expByCat, monthlyTrend },
      recent_activity: activity
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── EXPENSE CATEGORIES ───
app.get('/api/categories/expenses', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM expense_categories ORDER BY name');
  res.json(rows);
});
app.post('/api/categories/expenses', authMiddleware, requirePerm('categories'), async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  await pool.query('INSERT INTO expense_categories VALUES ($1,$2,$3,$4,$5,$6)', [id, name, color||'#00c9a7', 'ti-tag', true, new Date().toISOString()]);
  await logActivity(req.user.id, 'CREATE', 'categories', `Added: ${name}`);
  res.status(201).json({ id, name, color: color||'#00c9a7' });
});
app.put('/api/categories/expenses/:id', authMiddleware, requirePerm('categories'), async (req, res) => {
  const { name, color } = req.body;
  await pool.query('UPDATE expense_categories SET name=$1, color=$2 WHERE id=$3', [name, color, req.params.id]);
  res.json({ id:req.params.id, name, color });
});
app.delete('/api/categories/expenses/:id', authMiddleware, requirePerm('categories'), async (req, res) => {
  await pool.query('DELETE FROM expense_categories WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ─── SALE CATEGORIES ───
app.get('/api/categories/sales', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM sale_categories ORDER BY name');
  res.json(rows);
});
app.post('/api/categories/sales', authMiddleware, requirePerm('categories'), async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  await pool.query('INSERT INTO sale_categories VALUES ($1,$2,$3,$4,$5,$6)', [id, name, color||'#00c9a7', 'ti-tag', true, new Date().toISOString()]);
  res.status(201).json({ id, name, color: color||'#00c9a7' });
});
app.put('/api/categories/sales/:id', authMiddleware, requirePerm('categories'), async (req, res) => {
  const { name, color } = req.body;
  await pool.query('UPDATE sale_categories SET name=$1, color=$2 WHERE id=$3', [name, color, req.params.id]);
  res.json({ id:req.params.id, name, color });
});
app.delete('/api/categories/sales/:id', authMiddleware, requirePerm('categories'), async (req, res) => {
  await pool.query('DELETE FROM sale_categories WHERE id=$1', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ─── EXPENSES ───
app.get('/api/expenses', authMiddleware, requirePerm('expenses'), async (req, res) => {
  try {
    const { month, from, to } = req.query;
    let where = '1=1'; const params = [];
    if (month) { where += ` AND e.date LIKE $${params.length+1}`; params.push(month+'%'); }
    if (from)  { where += ` AND e.date >= $${params.length+1}`; params.push(from); }
    if (to)    { where += ` AND e.date <= $${params.length+1}`; params.push(to); }
    const { rows } = await pool.query(`
      SELECT e.*, ec.name as category, ec.color as category_color, u.name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id=e.category_id
      LEFT JOIN users u ON u.id=e.created_by
      WHERE ${where} ORDER BY e.date DESC
    `, params);
    const total = rows.reduce((s,r)=>s+Number(r.amount),0);
    res.json({ expenses:rows, total, count:rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/expenses', authMiddleware, requirePerm('expenses'), async (req, res) => {
  try {
    const { date, category_id, amount, description, invoice_data, invoice_name, invoice_type } = req.body;
    if (!date||!category_id||!amount) return res.status(400).json({ error: 'date, category_id, amount required' });
    const id = uuidv4();
    await pool.query('INSERT INTO expenses VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, date, category_id, Number(amount), description||'', invoice_data||null, invoice_name||null, invoice_type||null, req.user.id, new Date().toISOString()]);
    const { rows:[cat] } = await pool.query('SELECT name FROM expense_categories WHERE id=$1', [category_id]);
    await logActivity(req.user.id, 'CREATE', 'expenses', `Added expense MVR ${amount} — ${cat?.name||''}`);
    res.status(201).json({ id, message:'Created' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/expenses/:id', authMiddleware, requirePerm('expenses'), async (req, res) => {
  try {
    const { date, category_id, amount, description, invoice_data, invoice_name, invoice_type } = req.body;
    await pool.query(`UPDATE expenses SET date=$1, category_id=$2, amount=$3, description=$4,
      invoice_data=COALESCE($5,invoice_data), invoice_name=COALESCE($6,invoice_name), invoice_type=COALESCE($7,invoice_type) WHERE id=$8`,
      [date, category_id, Number(amount), description||'', invoice_data||null, invoice_name||null, invoice_type||null, req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/expenses/:id', authMiddleware, requirePerm('delete'), async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
  res.json({ message:'Deleted' });
});

// ─── SALES ───
app.get('/api/sales', authMiddleware, requirePerm('sales'), async (req, res) => {
  try {
    const { month, from, to } = req.query;
    let where = '1=1'; const params = [];
    if (month) { where += ` AND s.date LIKE $${params.length+1}`; params.push(month+'%'); }
    if (from)  { where += ` AND s.date >= $${params.length+1}`; params.push(from); }
    if (to)    { where += ` AND s.date <= $${params.length+1}`; params.push(to); }
    const { rows } = await pool.query(`
      SELECT s.*, sc.name as category, sc.color as category_color, u.name as recorded_by_name
      FROM sales s
      LEFT JOIN sale_categories sc ON sc.id=s.category_id
      LEFT JOIN users u ON u.id=s.recorded_by
      WHERE ${where} ORDER BY s.date DESC
    `, params);
    const total = rows.reduce((s,r)=>s+Number(r.amount),0);
    res.json({ sales:rows, total, count:rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sales', authMiddleware, requirePerm('sales'), async (req, res) => {
  try {
    const { date, category_id, amount, shop_name, payment_method, description } = req.body;
    if (!date||!category_id||!amount) return res.status(400).json({ error: 'Required fields missing' });
    const id = uuidv4();
    await pool.query('INSERT INTO sales VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, date, category_id, Number(amount), shop_name||'', payment_method||'Cash', description||'', req.user.id, new Date().toISOString()]);
    await logActivity(req.user.id, 'CREATE', 'sales', `Recorded sale MVR ${amount} — ${shop_name||''}`);
    res.status(201).json({ id, message:'Created' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sales/:id', authMiddleware, requirePerm('sales'), async (req, res) => {
  try {
    const { date, category_id, amount, shop_name, payment_method, description } = req.body;
    await pool.query('UPDATE sales SET date=$1, category_id=$2, amount=$3, shop_name=$4, payment_method=$5, description=$6 WHERE id=$7',
      [date, category_id, Number(amount), shop_name||'', payment_method||'Cash', description||'', req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sales/:id', authMiddleware, requirePerm('delete'), async (req, res) => {
  await pool.query('DELETE FROM sales WHERE id=$1', [req.params.id]);
  res.json({ message:'Deleted' });
});

// ─── STAFF ───
app.get('/api/staff', authMiddleware, requirePerm('staff'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM staff';
    const params = [];
    if (status) { query += ' WHERE status=$1'; params.push(status); }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json({ staff:rows, count:rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', authMiddleware, requirePerm('staff'), async (req, res) => {
  try {
    const { name, phone, role, basic_salary, join_date, email, address, status } = req.body;
    if (!name||!role) return res.status(400).json({ error: 'name and role required' });
    const id = uuidv4();
    const avatar = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    await pool.query('INSERT INTO staff VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, name, phone||'', role, Number(basic_salary)||0, join_date||new Date().toISOString().split('T')[0], status||'active', avatar, email||'', address||'']);
    await logActivity(req.user.id, 'CREATE', 'staff', `Added staff: ${name}`);
    res.status(201).json({ id, message:'Created' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/staff/:id', authMiddleware, requirePerm('staff'), async (req, res) => {
  try {
    const { name, phone, role, basic_salary, join_date, email, address, status } = req.body;
    await pool.query('UPDATE staff SET name=$1, phone=$2, role=$3, basic_salary=$4, join_date=$5, email=$6, address=$7, status=$8 WHERE id=$9',
      [name, phone||'', role, Number(basic_salary)||0, join_date||'', email||'', address||'', status||'active', req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/staff/:id', authMiddleware, requirePerm('delete'), async (req, res) => {
  await pool.query('DELETE FROM staff WHERE id=$1', [req.params.id]);
  res.json({ message:'Deleted' });
});

// ─── SALARY ───
app.get('/api/salary', authMiddleware, requirePerm('salary'), async (req, res) => {
  try {
    const { month, status } = req.query;
    let where = '1=1'; const params = [];
    if (month)  { where += ` AND s.month=$${params.length+1}`; params.push(month); }
    if (status) { where += ` AND s.status=$${params.length+1}`; params.push(status); }
    const { rows } = await pool.query(`
      SELECT s.*, st.name as staff_name, st.role as staff_role
      FROM salaries s LEFT JOIN staff st ON st.id=s.staff_id
      WHERE ${where} ORDER BY s.month DESC
    `, params);
    const totalPaid    = rows.filter(r=>r.status==='paid').reduce((a,r)=>a+Number(r.net_salary),0);
    const totalPending = rows.filter(r=>r.status==='pending').reduce((a,r)=>a+Number(r.net_salary),0);
    res.json({ salaries:rows, total_paid:totalPaid, total_pending:totalPending, count:rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/salary', authMiddleware, requirePerm('salary'), async (req, res) => {
  try {
    const { staff_id, month, basic_salary, bonus, deduction, status, notes } = req.body;
    if (!staff_id||!month) return res.status(400).json({ error: 'staff_id and month required' });
    const { rows:ex } = await pool.query('SELECT id FROM salaries WHERE staff_id=$1 AND month=$2', [staff_id, month]);
    if (ex.length > 0) return res.status(409).json({ error: 'Record already exists for this month' });
    const id = uuidv4();
    const basic=Number(basic_salary)||0, bon=Number(bonus)||0, ded=Number(deduction)||0;
    const net = basic + bon - ded;
    await pool.query('INSERT INTO salaries VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, staff_id, month, basic, bon, ded, net, null, status||'pending', notes||'']);
    res.status(201).json({ id, net_salary:net });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/salary/:id', authMiddleware, requirePerm('salary'), async (req, res) => {
  try {
    const { basic_salary, bonus, deduction, status, payment_date, notes } = req.body;
    const { rows:[cur] } = await pool.query('SELECT * FROM salaries WHERE id=$1', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const basic=Number(basic_salary??cur.basic_salary), bon=Number(bonus??cur.bonus), ded=Number(deduction??cur.deduction);
    const net = basic + bon - ded;
    const pdate = status==='paid' ? (payment_date||new Date().toISOString().split('T')[0]) : cur.payment_date;
    await pool.query('UPDATE salaries SET basic_salary=$1, bonus=$2, deduction=$3, net_salary=$4, status=$5, payment_date=$6, notes=$7 WHERE id=$8',
      [basic, bon, ded, net, status||cur.status, pdate, notes??cur.notes, req.params.id]);
    res.json({ message:'Updated', net_salary:net });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/salary/:id', authMiddleware, requirePerm('delete'), async (req, res) => {
  await pool.query('DELETE FROM salaries WHERE id=$1', [req.params.id]);
  res.json({ message:'Deleted' });
});

// ─── REPORTS ───
app.get('/api/reports/summary', authMiddleware, requirePerm('reports'), async (req, res) => {
  try {
    const m = req.query.month || new Date().toISOString().slice(0,7);
    const { rows:[sales] }   = await pool.query("SELECT COALESCE(SUM(amount),0) as total FROM sales WHERE date LIKE $1", [m+'%']);
    const { rows:[exp] }     = await pool.query("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date LIKE $1", [m+'%']);
    const { rows:[payroll] } = await pool.query("SELECT COALESCE(SUM(net_salary),0) as total FROM salaries WHERE month=$1 AND status='paid'", [m]);
    const { rows:salesByCat } = await pool.query(`
      SELECT sc.name, sc.color, COALESCE(SUM(s.amount),0) as amount
      FROM sale_categories sc LEFT JOIN sales s ON s.category_id=sc.id AND s.date LIKE $1
      GROUP BY sc.id, sc.name, sc.color HAVING COALESCE(SUM(s.amount),0) > 0`, [m+'%']);
    const { rows:expByCat } = await pool.query(`
      SELECT ec.name, ec.color, COALESCE(SUM(e.amount),0) as amount
      FROM expense_categories ec LEFT JOIN expenses e ON e.category_id=ec.id AND e.date LIKE $1
      GROUP BY ec.id, ec.name, ec.color HAVING COALESCE(SUM(e.amount),0) > 0`, [m+'%']);
    const { rows:methods } = await pool.query(`
      SELECT payment_method as method, COALESCE(SUM(amount),0) as amount
      FROM sales WHERE date LIKE $1 GROUP BY payment_method`, [m+'%']);
    res.json({
      month:m, totalSales:Number(sales.total), totalExpenses:Number(exp.total),
      totalPayroll:Number(payroll.total),
      netProfit:Number(sales.total)-Number(exp.total)-Number(payroll.total),
      salesByCategory:salesByCat, expByCategory:expByCat, salesByMethod:methods
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── USERS ───
app.get('/api/users', authMiddleware, requirePerm('access'), async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,role,avatar,active,created_at FROM users');
  res.json(rows);
});

app.post('/api/users', authMiddleware, requirePerm('access'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name||!email||!password||!role) return res.status(400).json({ error: 'All fields required' });
    const { rows:ex } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (ex.length > 0) return res.status(409).json({ error: 'Email already exists' });
    const id = uuidv4();
    const avatar = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    await pool.query('INSERT INTO users VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, name, email, bcrypt.hashSync(password,10), role, avatar, true, new Date().toISOString().split('T')[0]]);
    res.status(201).json({ id, name, email, role, avatar, active:true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', authMiddleware, requirePerm('access'), async (req, res) => {
  try {
    const { name, role, active, password } = req.body;
    if (password) {
      await pool.query('UPDATE users SET name=$1, role=$2, active=$3, password=$4 WHERE id=$5',
        [name, role, active, bcrypt.hashSync(password,10), req.params.id]);
    } else {
      await pool.query('UPDATE users SET name=$1, role=$2, active=$3 WHERE id=$4',
        [name, role, active, req.params.id]);
    }
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity', authMiddleware, requirePerm('reports'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*, u.name as user_name, u.avatar as user_avatar
    FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id
    ORDER BY a.created_at DESC LIMIT 50
  `);
  res.json(rows);
});

app.get('/api/health', (req, res) => res.json({ status:'ok', db:'PlanetScale PostgreSQL', time:new Date().toISOString() }));

// ─── START ───
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 ZENTO API running on http://localhost:${PORT}`);
    console.log(`🗄️  PlanetScale PostgreSQL: ap-southeast-2.pg.psdb.cloud`);
    console.log(`📊 Currency: MVR (Maldivian Rufiyaa)`);
    console.log(`\n🔑 Login credentials:`);
    console.log(`   Admin:      admin@zento.mv    / admin123`);
    console.log(`   Manager:    manager@zento.mv  / manager123`);
    console.log(`   Accountant: accounts@zento.mv / accounts123\n`);
  });
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});