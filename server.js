// server.js (ESM / Render-ready)
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

// ---- ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- App
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// ---- ENV (Render Env Vars)
const {
  DATABASE_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER, // your Twilio number like +1XXXXXXXXXX
  ADMIN_TOKEN, // set this in Render env
  PORT = 10000,
} = process.env;

if (!DATABASE_URL) console.warn("⚠️ Missing DATABASE_URL in env");
if (!ADMIN_TOKEN) console.warn("⚠️ Missing ADMIN_TOKEN in env");

// ---- Postgres pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- Twilio client (optional if you only want DB first)
const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// -----------------------------
// STEP A — DATABASE SETUP
// -----------------------------
async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT,
      phone TEXT,
      service TEXT,
      zip TEXT,
      notes TEXT,
      status TEXT DEFAULT 'new',
      assigned_provider_id INTEGER,
      raw JSONB
    );

    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT,
      phone TEXT,
      service TEXT,
      zip TEXT,
      active BOOLEAN DEFAULT TRUE
    );
  `;
  await pool.query(sql);
  console.log("✅ Database ready: leads + providers tables exist");
}
initDb().catch((err) => console.error("❌ Database init failed:", err));

// -----------------------------
// Serve dashboard files
// -----------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// -----------------------------
// Helpers
// -----------------------------
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, error: "ADMIN_TOKEN not set on server" });
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

async function sendSms(to, body) {
  if (!twilioClient) throw new Error("Twilio not configured (missing SID/TOKEN)");
  if (!TWILIO_FROM_NUMBER) throw new Error("Missing TWILIO_FROM_NUMBER");
  return twilioClient.messages.create({ from: TWILIO_FROM_NUMBER, to, body });
}

// -----------------------------
// Health check
// -----------------------------
app.get("/", (req, res) => res.send("Citywide routing server running ✅"));

// -----------------------------
// PUBLIC: Create a new lead (from Wix form)
// POST /lead/new
// Body: { name, phone, service, zip, notes, raw }
// -----------------------------
app.post("/lead/new", async (req, res) => {
  try {
    const { name, phone, service, zip, notes, raw } = req.body || {};
    const cleanedPhone = phone || raw?.phone || raw?.Phone || raw?.fields?.Phone || "UNKNOWN";

    const insert = await pool.query(
      `INSERT INTO leads (name, phone, service, zip, notes, raw)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, created_at`,
      [
        name || raw?.name || raw?.Name || null,
        cleanedPhone,
        service || raw?.service || raw?.Service || null,
        zip || raw?.zip || raw?.Zip || null,
        notes || raw?.notes || raw?.Notes || null,
        raw || req.body || null,
      ]
    );

    // Optional: ping your own phone when a lead comes in
    // (edit the number below or remove)
    // await sendSms("+14108166818", `🧲 New Lead: ${cleanedPhone}`);

    res.json({ ok: true, leadId: insert.rows[0].id, created_at: insert.rows[0].created_at });
  } catch (err) {
    console.error("❌ /lead/new error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: status
// GET /admin/status
// -----------------------------
app.get("/admin/status", requireAdmin, async (req, res) => {
  try {
    const leadsCount = await pool.query(`SELECT COUNT(*)::int AS count FROM leads`);
    const providersCount = await pool.query(`SELECT COUNT(*)::int AS count FROM providers`);
    res.json({
      ok: true,
      server: "online",
      leads: leadsCount.rows[0].count,
      providers: providersCount.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: list leads (THIS IS THE ONE YOU ASKED FOR)
// GET /admin/leads?limit=50
// -----------------------------
app.get("/admin/leads", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const rows = await pool.query(
      `SELECT id, created_at, name, phone, service, zip, notes, status, assigned_provider_id
       FROM leads
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ ok: true, leads: rows.rows });
  } catch (err) {
    console.error("❌ /admin/leads error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: create provider
// POST /admin/providers
// Body: { name, phone, service, zip, active }
// -----------------------------
app.post("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const { name, phone, service, zip, active } = req.body || {};
    const result = await pool.query(
      `INSERT INTO providers (name, phone, service, zip, active)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, created_at, name, phone, service, zip, active`,
      [name || null, phone || null, service || null, zip || null, active !== false]
    );
    res.json({ ok: true, provider: result.rows[0] });
  } catch (err) {
    console.error("❌ /admin/providers POST error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: list providers
// GET /admin/providers
// -----------------------------
app.get("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, created_at, name, phone, service, zip, active
       FROM providers
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, providers: result.rows });
  } catch (err) {
    console.error("❌ /admin/providers GET error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: assign lead to provider
// POST /admin/assign
// Body: { leadId, providerId }
// -----------------------------
app.post("/admin/assign", requireAdmin, async (req, res) => {
  try {
    const { leadId, providerId } = req.body || {};
    if (!leadId || !providerId) return res.status(400).json({ ok: false, error: "leadId + providerId required" });

    await pool.query(
      `UPDATE leads
       SET assigned_provider_id = $1, status = 'assigned'
       WHERE id = $2`,
      [providerId, leadId]
    );

    const lead = await pool.query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
    const provider = await pool.query(`SELECT * FROM providers WHERE id = $1`, [providerId]);

    // Optional: text provider
    if (provider.rows[0]?.phone && twilioClient) {
      const msg = `📲 New Lead Assigned\nLead #${leadId}\nPhone: ${lead.rows[0]?.phone || "N/A"}\nService: ${lead.rows[0]?.service || "N/A"}\nZip: ${lead.rows[0]?.zip || "N/A"}`;
      await sendSms(provider.rows[0].phone, msg);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ /admin/assign error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// ADMIN: send SMS (manual)
// POST /admin/sms
// Body: { to, body }
// -----------------------------
app.post("/admin/sms", requireAdmin, async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ ok: false, error: "to + body required" });
    const sent = await sendSms(to, body);
    res.json({ ok: true, sid: sent.sid });
  } catch (err) {
    console.error("❌ /admin/sms error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
