import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
const { Pool } = pg;

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- ENV ----------
const PORT = process.env.PORT || 10000;

// IMPORTANT: set this in Render env vars
// ADMIN_TOKEN = something-secret
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Your Render Postgres connection string
// DATABASE_URL = postgres://user:pass@host:5432/db
const DATABASE_URL = process.env.DATABASE_URL || process.env.DataBase_URL || "";

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || process.env.TWILIO_FROM_NUMBER || "";
const OWNER_NUMBER = process.env.OWNER_NUMBER || ""; // where YOU want lead alerts texted

if (!DATABASE_URL) console.warn("⚠️ Missing DATABASE_URL in env vars");
if (!ADMIN_TOKEN) console.warn("⚠️ Missing ADMIN_TOKEN in env vars");
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) console.warn("⚠️ Missing Twilio SID/TOKEN");
if (!TWILIO_NUMBER) console.warn("⚠️ Missing TWILIO_NUMBER");
if (!OWNER_NUMBER) console.warn("⚠️ Missing OWNER_NUMBER");

// ---------- DB ----------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for many hosted Postgres providers
});

// ---------- Twilio Client ----------
const smsClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// ---------- Admin Auth ----------
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token || "";
  if (!ADMIN_TOKEN) return res.status(500).json({ error: "ADMIN_TOKEN not set on server" });
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ---------- STEP A: DB INIT (creates tables) ----------
async function initDb() {
  // leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      phone TEXT,
      name TEXT,
      service TEXT,
      zipcode TEXT,
      status TEXT DEFAULT 'pending',
      assigned_provider_id INTEGER,
      raw JSONB
    );
  `);

  // providers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT,
      zipcode TEXT,
      active BOOLEAN DEFAULT true,
      notes TEXT
    );
  `);

  console.log("✅ Database ready: leads + providers tables exist");
}

initDb().catch((err) => console.error("❌ Database init failed:", err));

// ---------- Static dashboard files ----------
app.use(express.static("public"));

// Dashboard route (serves /public/dashboard.html)
app.get("/dashboard", (req, res) => {
  res.sendFile(process.cwd() + "/public/dashboard.html");
});

// ---------- Health check ----------
app.get("/", (req, res) => {
  res.send("✅ Nationwide Leads routing server running");
});

// =====================================================
// LEAD INTAKE
// =====================================================

