import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// ENV (Render Environment)
// =========================
const {
  DATABASE_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  OWNER_NUMBER,
  ADMIN_TOKEN, // set this in Render (anything strong)
  PORT
} = process.env;

const port = Number(PORT || 10000);

if (!DATABASE_URL) console.warn("⚠️ Missing DATABASE_URL in Render Environment");
if (!TWILIO_ACCOUNT_SID) console.warn("⚠️ Missing TWILIO_ACCOUNT_SID");
if (!TWILIO_AUTH_TOKEN) console.warn("⚠️ Missing TWILIO_AUTH_TOKEN");
if (!TWILIO_FROM_NUMBER) console.warn("⚠️ Missing TWILIO_FROM_NUMBER");
if (!OWNER_NUMBER) console.warn("⚠️ Missing OWNER_NUMBER");
if (!ADMIN_TOKEN) console.warn("⚠️ Missing ADMIN_TOKEN (required for /admin/*)");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Render Postgres
});

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// =========================
// STEP A — DB SETUP
// =========================
async function initDb() {
  // leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      status TEXT DEFAULT 'pending',     -- pending | assigned | closed
      phone TEXT,
      service TEXT,
      zip TEXT,
      notes TEXT,
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
      services TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE
    );
  `);

  // assignments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
      provider_id INT REFERENCES providers(id) ON DELETE CASCADE,
      UNIQUE (lead_id)
    );
  `);

  console.log("✅ Database ready: leads/providers/assignments tables exist");
}

initDb().catch((err) => {
  console.error("❌ Database init failed:", err);
});

// =========================
// Admin auth
// =========================
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, error: "ADMIN_TOKEN not set" });
  if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

// =========================
// Health
// =========================
app.get("/", async (req, res) => {
  res.send("✅ Nationwide Leads server running");
});

// =========================
// Lead intake endpoint
// =========================
app.post("/lead/new", async (req, res) => {
  try {
    const raw = req.body || {};

    const phone =
      raw.phone ||
      raw.Phone ||
      raw?.fields?.Phone ||
      raw?.fields?.phone ||
      "UNKNOWN";

    const service =
      raw.service ||
      raw.Service ||
      raw?.fields?.Service ||
      raw?.fields?.service ||
      "General";

    const zip =
      raw.zip ||
      raw.Zip ||
      raw?.fields?.Zip ||
      raw?.fields?.zip ||
      "";

    const notes =
      raw.notes ||
      raw.Notes ||
      raw?.fields?.Notes ||
      raw?.fields?.notes ||
      "";

    const insert = await pool.query(
      `INSERT INTO leads (phone, service, zip, notes, raw)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at, status`,
      [phone, service, zip, notes, raw]
    );

    const lead = insert.rows[0];

    // SMS the owner/admin
    const msg = `🧲 New Lead #${lead.id}\nService: ${service}\nPhone: ${phone}\nZip: ${zip}\nNotes: ${notes || "-"}\nStatus: ${lead.status}`;

    if (TWILIO_FROM_NUMBER && OWNER_NUMBER) {
      await client.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: OWNER_NUMBER,
        body: msg
      });
    }

    return res.status(200).json({ ok: true, lead });
  } catch (err) {
    console.error("❌ /lead/new error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// =========================
// B) ADMIN API ENDPOINTS
// =========================

// 1) Dashboard status summary
app.get("/admin/status", requireAdmin, async (req, res) => {
  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM leads`);
    const pending = await pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE status='pending'`);
    const assigned = await pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE status='assigned'`);
    const closed = await pool.query(`SELECT COUNT(*)::int AS n FROM leads WHERE status='closed'`);
    const providersOnline = await pool.query(`SELECT COUNT(*)::int AS n FROM providers WHERE active=true`);

    res.json({
      ok: true,
      totals: {
        leads_received: total.rows[0].n,
        leads_pending: pending.rows[0].n,
        leads_assigned: assigned.rows[0].n,
        leads_closed: closed.rows[0].n,
        providers_online: providersOnline.rows[0].n
      }
    });
  } catch (err) {
    console.error("❌ /admin/status error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2) Providers list/add/update
app.get("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM providers ORDER BY id DESC`);
    res.json({ ok: true, providers: r.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/admin/providers", requireAdmin, async (req, res) => {
  try {
    const { name, phone, services } = req.body || {};
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name and phone required" });

    const r = await pool.query(
      `INSERT INTO providers (name, phone, services, active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [name, phone, services || ""]
    );

    res.json({ ok: true, provider: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch("/admin/providers/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { active, name, phone, services } = req.body || {};

    const r = await pool.query(
      `UPDATE providers
       SET active = COALESCE($1, active),
           name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           services = COALESCE($4, services)
       WHERE id = $5
       RETURNING *`,
      [typeof active === "boolean" ? active : null, name || null, phone || null, services || null, id]
    );

    res.json({ ok: true, provider: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3) Assign lead to provider (and SMS provider)
app.post("/admin/assign", requireAdmin, async (req, res) => {
  try {
    const { lead_id, provider_id } = req.body || {};
    if (!lead_id || !provider_id) {
      return res.status(400).json({ ok: false, error: "lead_id and provider_id required" });
    }

    const leadR = await pool.query(`SELECT * FROM leads WHERE id=$1`, [lead_id]);
    const provR = await pool.query(`SELECT * FROM providers WHERE id=$1`, [provider_id]);

    if (!leadR.rows[0]) return res.status(404).json({ ok: false, error: "Lead not found" });
    if (!provR.rows[0]) return res.status(404).json({ ok: false, error: "Provider not found" });

    // upsert assignment
    await pool.query(
      `INSERT INTO assignments (lead_id, provider_id)
       VALUES ($1, $2)
       ON CONFLICT (lead_id) DO UPDATE SET provider_id = EXCLUDED.provider_id`,
      [lead_id, provider_id]
    );

    await pool.query(`UPDATE leads SET status='assigned' WHERE id=$1`, [lead_id]);

    const lead = leadR.rows[0];
    const provider = provR.rows[0];

    const msg = `📌 New Assigned Lead #${lead.id}\nService: ${lead.service}\nCustomer: ${lead.phone}\nZip: ${lead.zip || "-"}\nNotes: ${lead.notes || "-"}`;

    if (TWILIO_FROM_NUMBER && provider.phone) {
      await client.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: provider.phone,
        body: msg
      });
    }

    res.json({ ok: true, assigned: { lead_id, provider_id } });
  } catch (err) {
    console.error("❌ /admin/assign error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4) Admin send SMS (manual)
app.post("/admin/sms", requireAdmin, async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ ok: false, error: "to and body required" });

    const msg = await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to,
      body
    });

    res.json({ ok: true, sid: msg.sid });
  } catch (err) {
    console.error("❌ /admin/sms error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
