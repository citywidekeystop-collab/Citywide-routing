import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

const app = express();

// --- needed for __dirname in ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- ENV ---
const {
  DATABASE_URL,
  ADMIN_TOKEN,
  OWNER_NUMBER, // your phone to receive notifications
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER, // Twilio FROM number (E.164)
  PORT,
} = process.env;

const port = Number(PORT || 10000);

// --- Postgres ---
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Twilio ---
const smsClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// ============================
// DB INIT
// ============================
async function initDb() {
  // leads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      customer_name TEXT,
      phone TEXT,
      service TEXT,
      zipcode TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending'
    );
  `);

  // providers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT,
      phone TEXT,
      service TEXT,
      zipcode TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true
    );
  `);
}

// ============================
// HELPERS
// ============================
function requireAdmin(req, res, next) {
  // Accept token in: ?token= , header, or body
  const token =
    req.query.token ||
    req.headers["x-admin-token"] ||
    req.headers["X-Admin-Token"] ||
    req.body?.token;

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

function safeText(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

// ============================
// STATIC FILES
// ============================
// Serve everything inside /public
app.use(express.static(path.join(__dirname, "public")));

// If someone visits the root, send them to dashboard.html
app.get("/", (req, res) => {
  res.redirect("/dashboard.html");
});

// ✅ IMPORTANT: Serve dashboard.html but require token
app.get("/dashboard.html", (req, res, next) => {
  // reuse admin check but for query token
  const token = req.query.token;
  if (!token || token !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");
  return res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Optional friendly route
app.get("/dashboard", (req, res) => {
  const token = req.query.token;
  if (!token || token !== ADMIN_TOKEN) return res.status(401).send("Unauthorized");
  res.redirect(`/dashboard.html?token=${encodeURIComponent(token)}`);
});

// ============================
// API ROUTES
// Your dashboard JS may call /admin/... or /api/admin/...
// We'll support BOTH to avoid mismatch.
// ============================

app.get("/api/ping", (req, res) => res.json({ ok: true, service: "citywide-routing" }));
app.get("/ping", (req, res) => res.json({ ok: true }));

// -------- Leads (public intake) --------
app.post("/api/lead/new", async (req, res) => {
  try {
    const customer_name = safeText(req.body.customer_name || req.body.name);
    const phone = safeText(req.body.phone);
    const service = safeText(req.body.service);
    const zipcode = safeText(req.body.zipcode || req.body.zip);
    const notes = safeText(req.body.notes);

    const result = await pool.query(
      `INSERT INTO leads (customer_name, phone, service, zipcode, notes, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING *`,
      [customer_name, phone, service, zipcode, notes]
    );

    // Optional: notify owner via SMS when lead comes in
    if (smsClient && OWNER_NUMBER && TWILIO_NUMBER) {
      const msg = `New lead: ${customer_name || "Customer"} | ${service} | ${phone} | ${zipcode} | ${notes}`;
      smsClient.messages
        .create({ from: TWILIO_NUMBER, to: OWNER_NUMBER, body: msg })
        .catch(() => {});
    }

    res.json({ ok: true, lead: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// -------- Admin: Stats --------
async function adminStatsHandler(req, res) {
  try {
    const processed = await pool.query(`SELECT COUNT(*)::int AS c FROM leads WHERE status='processed'`);
    const pending = await pool.query(`SELECT COUNT(*)::int AS c FROM leads WHERE status='pending'`);
    const cancelled = await pool.query(`SELECT COUNT(*)::int AS c FROM leads WHERE status='cancelled'`);
    const activeProviders = await pool.query(`SELECT COUNT(*)::int AS c FROM providers WHERE active=true`);

    res.json({
      ok: true,
      stats: {
        processed: processed.rows[0].c,
        pending: pending.rows[0].c,
        cancelled: cancelled.rows[0].c,
        activeProviders: activeProviders.rows[0].c,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// -------- Admin: List leads --------
async function adminLeadsHandler(req, res) {
  try {
    const rows = await pool.query(
      `SELECT id, created_at, customer_name, phone, service, zipcode, notes, status
       FROM leads
       ORDER BY id DESC
       LIMIT 200`
    );
    res.json({ ok: true, leads: rows.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// -------- Admin: Add provider --------
async function adminAddProviderHandler(req, res) {
  try {
    const name = safeText(req.body.name);
    const phone = safeText(req.body.phone);
    const service = safeText(req.body.service);
    const zipcode = safeText(req.body.zipcode);
    const notes = safeText(req.body.notes);
    const active = req.body.active === undefined ? true : !!req.body.active;

    if (!name || !phone) return res.status(400).json({ ok: false, error: "name + phone required" });

    const result = await pool.query(
      `INSERT INTO providers (name, phone, service, zipcode, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, phone, service, zipcode, notes, active]
    );

    res.json({ ok: true, provider: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// -------- Admin: List providers --------
async function adminProvidersHandler(req, res) {
  try {
    const rows = await pool.query(
      `SELECT id, created_at, name, phone, service, zipcode, notes, active
       FROM providers
       ORDER BY id DESC
       LIMIT 500`
    );
    res.json({ ok: true, providers: rows.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// -------- Admin: Send SMS --------
async function adminSmsHandler(req, res) {
  try {
    const to = safeText(req.body.to);
    const body = safeText(req.body.body);

    if (!to || !body) return res.status(400).json({ ok: false, error: "to + body required" });
    if (!smsClient || !TWILIO_NUMBER) return res.status(400).json({ ok: false, error: "Twilio not configured" });

    const msg = await smsClient.messages.create({
      from: TWILIO_NUMBER,
      to,
      body,
    });

    res.json({ ok: true, sid: msg.sid });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

// ============================
// ADMIN ROUTE MOUNTS (BOTH PATHS)
// ============================

// /admin/*
app.get("/admin/stats", requireAdmin, adminStatsHandler);
app.get("/admin/leads", requireAdmin, adminLeadsHandler);
app.get("/admin/providers", requireAdmin, adminProvidersHandler);
app.post("/admin/providers", requireAdmin, adminAddProviderHandler);
app.post("/admin/sms", requireAdmin, adminSmsHandler);

// /api/admin/*
app.get("/api/admin/stats", requireAdmin, adminStatsHandler);
app.get("/api/admin/leads", requireAdmin, adminLeadsHandler);
app.get("/api/admin/providers", requireAdmin, adminProvidersHandler);
app.post("/api/admin/providers", requireAdmin, adminAddProviderHandler);
app.post("/api/admin/sms", requireAdmin, adminSmsHandler);

// ============================
// START
// ============================
(async () => {
  try {
    if (!DATABASE_URL) console.warn("⚠️ DATABASE_URL missing in env");
    if (!ADMIN_TOKEN) console.warn("⚠️ ADMIN_TOKEN missing in env");

    await initDb();

    app.listen(port, () => {
      console.log(`✅ Citywide-routing running on :${port}`);
    });
  } catch (e) {
    console.error("❌ Startup error:", e);
    process.exit(1);
  }
})();
