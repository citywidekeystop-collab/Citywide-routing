// server.js — Citywide Routing (Updated)
// Node 18+
// ENV:
// ADMIN_TOKEN
// ADMIN_PHONE (E.164 +1...)
// DATABASE_URL
// TWILIO_ACCOUNT_SID
// TWILIO_AUTH_TOKEN
// TWILIO_FROM (E.164 +1...)
// (Also supports legacy names: OWNER_NUMBER, TWILIO_NUMBER, etc.)

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// optional DB (Postgres) — if DATABASE_URL is set
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// ---------- ENV (accept old + new names) ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_KEY || "";

const ADMIN_PHONE =
process.env.ADMIN_PHONE ||
process.env.OWNER_NUMBER ||
process.env.OWNER_PHONE ||
process.env.OWNER_NUMBER_E164 ||
"";

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

const TWILIO_ACCOUNT_SID =
process.env.TWILIO_ACCOUNT_SID ||
process.env.TWILIO_SID ||
"";

const TWILIO_AUTH_TOKEN =
process.env.TWILIO_AUTH_TOKEN ||
process.env.TWILIO_TOKEN ||
"";

const TWILIO_FROM =
process.env.TWILIO_FROM ||
process.env.TWILIO_NUMBER ||
process.env.TWILIO_PHONE ||
"";

// ---------- helpers ----------
function isE164(phone) {
return typeof phone === "string" && /^\+\d{10,15}$/.test(phone.trim());
}

function requireAdmin(req, res, next) {
const token =
(req.headers.authorization || "").replace("Bearer ", "").trim() ||
(req.query.token || "").trim();

if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
return res.status(401).json({ ok: false, error: "Unauthorized" });
}
next();
}

// ---------- DB setup (optional but recommended) ----------
let pool = null;
if (DATABASE_URL) {
pool = new Pool({
connectionString: DATABASE_URL,
ssl: { rejectUnauthorized: false }, // Render Postgres needs this
});
}

async function ensureTables() {
if (!pool) return;
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
}

async function insertLead(lead) {
if (!pool) return { id: null };
const q = `
INSERT INTO leads (name, phone, zip, service, details, status)
VALUES ($1,$2,$3,$4,$5,$6)
RETURNING id, created_at
`;
const vals = [
lead.name || "",
lead.phone || "",
lead.zip || "",
lead.service || "",
lead.details || "",
lead.status || "needs_assignment",
];
const r = await pool.query(q, vals);
return { id: r.rows[0].id, createdAt: r.rows[0].created_at };
}

async function listLeads(limit = 50) {
if (!pool) return [];
const r = await pool.query(
`SELECT id, name, phone, zip, service, details, status, created_at
FROM leads
ORDER BY id DESC
LIMIT $1`,
[limit]
);
return r.rows;
}

// ---------- Twilio SMS ----------
async function sendAdminSms(message) {
const missing = [];
if (!TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
if (!TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
if (!TWILIO_FROM || !isE164(TWILIO_FROM)) missing.push("TWILIO_FROM (E164 +1...)");
if (!ADMIN_PHONE || !isE164(ADMIN_PHONE)) missing.push("ADMIN_PHONE (E164 +1...)");

if (missing.length) {
console.log("SMS SKIPPED — missing/invalid:", missing);
return { ok: false, skipped: true, missing };
}

const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

try {
const res = await twilio.messages.create({
from: TWILIO_FROM.trim(),
to: ADMIN_PHONE.trim(),
body: message,
});
console.log("SMS SENT:", res.sid);
return { ok: true, sid: res.sid };
} catch (err) {
console.log("SMS FAILED:", err?.message || err);
return { ok: false, skipped: false, error: err?.message || String(err) };
}
}

// ---------- routes ----------
app.get("/", (req, res) => res.send("Citywide Routing API is running."));
app.get("/health", (req, res) =>
res.json({ ok: true, service: "citywide-routing", time: new Date().toISOString() })
);

// Safe debug (no secrets)
app.get("/debug/env", (req, res) => {
res.json({
adminTokenPresent: !!ADMIN_TOKEN,
adminPhonePresent: !!ADMIN_PHONE,
adminPhoneValidE164: isE164(ADMIN_PHONE),
databaseUrlPresent: !!DATABASE_URL,
twilioSidPresent: !!TWILIO_ACCOUNT_SID,
twilioTokenPresent: !!TWILIO_AUTH_TOKEN,
twilioFromPresent: !!TWILIO_FROM,
twilioFromValidE164: isE164(TWILIO_FROM),
});
});

// Lead intake (from your Wix embed)
app.post("/lead/new", async (req, res) => {
const token = (req.query.token || "").trim();

// optional token check (recommended)
if (ADMIN_TOKEN && token !== ADMIN_TOKEN) {
return res.status(401).json({ ok: false, error: "Bad token" });
}

const lead = {
name: (req.body?.name || "").trim(),
phone: (req.body?.phone || "").trim(),
zip: (req.body?.zip || "").trim(),
service: (req.body?.service || "").trim(),
details: (req.body?.details || "").trim(),
status: "needs_assignment",
};

console.log("LEAD RECEIVED:", lead);

try {
// save
const saved = await insertLead(lead);

// notify
const msg =
`🔥 New Lead Received\n` +
`Service: ${lead.service || "-"}\n` +
`Name: ${lead.name || "-"}\n` +
`Phone: ${lead.phone || "-"}\n` +
`ZIP: ${lead.zip || "-"}\n` +
`Details: ${lead.details || "-"}\n` +
`ID: ${saved.id ?? "-"}`;

const smsResult = await sendAdminSms(msg);

console.log("NOTIFY RESULTS:", {
sms: smsResult.ok ? "sent" : smsResult.skipped ? "skipped" : "failed",
...(smsResult.missing ? { missing: smsResult.missing } : {}),
...(smsResult.error ? { error: smsResult.error } : {}),
});

res.json({
ok: true,
id: saved.id,
createdAt: saved.createdAt,
notify: { sms: smsResult.ok ? "sent" : smsResult.skipped ? "skipped" : "failed" },
});
} catch (e) {
console.log("ERROR /lead/new:", e?.message || e);
res.status(500).json({ ok: false, error: e?.message || "Server error" });
}
});

// Admin: list leads
app.get("/admin/leads", requireAdmin, async (req, res) => {
const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
const rows = await listLeads(limit);
res.json({ ok: true, leads: rows });
});

// ---------- boot ----------
(async () => {
try {
await ensureTables();
} catch (e) {
console.log("DB init skipped/failed:", e?.message || e);
}

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
})();
