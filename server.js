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

// --- ENV ---
const {
DATABASE_URL,
ADMIN_TOKEN,
OWNER_NUMBER, // your phone to receive notifications
TWILIO_ACCOUNT_SID,
TWILIO_AUTH_TOKEN,
TWILIO_NUMBER, // Twilio FROM number (E.164)
PORT
} = process.env;

const port = Number(PORT || 10000);

// --- Postgres ---
if (!DATABASE_URL) console.warn("⚠️ DATABASE_URL missing in Render env vars");
const pool = new Pool({
connectionString: DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

// --- Twilio client ---
const smsClient =
TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
: null;

// ===============================
// STEP A — DB init (leads + providers)
// ===============================
async function initDb() {
const createLeads = `
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
created_at TIMESTAMP DEFAULT NOW(),
category TEXT DEFAULT 'Locksmith',
name TEXT,
phone TEXT,
email TEXT,
address TEXT,
zip TEXT,
notes TEXT,
status TEXT DEFAULT 'new',
assigned_to TEXT,
raw JSONB
);
`;

const createProviders = `
CREATE TABLE IF NOT EXISTS providers (
id SERIAL PRIMARY KEY,
created_at TIMESTAMP DEFAULT NOW(),
name TEXT NOT NULL,
phone TEXT NOT NULL,
categories TEXT[] DEFAULT ARRAY['Locksmith'],
active BOOLEAN DEFAULT TRUE,
notes TEXT
);
`;

await pool.query(createLeads);
await pool.query(createProviders);
console.log("✅ Database ready: leads + providers tables exist");
}

initDb().catch((err) => console.error("❌ Database init failed:", err));

// ===============================
// STATIC + DASHBOARD ROUTES
// Put dashboard.html inside: /public/dashboard.html
// ===============================
app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard", (req, res) => {
// ✅ THIS IS THE FIX FOR "Cannot GET /dashboard"
res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// optional: make root show dashboard too
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ===============================
// AUTH (simple token check)
// ===============================
function requireAdmin(req, res, next) {
const token =
req.headers["x-admin-token"] ||
req.query.token ||
(req.headers.authorization || "").replace("Bearer ", "");

if (!ADMIN_TOKEN) return res.status(500).json({ ok: false, error: "ADMIN_TOKEN missing on server" });
if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });

next();
}

