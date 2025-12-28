// ======================================================
// Citywide Leads Routing Engine (TELNYX)
// - Provider tiers: starter | pro | exclusive
// - Matching by service + zip (supports "*" wildcard zip)
// - Lead intake: Tier2 hold -> auto-escalate to Tier1
// - Provider accepts lead via SMS: "ACCEPT 123"
// - Admin API: providers/services/zips/leads/calls
// - Telnyx Voice: menu 1-5 -> routes call to best provider
// ======================================================

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

// ---- Telnyx init (safe) ----
let telnyx = null;
try {
const Telnyx = require("telnyx");
if (process.env.TELNYX_API_KEY) telnyx = Telnyx(process.env.TELNYX_API_KEY);
} catch {}

// ---- App ----
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---- DB ----
const db = new sqlite3.Database("./database.db", (err) => {
if (err) console.error("DB error:", err);
else console.log("DB ready");
});

db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS providers (
id INTEGER PRIMARY KEY AUTOINCREMENT,
business_name TEXT NOT NULL,
contact_name TEXT,
phone TEXT NOT NULL,
email TEXT,
tier TEXT NOT NULL DEFAULT 'starter',
status TEXT NOT NULL DEFAULT 'active',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS provider_services (
id INTEGER PRIMARY KEY AUTOINCREMENT,
provider_id INTEGER NOT NULL,
service TEXT NOT NULL,
FOREIGN KEY(provider_id) REFERENCES providers(id)
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS provider_zips (
id INTEGER PRIMARY KEY AUTOINCREMENT,
provider_id INTEGER NOT NULL,
zip TEXT NOT NULL,
FOREIGN KEY(provider_id) REFERENCES providers(id)
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS leads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
phone TEXT,
zip TEXT,
service TEXT,
details TEXT,
status TEXT DEFAULT 'new', -- new | held_for_pro | sent_tier1 | assigned | closed
assigned_provider_id INTEGER,
delivery_method TEXT DEFAULT 'sms_lead', -- sms_lead | live_call
hold_expires_at INTEGER, -- unix ms
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS calls (
id INTEGER PRIMARY KEY AUTOINCREMENT,
from_number TEXT,
to_number TEXT,
service TEXT,
digits TEXT,
routed_provider_id INTEGER,
routed_to_phone TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

console.log("DB tables OK");
});

// ---- Helpers ----
const nowMs = () => Date.now();

function normalizePhone(input) {
if (!input) return "";
let p = String(input).trim().replace(/[^\d+]/g, "");
if (/^\d{10}$/.test(p)) return "+1" + p;
if (/^\d{11}$/.test(p) && p.startsWith("1")) return "+" + p;
return p;
}

function tierRank(tier) {
if (tier === "exclusive") return 3;
if (tier === "pro") return 2;
return 1;
}

async function sendSms(to, text) {
if (!telnyx) throw new Error("TELNYX_API_KEY not set or telnyx package missing");
const from = process.env.TELNYX_FROM;
if (!from) throw new Error("TELNYX_FROM missing (your Telnyx number like +1...)");
return telnyx.messages.create({ from, to, text });
}

function sendTeXML(res, xml) {
res.set("Content-Type", "text/xml");
res.status(200).send(xml);
}

// ---- Security middleware ----
function requireAdmin(req, res, next) {
const expected = process.env.ADMIN_TOKEN;
if (!expected) return res.status(500).json({ error: "Missing ADMIN_TOKEN env var" });

const token = req.headers["x-admin-token"] || req.query.admin_token;
if (!token || token !== expected) return res.status(401).json({ error: "Unauthorized (admin token)" });
next();
}

function requireLeadToken(req, res, next) {
const expected = process.env.LEAD_TOKEN;
if (!expected) return res.status(500).json({ error: "Missing LEAD_TOKEN env var" });

const token = req.headers["x-lead-token"] || req.query.token || req.body?.token;
if (!token || token !== expected) return res.status(401).json({ error: "Unauthorized (lead token)" });
next();
}

// ---- Provider matching ----
function findProviders({ service, zip }) {
return new Promise((resolve, reject) => {
const z = (zip || "").trim();
const params = z ? [service, z] : [service];

const sql = z
? `
SELECT DISTINCT p.*
FROM providers p
JOIN provider_services ps ON ps.provider_id = p.id
LEFT JOIN provider_zips pz ON pz.provider_id = p.id
WHERE p.status='active'
AND ps.service = ?
AND (pz.zip = ? OR pz.zip = '*')
`
: `
SELECT DISTINCT p.*
FROM providers p
JOIN provider_services ps ON ps.provider_id = p.id
LEFT JOIN provider_zips pz ON pz.provider_id = p.id
WHERE p.status='active'
AND ps.service = ?
AND (pz.zip = '*' OR pz.zip IS NULL)
`;

db.all(sql, params, (err, rows) => {
if (err) return reject(err);
rows.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
resolve(rows);
});
});
}

// ---- Tier1 broadcast ----
async function broadcastToTier1({ lead }) {
const providers = await findProviders({ service: lead.service, zip: lead.zip });
const starters = providers.filter(p => p.tier === "starter");
const msg =
`📩 Citywide Lead #${lead.id}\n` +
`Service: ${lead.service}\n` +
`Name: ${lead.name || "N/A"}\n` +
`Phone: ${lead.phone}\n` +
`ZIP: ${lead.zip || "N/A"}\n` +
`Details: ${lead.details || "N/A"}\n`;

let sent = 0;
for (const p of starters) {
try {
await sendSms(normalizePhone(p.phone), msg);
sent++;
} catch (e) {
console.log("Tier1 SMS fail:", p.phone, e.message);
}
}
return { starters: starters.length, sent };
}

// ---- Tier2 hold ----
async function holdForTier2({ lead }) {
const providers = await findProviders({ service: lead.service, zip: lead.zip });
const top = providers.find(p => p.tier === "exclusive" || p.tier === "pro") || null;
if (!top) return { held: false };

const HOLD_SECONDS = parseInt(process.env.HOLD_SECONDS || "120", 10);
const holdUntil = nowMs() + HOLD_SECONDS * 1000;

await new Promise((resolve) => {
db.run(
`UPDATE leads SET status='held_for_pro', hold_expires_at=?, assigned_provider_id=NULL, delivery_method='sms_lead' WHERE id=?`,
[holdUntil, lead.id],
() => resolve()
);
});

const msg =
`🚨 PRIORITY LEAD #${lead.id}\n` +
`Service: ${lead.service}\n` +
`Name: ${lead.name || "N/A"}\n` +
`Phone: ${lead.phone}\n` +
`ZIP: ${lead.zip || "N/A"}\n` +
`Details: ${lead.details || "N/A"}\n\n` +
`Reply: ACCEPT ${lead.id} to claim.\n` +
`Hold expires in ${HOLD_SECONDS}s.`;

try {
await sendSms(normalizePhone(top.phone), msg);
} catch (e) {
console.log("Tier2 SMS fail:", e.message);
}

return { held: true, providerId: top.id, holdUntil };
}

// ---- Escalation loop: held_for_pro -> sent_tier1 ----
setInterval(() => {
db.all(
`SELECT * FROM leads WHERE status='held_for_pro' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?`,
[nowMs()],
async (err, rows) => {
if (err) return;
for (const lead of rows) {
await new Promise((resolve) => db.run(`UPDATE leads SET status='sent_tier1' WHERE id=?`, [lead.id], () => resolve()));
try {
const result = await broadcastToTier1({ lead });
const adminPhone = normalizePhone(process.env.ADMIN_PHONE || "");
if (adminPhone) {
try { await sendSms(adminPhone, `✅ Lead #${lead.id} escalated to Tier1 (${result.sent}/${result.starters} sent).`); } catch {}
}
} catch (e) {
console.log("Escalation fail:", e.message);
}
}
}
);
}, 20000);

// ---- Public ----
app.get("/", (req, res) => res.send("Citywide Routing Running ✅"));
app.get("/health", (req, res) => {
res.json({ ok: true, telnyxConfigured: !!telnyx, time: new Date().toISOString() });
});

// =====================================================
// LEAD INTAKE (Wix form posts here)
// POST /api/lead?token=LEAD_TOKEN
// =====================================================
app.post("/api/lead", requireLeadToken, (req, res) => {
const lead = {
name: (req.body.name || "").trim(),
phone: normalizePhone(req.body.phone || ""),
zip: (req.body.zip || "").trim(),
service: (req.body.service || "").trim(),
details: (req.body.details || "").trim()
};

if (!lead.phone || !lead.service) return res.status(400).json({ error: "Missing required fields (phone, service)" });

db.run(
`INSERT INTO leads (name, phone, zip, service, details, status, delivery_method)
VALUES (?, ?, ?, ?, ?, 'new', 'sms_lead')`,
[lead.name, lead.phone, lead.zip, lead.service, lead.details],
async function (err) {
if (err) return res.status(500).json({ error: "DB error" });

const id = this.lastID;
lead.id = id;

let routing = { held: false };
try {
routing = await holdForTier2({ lead });
} catch {}

if (!routing.held) {
await new Promise((resolve) => db.run(`UPDATE leads SET status='sent_tier1' WHERE id=?`, [id], () => resolve()));
try { await broadcastToTier1({ lead }); } catch {}
}

const adminPhone = normalizePhone(process.env.ADMIN_PHONE || "");
if (adminPhone) {
const msg = `📌 New Lead #${id}\nService: ${lead.service}\nPhone: ${lead.phone}\nZIP: ${lead.zip || "N/A"}\nStatus: ${routing.held ? "HELD FOR TIER2" : "SENT TO TIER1"}`;
try { await sendSms(adminPhone, msg); } catch {}
}

res.json({ ok: true, leadId: id, routing });
}
);
});

// =====================================================
// TELNYX INBOUND SMS WEBHOOK (provider accepts lead)
// Provider texts: "ACCEPT 123"
// Set Telnyx inbound SMS webhook to /telnyx/inbound-sms
// =====================================================
app.post("/telnyx/inbound-sms", (req, res) => {
try {
const payload = req.body?.data?.payload || {};
const from = normalizePhone(payload.from?.phone_number || payload.from || "");
const text = String(payload.text || "").trim().toUpperCase();

const m = text.match(/^ACCEPT\s+(\d+)/);
if (!m) return res.json({ ok: true, ignored: true });

const leadId = parseInt(m[1], 10);

db.get(`SELECT * FROM providers WHERE phone=? AND status='active'`, [from], (e1, provider) => {
if (e1 || !provider) return res.json({ ok: true, error: "provider_not_found" });

db.get(`SELECT * FROM leads WHERE id=?`, [leadId], (e2, lead) => {
if (e2 || !lead) return res.json({ ok: true, error: "lead_not_found" });
if (lead.status === "assigned" || lead.status === "closed") return res.json({ ok: true, error: "lead_not_available" });

db.run(`UPDATE leads SET status='assigned', assigned_provider_id=? WHERE id=?`, [provider.id, leadId], async () => {
try { await sendSms(from, `✅ Lead #${leadId} assigned to you. Call customer: ${lead.phone}`); } catch {}

const adminPhone = normalizePhone(process.env.ADMIN_PHONE || "");
if (adminPhone) {
try { await sendSms(adminPhone, `✅ "${provider.business_name}" accepted Lead #${leadId}.`); } catch {}
}
return res.json({ ok: true, assigned: true });
});
});
});
} catch (e) {
return res.status(200).json({ ok: false, error: e.message });
}
});

// =====================================================
// TELNYX VOICE ROUTING (menu 1-5)
// Set Telnyx inbound voice webhook to /telnyx/voice
// =====================================================
const DIGIT_SERVICE_MAP = {
"1": "locksmith_auto",
"2": "hvac",
"3": "cleaning",
"4": "plumbing",
"5": "electrician"
};

app.post("/telnyx/voice", (req, res) => {
return sendTeXML(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="female">Thanks for calling Citywide Leads. Press 1 for locksmith. Press 2 for HVAC. Press 3 for cleaning. Press 4 for plumbing. Press 5 for electrician.</Say>
<Gather action="/telnyx/voice/gather" method="POST" timeout="6" numDigits="1">
<Say voice="female">Press 1, 2, 3, 4, or 5 now.</Say>
</Gather>
<Say voice="female">No selection received. Connecting you now.</Say>
<Dial>${normalizePhone(process.env.ADMIN_PHONE || "")}</Dial>
</Response>`);
});

app.post("/telnyx/voice/gather", async (req, res) => {
const digits = String(req.body?.Digits || req.body?.digits || "").trim();
const service = DIGIT_SERVICE_MAP[digits] || "locksmith_auto";

// For calls we usually don't have ZIP; match providers with zip='*' or no zips
let best = null;
try {
const providers = await findProviders({ service, zip: "" });
best = providers[0] || null;
} catch {}

const routedTo = best ? normalizePhone(best.phone) : normalizePhone(process.env.ADMIN_PHONE || "");

// log call (best effort)
db.run(
`INSERT INTO calls (from_number, to_number, service, digits, routed_provider_id, routed_to_phone)
VALUES (?, ?, ?, ?, ?, ?)`,
["", "", service, digits, best ? best.id : null, routedTo],
() => {}
);

return sendTeXML(res, `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Say voice="female">Connecting you now.</Say>
<Dial>${routedTo}</Dial>
</Response>`);
});

// =====================================================
// ADMIN APIs (use header: x-admin-token: ADMIN_TOKEN)
// =====================================================

// Create provider
app.post("/admin/providers", requireAdmin, (req, res) => {
const business_name = (req.body.business_name || "").trim();
const contact_name = (req.body.contact_name || "").trim();
const phone = normalizePhone(req.body.phone || "");
const email = (req.body.email || "").trim();
const tier = (req.body.tier || "starter").trim();
const status = (req.body.status || "active").trim();

if (!business_name || !phone) return res.status(400).json({ error: "business_name + phone required" });

db.run(
`INSERT INTO providers (business_name, contact_name, phone, email, tier, status) VALUES (?, ?, ?, ?, ?, ?)`,
[business_name, contact_name, phone, email, tier, status],
function (err) {
if (err) return res.status(500).json({ error: "DB error" });
res.json({ ok: true, provider_id: this.lastID });
}
);
});

// List providers + services + zips
app.get("/admin/providers", requireAdmin, (req, res) => {
db.all(`SELECT * FROM providers ORDER BY created_at DESC`, (err, providers) => {
if (err) return res.status(500).json({ error: "DB error" });
const ids = providers.map(p => p.id);
if (!ids.length) return res.json({ ok: true, providers: [] });

db.all(`SELECT * FROM provider_services WHERE provider_id IN (${ids.map(() => "?").join(",")})`, ids, (e2, services) => {
if (e2) return res.status(500).json({ error: "DB error" });

db.all(`SELECT * FROM provider_zips WHERE provider_id IN (${ids.map(() => "?").join(",")})`, ids, (e3, zips) => {
if (e3) return res.status(500).json({ error: "DB error" });

const svcBy = new Map();
const zipBy = new Map();

for (const s of services) {
if (!svcBy.has(s.provider_id)) svcBy.set(s.provider_id, []);
svcBy.get(s.provider_id).push(s.service);
}
for (const z of zips) {
if (!zipBy.has(z.provider_id)) zipBy.set(z.provider_id, []);
zipBy.get(z.provider_id).push(z.zip);
}

res.json({
ok: true,
providers: providers.map(p => ({ ...p, services: svcBy.get(p.id) || [], zips: zipBy.get(p.id) || [] }))
});
});
});
});
});

// Update provider (tier/status/etc)
app.patch("/admin/providers/:id", requireAdmin, (req, res) => {
const id = parseInt(req.params.id, 10);
const fields = [];
const values = [];
const set = (k, v) => { fields.push(`${k}=?`); values.push(v); };

if (req.body.business_name) set("business_name", String(req.body.business_name).trim());
if (req.body.contact_name) set("contact_name", String(req.body.contact_name).trim());
if (req.body.phone) set("phone", normalizePhone(req.body.phone));
if (req.body.email) set("email", String(req.body.email).trim());
if (req.body.tier) set("tier", String(req.body.tier).trim());
if (req.body.status) set("status", String(req.body.status).trim());

if (!fields.length) return res.status(400).json({ error: "No fields to update" });

values.push(id);
db.run(`UPDATE providers SET ${fields.join(", ")} WHERE id=?`, values, function () {
res.json({ ok: true, updated: this.changes });
});
});

// Replace services
app.post("/admin/providers/:id/services", requireAdmin, (req, res) => {
const provider_id = parseInt(req.params.id, 10);
const services = Array.isArray(req.body.services) ? req.body.services : [];

db.serialize(() => {
db.run(`DELETE FROM provider_services WHERE provider_id=?`, [provider_id], () => {
const stmt = db.prepare(`INSERT INTO provider_services (provider_id, service) VALUES (?, ?)`);
for (const s of services) stmt.run(provider_id, String(s).trim());
stmt.finalize(() => res.json({ ok: true }));
});
});
});

// Replace zips (use "*" for all)
app.post("/admin/providers/:id/zips", requireAdmin, (req, res) => {
const provider_id = parseInt(req.params.id, 10);
const zips = Array.isArray(req.body.zips) ? req.body.zips : [];

db.serialize(() => {
db.run(`DELETE FROM provider_zips WHERE provider_id=?`, [provider_id], () => {
const stmt = db.prepare(`INSERT INTO provider_zips (provider_id, zip) VALUES (?, ?)`);
for (const z of zips) stmt.run(provider_id, String(z).trim());
stmt.finalize(() => res.json({ ok: true }));
});
});
});

// Admin leads
app.get("/admin/leads", requireAdmin, (req, res) => {
db.all(
`SELECT l.*, p.business_name as assigned_provider_name
FROM leads l
LEFT JOIN providers p ON p.id = l.assigned_provider_id
ORDER BY l.created_at DESC
LIMIT 500`,
(err, rows) => {
if (err) return res.status(500).json({ error: "DB error" });
res.json({ ok: true, leads: rows });
}
);
});

// Admin assign lead
app.post("/admin/leads/:id/assign", requireAdmin, (req, res) => {
const leadId = parseInt(req.params.id, 10);
const providerId = parseInt(req.body.provider_id, 10);

db.get(`SELECT * FROM leads WHERE id=?`, [leadId], (e1, lead) => {
if (e1 || !lead) return res.status(404).json({ error: "lead_not_found" });

db.get(`SELECT * FROM providers WHERE id=?`, [providerId], (e2, provider) => {
if (e2 || !provider) return res.status(404).json({ error: "provider_not_found" });

db.run(`UPDATE leads SET status='assigned', assigned_provider_id=? WHERE id=?`, [providerId, leadId], async () => {
try { await sendSms(normalizePhone(provider.phone), `✅ Lead #${leadId} assigned to you. Customer: ${lead.phone}`); } catch {}
res.json({ ok: true });
});
});
});
});

// Admin calls
app.get("/admin/calls", requireAdmin, (req, res) => {
db.all(`SELECT * FROM calls ORDER BY created_at DESC LIMIT 500`, (err, rows) => {
if (err) return res.status(500).json({ error: "DB error" });
res.json({ ok: true, calls: rows });
});
});

// ---- Start ----
app.listen(PORT, () => {
console.log("Server running on port", PORT);
console.log("Telnyx configured:", !!telnyx);
});
