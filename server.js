import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const app = express();

// ---------- middleware ----------
app.use(cors());
app.use(bodyParser.json());

// ---------- static public folder (serves /dashboard.html) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ---------- env ----------
const DATABASE_URL = process.env.DATABASE_URL;

// Admin token (you set this in Render env vars)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;

// Support either name (you used different names earlier)
const TWILIO_FROM_NUMBER =
  process.env.TWILIO_FROM_NUMBER ||
  process.env.TWILIO_NUMBER ||
  "";

// Port
const PORT = process.env.PORT || 10000;

// ---------- Postgres ----------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------- Twilio client (only if creds exist) ----------
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// ---------- STEP A: DB init (creates table) ----------
async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      name TEXT,
      phone TEXT,
      city TEXT,
      category TEXT,
      status TEXT DEFAULT 'new',
      assigned_to TEXT,
      raw JSONB
    );
  `;
  await pool.query(sql);
  console.log("✅ Database ready: leads table exists");
}
initDb().catch((err) => console.error("❌ Database init failed:", err));

// ---------- small helper ----------
function requireAdmin(req, res, next) {
  const token =
    (req.headers.authorization || "").replace("Bearer ", "") ||
    (req.query.token || "");

  if (!ADMIN_TOKEN) return res.status(500).send("ADMIN_TOKEN missing in env");
  if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

// ---------- ROUTES ----------

// Health check
app.get("/", (req, res) => res.send("Citywide routing server running"));

// ✅ Fix: make /dashboard work
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Optional convenience
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Lead intake (store lead + optional SMS)
app.post("/lead/new", async (req, res) => {
  try {
    const body = req.body || {};

    const name =
      body.name ||
      body.customerName ||
      body.fullName ||
      "";

    const phone =
      body.phone ||
      body.Phone ||
      body.fields?.Phone ||
      body.fields?.phone ||
      "UNKNOWN";

    const city =
      body.city ||
      body.City ||
      body.fields?.City ||
      "";

    const category =
      body.category ||
      body.service ||
      body.Service ||
      body.fields?.Service ||
      "General";

    // Save to DB
    const insert = `
      INSERT INTO leads (name, phone, city, category, raw)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at, status;
    `;
    const result = await pool.query(insert, [name, phone, city, category, body]);
    const row = result.rows[0];

    // Optional SMS alert (only if Twilio configured)
    if (twilioClient && TWILIO_FROM_NUMBER) {
      const msg = `🧲 New Lead\n#${row.id}\n${category}\n${city}\nPhone: ${phone}`;
      // You can change the "to" number later — for now keep your owner number in env
      const OWNER_NUMBER = process.env.OWNER_NUMBER || "";
      if (OWNER_NUMBER) {
        await twilioClient.messages.create({
          from: TWILIO_FROM_NUMBER,
          to: OWNER_NUMBER,
          body: msg,
        });
      }
    }

    res.json({ ok: true, lead: row });
  } catch (err) {
    console.error("❌ /lead/new error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ✅ THIS IS THE ONE YOU ASKED FOR:
app.get("/admin/leads", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const status = (req.query.status || "").trim(); // optional filter

    let rows;
    if (status) {
      const q = `
        SELECT id, created_at, name, phone, city, category, status, assigned_to
        FROM leads
        WHERE status = $1
        ORDER BY id DESC
        LIMIT $2;
      `;
      rows = (await pool.query(q, [status, limit])).rows;
    } else {
      const q = `
        SELECT id, created_at, name, phone, city, category, status, assigned_to
        FROM leads
        ORDER BY id DESC
        LIMIT $1;
      `;
      rows = (await pool.query(q, [limit])).rows;
    }

    res.json({ ok: true, leads: rows });
  } catch (err) {
    console.error("❌ /admin/leads error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Start
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
