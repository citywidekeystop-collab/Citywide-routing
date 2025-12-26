/**
* Citywide Routing — server.js (FINAL)
* - Postgres DB init at startup (creates + upgrades leads table safely)
* - /health endpoint
* - /lead/new endpoint (token optional but supported)
* - Twilio SMS notification to ADMIN_PHONE
*/

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const twilio = require("twilio");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ===== ENV =====
const PORT = process.env.PORT || 10000;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
console.error("❌ Missing DATABASE_URL in Render Environment Variables.");
}

// Token used by your Wix embed (example: /lead/new?token=xxxx)
// You can set LEAD_TOKEN = same value you put into your Wix embed
const LEAD_TOKEN = process.env.LEAD_TOKEN || ""; // optional
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""; // optional (for admin endpoints)

// Where to SMS alerts to (your phone)
const ADMIN_PHONE = process.env.ADMIN_PHONE || process.env.OWNER_NUMBER || "";

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
// Use TWILIO_FROM or TWILIO_NUMBER (either is fine) — must be a Twilio-owned number
const TWILIO_FROM = process.env.TWILIO_FROM || process.env.TWILIO_NUMBER || "";

const hasTwilio =
!!TWILIO_ACCOUNT_SID && !!TWILIO_AUTH_TOKEN && !!TWILIO_FROM && !!ADMIN_PHONE;

const twilioClient = hasTwilio
? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
: null;

// ===== DB =====
const pool = new Pool({
connectionString: DATABASE_URL,
ssl: DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function initDb() {
// Create table if not exists
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
name TEXT,
phone TEXT,
zip TEXT,
service TEXT,
details TEXT,
status TEXT DEFAULT 'needs_assignment',
created_at TIMESTAMPTZ DEFAULT NOW()
);
`);

// Upgrade columns safely (in case table existed without these columns)
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS details TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;`);

// Ensure defaults (won't fail if already set)
await pool.query(`ALTER TABLE leads ALTER COLUMN created_at SET DEFAULT NOW();`).catch(() => {});
await pool.query(`ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'needs_assignment';`).catch(() => {});
}

// ===== HELPERS =====
function cleanPhone(p) {
if (!p) return "";
return String(p).trim();
}

function requireTokenIfSet(req, expectedToken) {
// If token is not set in env, allow requests (useful during testing)
if (!expectedToken) return true;

const token =
req.query.token ||
req.headers["x-lead-token"] ||
req.headers["x-admin-token"] ||
"";

return String(token) === String(expectedToken);
}

async function sendSmsNotification(lead) {
if (!hasTwilio) {
return { sms: "skipped", reason: "twilio_not_configured" };
}

const msg =
`🟦 New Lead Received\n` +
`Service: ${lead.service || "-"}\n` +
`Name: ${lead.name || "-"}\n` +
`Phone: ${lead.phone || "-"}\n` +
`ZIP: ${lead.zip || "-"}\n` +
`Details: ${lead.details || "-"}\n` +
`Status: ${lead.status || "needs_assignment"}`;

try {
const res = await twilioClient.messages.create({
from: TWILIO_FROM,
to: ADMIN_PHONE,
body: msg,
});

return { sms: "sent", sid: res.sid };
} catch (err) {
// Common causes: From number not SMS-capable, trial account, incorrect From format, blocked destination, etc.
return { sms: "failed", error: err.message };
}
}

// ===== ROUTES =====
app.get("/health", (req, res) => {
res.json({ ok: true, service: "citywide-routing", time: new Date().toISOString() });
});

// Lead intake (used by your Wix embed)
app.post("/lead/new", async (req, res) => {
try {
// If you set LEAD_TOKEN in Render, the embed MUST send it (?token=...)
if (!requireTokenIfSet(req, LEAD_TOKEN)) {
return res.status(401).json({ ok: false, error: "Invalid token" });
}

const { name, phone, zip, service, details } = req.body || {};

const lead = {
name: (name || "").trim(),
phone: cleanPhone(phone),
zip: (zip || "").trim(),
service: (service || "").trim(),
details: (details || "").trim(),
status: "needs_assignment",
};

console.log("✅ LEAD RECEIVED:", lead);

// Insert
const insert = await pool.query(
`INSERT INTO leads (name, phone, zip, service, details, status)
VALUES ($1,$2,$3,$4,$5,$6)
RETURNING id, name, phone, zip, service, details, status, created_at`,
[lead.name, lead.phone, lead.zip, lead.service, lead.details, lead.status]
);

const saved = insert.rows[0];

// Notify
const notify = await sendSmsNotification(saved);
console.log("📲 NOTIFY RESULTS:", notify);

return res.json({ ok: true, lead: saved, notify });
} catch (err) {
console.error("❌ /lead/new error:", err);
return res.status(500).json({ ok: false, error: "Server error", detail: err.message });
}
});

// (Optional) Admin list leads (requires ADMIN_TOKEN if set)
app.get("/admin/leads", async (req, res) => {
try {
if (!requireTokenIfSet(req, ADMIN_TOKEN)) {
return res.status(401).json({ ok: false, error: "Invalid admin token" });
}

const r = await pool.query(
`SELECT id, name, phone, zip, service, details, status, created_at
FROM leads
ORDER BY id DESC
LIMIT 200`
);
res.json({ ok: true, leads: r.rows });
} catch (err) {
console.error("❌ /admin/leads error:", err);
res.status(500).json({ ok: false, error: err.message });
}
});

// ===== START =====
(async () => {
try {
await initDb();
console.log("✅ DB ready (leads table checked/updated)");
} catch (e) {
console.error("❌ DB init failed:", e);
}

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
console.log(`✅ /health ready`);
console.log(`Twilio configured: ${hasTwilio ? "YES" : "NO (will skip SMS)"}`);
});
})();