// Create a new lead
// POST /lead/new
// body can be anything; we try to pick out common fields
app.post("/lead/new", async (req, res) => {
  try {
    const raw = req.body || {};

    const phone =
      raw.phone ||
      raw.Phone ||
      raw.customerPhone ||
      raw?.fields?.phone ||
      raw?.fields?.Phone ||
      "UNKNOWN";

    const name =
      raw.name ||
      raw.Name ||
      raw.customerName ||
      raw?.fields?.name ||
      raw?.fields?.Name ||
      "";

    const service =
      raw.service ||
      raw.Service ||
      raw.jobType ||
      raw?.fields?.service ||
      raw?.fields?.Service ||
      "";

    const zipcode =
      raw.zip ||
      raw.zipcode ||
      raw.Zip ||
      raw?.fields?.zip ||
      raw?.fields?.zipcode ||
      "";

    const insert = await pool.query(
      `INSERT INTO leads (phone, name, service, zipcode, raw)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [phone, name, service, zipcode, raw]
    );

    const lead = insert.rows[0];

    // Text YOU (owner) that a lead came in
    if (smsClient && TWILIO_NUMBER && OWNER_NUMBER) {
      const msg =
        `📥 New Lead Received\n` +
        `ID: ${lead.id}\n` +
        `Name: ${lead.name || "-"}\n` +
        `Phone: ${lead.phone}\n` +
        `Service: ${lead.service || "-"}\n` +
        `Zip: ${lead.zipcode || "-"}\n` +
        `Status: ${lead.status}`;

      await smsClient.messages.create({
        from: TWILIO_NUMBER,
        to: OWNER_NUMBER,
        body: msg,
      });
    }

    res.json({ ok: true, lead });
  } catch (err) {
    console.error("❌ /lead/new error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// =====================================================
// ADMIN API (Angi-style dashboard data)
// =====================================================

// GET /admin/status
app.get("/admin/status", requireAdmin, async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending,
        SUM(CASE WHEN status='assigned' THEN 1 ELSE 0 END)::int AS assigned,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END)::int AS cancelled
      FROM leads;
    `);

    res.json({ ok: true, ...counts.rows[0] });
  } catch (err) {
    console.error("❌ /admin/status error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ IMPORTANT: this is what your dashboard.html fetches
// GET /admin/leads
app.get("/admin/leads", requireAdmin, async (req, res) => {
  try {
    const { status, limit = 200 } = req.query;

    let q = `SELECT * FROM leads`;
    const vals = [];

    if (status) {
      vals.push(status);
      q += ` WHERE status = $${vals.length}`;
    }

    vals.push(Math.min(parseInt(limit, 10) || 200, 1000));
    q += ` ORDER BY id DESC LIMIT $${vals.length}`;

    const out = await pool.query(q, vals);
    res.json(out.rows);
  } catch (err) {
    console.error("❌ /admin/leads error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /admin/providers
app.get("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const out = await pool.query(`SELECT * FROM providers ORDER BY id DESC LIMIT 500`);
    res.json(out.rows);
  } catch (err) {
    console.error("❌ /admin/providers error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /admin/providers  (add provider)
// body: { name, phone, service, zipcode, active, notes }
app.post("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const { name, phone, service = "", zipcode = "", active = true, notes = "" } = req.body || {};
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name and phone required" });

    const out = await pool.query(
      `INSERT INTO providers (name, phone, service, zipcode, active, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, phone, service, zipcode, !!active, notes]
    );

    res.json({ ok: true, provider: out.rows[0] });
  } catch (err) {
    console.error("❌ /admin/providers POST error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /admin/assign
// body: { lead_id, provider_id }
app.post("/admin/assign", requireAdmin, async (req, res) => {
  try {
    const { lead_id, provider_id } = req.body || {};
    if (!lead_id || !provider_id)
      return res.status(400).json({ ok: false, error: "lead_id and provider_id required" });

    const leadOut = await pool.query(`SELECT * FROM leads WHERE id=$1`, [lead_id]);
    const provOut = await pool.query(`SELECT * FROM providers WHERE id=$1`, [provider_id]);

    if (!leadOut.rows[0]) return res.status(404).json({ ok: false, error: "Lead not found" });
    if (!provOut.rows[0]) return res.status(404).json({ ok: false, error: "Provider not found" });

    const lead = leadOut.rows[0];
    const provider = provOut.rows[0];

    await pool.query(
      `UPDATE leads
       SET status='assigned', assigned_provider_id=$1
       WHERE id=$2`,
      [provider_id, lead_id]
    );

    // notify provider by SMS (optional)
    if (smsClient && TWILIO_NUMBER && provider.phone) {
      const msg =
        `✅ New Lead Assigned\n` +
        `Lead ID: ${lead.id}\n` +
        `Name: ${lead.name || "-"}\n` +
        `Phone: ${lead.phone}\n` +
        `Service: ${lead.service || "-"}\n` +
        `Zip: ${lead.zipcode || "-"}\n`;

      await smsClient.messages.create({
        from: TWILIO_NUMBER,
        to: provider.phone,
        body: msg,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ /admin/assign error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /admin/sms
// body: { to, body }
app.post("/admin/sms", requireAdmin, async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ ok: false, error: "to and body required" });
    if (!smsClient) return res.status(500).json({ ok: false, error: "Twilio not configured" });

    const msg = await smsClient.messages.create({
      from: TWILIO_NUMBER,
      to,
      body,
    });

    res.json({ ok: true, sid: msg.sid });
  } catch (err) {
    console.error("❌ /admin/sms error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// =====================================================
// Twilio Webhook (optional inbound SMS)
// =====================================================
app.post("/twilio/sms", async (req, res) => {
  // You can expand this later.
  res.type("text/xml").send(`<Response></Response>`);
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