// ===============================
// HEALTH / STATUS
// ===============================
app.get("/admin/status", requireAdmin, async (req, res) => {
try {
const leadCount = await pool.query("SELECT COUNT(*)::int AS n FROM leads");
const newCount = await pool.query("SELECT COUNT(*)::int AS n FROM leads WHERE status='new'");
const assignedCount = await pool.query("SELECT COUNT(*)::int AS n FROM leads WHERE status='assigned'");
const closedCount = await pool.query("SELECT COUNT(*)::int AS n FROM leads WHERE status IN ('closed','done')");
res.json({
ok: true,
counts: {
total: leadCount.rows[0].n,
new: newCount.rows[0].n,
assigned: assignedCount.rows[0].n,
closed: closedCount.rows[0].n
}
});
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

// ===============================
// LEADS API (THIS POWERS YOUR TABLE)
// ===============================
app.get("/admin/leads", requireAdmin, async (req, res) => {
try {
const limit = Math.min(Number(req.query.limit || 50), 200);
const q = `
SELECT id, created_at, category, name, phone, email, address, zip, notes, status, assigned_to
FROM leads
ORDER BY created_at DESC
LIMIT $1
`;
const r = await pool.query(q, [limit]);
res.json({ ok: true, leads: r.rows });
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

// Create a lead (use from forms / webhooks)
app.post("/lead/new", async (req, res) => {
try {
const raw = req.body || {};

const phone =
raw.phone ||
raw.Phone ||
raw?.fields?.Phone ||
raw?.fields?.phone ||
"UNKNOWN";

const name = raw.name || raw.fullName || raw?.fields?.Name || raw?.fields?.name || null;
const email = raw.email || raw?.fields?.Email || raw?.fields?.email || null;
const address = raw.address || raw?.fields?.Address || raw?.fields?.address || null;
const zip = raw.zip || raw?.fields?.Zip || raw?.fields?.zip || null;
const notes = raw.notes || raw?.fields?.Notes || raw?.fields?.notes || null;
const category = raw.category || raw.service || raw?.fields?.Category || "Locksmith";

const insert = `
INSERT INTO leads (category, name, phone, email, address, zip, notes, status, raw)
VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8)
RETURNING id
`;
const r = await pool.query(insert, [category, name, phone, email, address, zip, notes, raw]);
const leadId = r.rows[0].id;

// Notify owner by SMS (optional)
if (smsClient && TWILIO_NUMBER && OWNER_NUMBER) {
await smsClient.messages.create({
from: TWILIO_NUMBER,
to: OWNER_NUMBER,
body: `🆕 New Lead #${leadId}\nCategory: ${category}\nPhone: ${phone}\nName: ${name || ""}\nZIP: ${zip || ""}`
});
}

res.json({ ok: true, id: leadId });
} catch (e) {
console.error(e);
res.status(500).json({ ok: false, error: String(e) });
}
});

// ===============================
// PROVIDERS API
// ===============================
app.get("/admin/providers", requireAdmin, async (req, res) => {
try {
const r = await pool.query(
"SELECT id, created_at, name, phone, categories, active, notes FROM providers ORDER BY created_at DESC LIMIT 200"
);
res.json({ ok: true, providers: r.rows });
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

app.post("/admin/providers", requireAdmin, async (req, res) => {
try {
const { name, phone, categories, active, notes } = req.body || {};
if (!name || !phone) return res.status(400).json({ ok: false, error: "name + phone required" });

const cats = Array.isArray(categories) && categories.length ? categories : ["Locksmith"];

const r = await pool.query(
`INSERT INTO providers (name, phone, categories, active, notes)
VALUES ($1,$2,$3,$4,$5) RETURNING id`,
[name, phone, cats, active ?? true, notes ?? null]
);
res.json({ ok: true, id: r.rows[0].id });
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

// ===============================
// ASSIGN LEAD TO PROVIDER (+ optional SMS provider)
// ===============================
app.post("/admin/assign", requireAdmin, async (req, res) => {
try {
const { lead_id, provider_phone, provider_name } = req.body || {};
if (!lead_id || !provider_phone) {
return res.status(400).json({ ok: false, error: "lead_id + provider_phone required" });
}

await pool.query(
`UPDATE leads SET status='assigned', assigned_to=$1 WHERE id=$2`,
[provider_phone, lead_id]
);

if (smsClient && TWILIO_NUMBER) {
await smsClient.messages.create({
from: TWILIO_NUMBER,
to: provider_phone,
body: `📩 New Lead Assigned\nLead #${lead_id}\n${provider_name ? "Provider: " + provider_name + "\n" : ""}Reply YES to accept.`
});
}

res.json({ ok: true });
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

// ===============================
// SMS CENTER (send custom SMS)
// ===============================
app.post("/admin/sms", requireAdmin, async (req, res) => {
try {
const { to, body } = req.body || {};
if (!to || !body) return res.status(400).json({ ok: false, error: "to + body required" });
if (!smsClient || !TWILIO_NUMBER) return res.status(500).json({ ok: false, error: "Twilio not configured" });

const msg = await smsClient.messages.create({ from: TWILIO_NUMBER, to, body });
res.json({ ok: true, sid: msg.sid });
} catch (e) {
res.status(500).json({ ok: false, error: String(e) });
}
});

// ===============================
// START SERVER
// ===============================
app.listen(port, () => {
console.log(`🚀 Server running on port ${port}`);
});
