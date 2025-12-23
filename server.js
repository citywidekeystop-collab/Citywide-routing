// ============================
// Citywide / Nationwide Leads Server
// ============================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ============================
// ENV
// ============================
const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

const client =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// ============================
// DATABASE
// ============================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      service TEXT,
      zip TEXT,
      status TEXT DEFAULT 'new',
      assigned_provider_id INT,
      raw JSONB
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE
    );
  `);

  console.log("✅ DB ready");
}

initDb().catch(err => {
  console.error("DB init failed", err);
});

// ============================
// HEALTH CHECK
// ============================
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// ============================
// ADMIN AUTH
// ============================
function requireAdmin(req, res, next) {
  const key = req.query.key;
  if (!process.env.ADMIN_KEY) {
    return res.status(500).send("Missing ADMIN_KEY");
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

// ============================
// LEAD INTAKE
// ============================
app.post("/lead/new", async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      service,
      zip
    } = req.body || {};

    await pool.query(
      `INSERT INTO leads
       (first_name, last_name, email, phone, service, zip, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        first_name || null,
        last_name || null,
        email || null,
        phone || null,
        service || null,
        zip || null,
        req.body
      ]
    );

    // Optional SMS notify admin
    if (client && phone) {
      await client.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: phone,
        body: "Citywide Leads: We received your request. We’ll contact you shortly."
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Lead intake error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================
// ADMIN API
// ============================

// Providers
app.get("/admin/api/providers", requireAdmin, async (req, res) => {
  const r = await pool.query(
    "SELECT id,name,phone,active FROM providers ORDER BY active DESC,name"
  );
  res.json({ ok: true, providers: r.rows });
});

app.post("/admin/api/providers", requireAdmin, async (req, res) => {
  const { name, phone } = req.body;
  const r = await pool.query(
    "INSERT INTO providers (name,phone) VALUES ($1,$2) RETURNING *",
    [name, phone]
  );
  res.json({ ok: true, provider: r.rows[0] });
});

// Leads
app.get("/admin/api/leads", requireAdmin, async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM leads ORDER BY created_at DESC LIMIT 300"
  );
  res.json({ ok: true, leads: r.rows });
});

app.post("/admin/api/leads/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  await pool.query(
    "UPDATE leads SET status=$1 WHERE id=$2",
    [status, req.params.id]
  );
  res.json({ ok: true });
});

app.post("/admin/api/leads/:id/assign", requireAdmin, async (req, res) => {
  const { providerId } = req.body;
  await pool.query(
    "UPDATE leads SET assigned_provider_id=$1 WHERE id=$2",
    [providerId || null, req.params.id]
  );
  res.json({ ok: true });
});

// SMS
app.post("/admin/api/sms", requireAdmin, async (req, res) => {
  const { to, body } = req.body;
  await client.messages.create({
    from: TWILIO_FROM_NUMBER,
    to,
    body
  });
  res.json({ ok: true });
});

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
