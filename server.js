// =====================================================
// CITYWIDE ROUTING - SERVER.JS (FINAL)
// =====================================================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// -------------------- Env --------------------
const PORT = process.env.PORT || 10000;
const ADMIN_PHONE = process.env.ADMIN_PHONE || "";
const LEAD_TOKEN = process.env.LEAD_TOKEN || "";

// Telnyx (optional - safe if missing)
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_FROM_NUMBER = process.env.TELNYX_FROM_NUMBER || ""; // e.g. +1844...
const TELNYX_CONNECTION_ID = process.env.TELNYX_CONNECTION_ID || ""; // for call control later

let telnyx = null;
try {
if (TELNYX_API_KEY) {
telnyx = require("telnyx")(TELNYX_API_KEY);
}
} catch (e) {
telnyx = null;
}

// -------------------- App --------------------
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ IMPORTANT: serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// -------------------- DB --------------------
const db = new sqlite3.Database("./database.db", (err) => {
if (err) console.error("DB connection error:", err);
else console.log("DB ready");
});

db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS leads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
phone TEXT,
zip TEXT,
service TEXT,
details TEXT,
tier TEXT DEFAULT 'tier1',
status TEXT DEFAULT 'needs_assignment',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`, (err) => {
if (err) console.error("DB table error:", err);
else console.log("DB table checked/updated");
});
});

// -------------------- Helpers --------------------
function requireLeadToken(req, res, next) {
// If you didn't set LEAD_TOKEN yet, we allow for testing.
if (!LEAD_TOKEN) return next();

const token =
req.headers["x-lead-token"] ||
req.query.token ||
(req.body && req.body.token) ||
"";

if (!token || token !== LEAD_TOKEN) {
return res.status(401).json({ error: "Unauthorized: missing/invalid LEAD_TOKEN" });
}
next();
}

function normalizePhone(p) {
if (!p) return "";
let s = String(p).trim();
// If user typed 10 digits, assume US +1
const digits = s.replace(/\D/g, "");
if (digits.length === 10) return "+1" + digits;
if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
if (s.startsWith("+")) return s;
return "+" + digits;
}

// -------------------- Health --------------------
app.get("/health", (req, res) => {
res.json({
ok: true,
service: "citywide-routing",
telnyxConfigured: !!telnyx,
port: PORT,
time: new Date().toISOString(),
});
});

// Root (helps Render browser test)
app.get("/", (req, res) => {
res.send("Citywide Routing Server Running ✅ Visit /dashboard.html or /health");
});

// -------------------- Lead Intake --------------------
// POST /api/lead (from Wix embed)
// Body: {name, phone, zip, service, details, tier?}
app.post("/api/lead", requireLeadToken, (req, res) => {
const name = (req.body.name || "").trim();
const phone = normalizePhone(req.body.phone || "");
const zip = (req.body.zip || "").trim();
const service = (req.body.service || "").trim();
const details = (req.body.details || "").trim();
const tier = (req.body.tier || "tier1").trim();

if (!phone || !service) {
return res.status(400).json({ error: "Missing required fields: phone, service" });
}

db.run(
`INSERT INTO leads (name, phone, zip, service, details, tier) VALUES (?, ?, ?, ?, ?, ?)`,
[name, phone, zip, service, details, tier],
function (err) {
if (err) {
console.error("Insert lead error:", err);
return res.status(500).json({ error: "DB insert failed" });
}

const leadId = this.lastID;
console.log("LEAD RECEIVED:", { id: leadId, name, phone, zip, service, details, tier });

// Optional notify (SMS) - safe if Telnyx not configured
notifyAdminSMS({ id: leadId, name, phone, zip, service, tier }).then((notifyResult) => {
res.json({ ok: true, id: leadId, notify: notifyResult });
});
}
);
});

// GET /api/leads (for dashboard table)
app.get("/api/leads", (req, res) => {
db.all(
`SELECT id, name, phone, zip, service, details, tier, status, created_at
FROM leads
ORDER BY datetime(created_at) DESC
LIMIT 300`,
(err, rows) => {
if (err) {
console.error("Select leads error:", err);
return res.status(500).json({ error: "DB read failed" });
}
res.json(rows);
}
);
});

// Update lead status/tier (optional)
app.post("/api/lead/update", (req, res) => {
const id = Number(req.body.id);
const status = (req.body.status || "").trim();
const tier = (req.body.tier || "").trim();

if (!id) return res.status(400).json({ error: "Missing id" });

const updates = [];
const vals = [];

if (status) { updates.push("status=?"); vals.push(status); }
if (tier) { updates.push("tier=?"); vals.push(tier); }

if (!updates.length) return res.status(400).json({ error: "No fields to update" });

vals.push(id);

db.run(`UPDATE leads SET ${updates.join(", ")} WHERE id=?`, vals, function (err) {
if (err) {
console.error("Update lead error:", err);
return res.status(500).json({ error: "DB update failed" });
}
res.json({ ok: true, updated: this.changes });
});
});

// -------------------- Telnyx Notify (SMS) --------------------
async function notifyAdminSMS(lead) {
const configured = !!(telnyx && TELNYX_FROM_NUMBER && ADMIN_PHONE);
console.log("Telnyx configured:", configured);

if (!configured) {
return { sms: "skipped", reason: "Telnyx not configured" };
}

try {
const msg =
`Citywide Lead ✅\n` +
`Tier: ${lead.tier}\n` +
`Service: ${lead.service}\n` +
`Name: ${lead.name || "-"}\n` +
`Phone: ${lead.phone}\n` +
`ZIP: ${lead.zip || "-"}\n` +
`ID: ${lead.id}`;

const r = await telnyx.messages.create({
from: TELNYX_FROM_NUMBER,
to: normalizePhone(ADMIN_PHONE),
text: msg,
});

return { sms: "sent", id: r.data && r.data.id ? r.data.id : "ok" };
} catch (e) {
console.error("Telnyx SMS error:", e?.message || e);
return { sms: "failed", error: e?.message || "unknown" };
}
}

// -------------------- Start --------------------
app.listen(PORT, () => {
console.log("Server running on port", PORT);
console.log("Dashboard:", `/dashboard.html`);
console.log("Health:", `/health`);
});
