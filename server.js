import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
const { Pool } = pg;
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ENV
const DATABASE_URL = process.env.DATABASE_URL; // must exist in Render Env Vars

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // important for hosted Postgres
});
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 10000
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
// ==============================
// STEP A — DATABASE SETUP
// ==============================
async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      phone TEXT,
      raw JSONB
    );
  `;
  await pool.query(sql);
  console.log("Database ready: leads table exists");
}

async function initDb() {
  // 1) Leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      first_name TEXT,
      last_name  TEXT,
      email      TEXT,
      phone      TEXT,
      service    TEXT,
      details    TEXT,
      zip        TEXT,
      status     TEXT DEFAULT 'new',
      assigned_provider_id INT,
      raw JSONB
    );
  `);

  // 2) Providers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE
    );
  `);

  // 3) Add columns safely (if you previously created a smaller leads table)
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_provider_id INT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS details TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT;`);

  console.log("✅ DB ready: leads/providers tables ready");
}

// Health check
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// Lead endpoint
app.post("/lead/new", async (req, res) => {
  try {
    console.log("📥 Lead received:", req.body);

    const phone =
      req.body.phone ||
      req.body.Phone ||
      req.body?.fields?.Phone ||
      "UNKNOWN";

    const message = `🚨 New Lead Received\nPhone: ${phone}`;

    await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: "+14108166818", // YOUR test number
      body: message
    });

    console.log("✅ SMS sent");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
// ============================
// ADMIN API ENDPOINTS
// ============================

// Get providers
app.get("/admin/api/providers", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, name, phone, active FROM providers ORDER BY active DESC, name ASC"
    );
    res.json({ ok: true, providers: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Add provider
app.post("/admin/api/providers", requireAdmin, async (req, res) => {
  try {
    const { name, phone, active = true } = req.body;
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name and phone required" });

    const r = await pool.query(
      "INSERT INTO providers (name, phone, active) VALUES ($1,$2,$3) RETURNING *",
      [name, phone, active]
    );
    res.json({ ok: true, provider: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get leads
app.get("/admin/api/leads", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT l.id, l.created_at, l.phone, l.email, l.service, l.zip, l.status,
             l.assigned_provider_id
      FROM leads l
      ORDER BY l.created_at DESC
      LIMIT 300
    `);
    res.json({ ok: true, leads: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Update lead status
app.post("/admin/api/leads/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const allowed = ["new", "sent", "closed", "spam"];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: "bad status" });

    await pool.query("UPDATE leads SET status=$1 WHERE id=$2", [status, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Assign provider
app.post("/admin/api/leads/:id/assign", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { providerId } = req.body; // number or null

    await pool.query("UPDATE leads SET assigned_provider_id=$1 WHERE id=$2", [
      providerId || null,
      id
    ]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Send SMS (admin)
app.post("/admin/api/sms", requireAdmin, async (req, res) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) return res.status(400).json({ ok: false, error: "to and body required" });

    await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to,
      body
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
