// ===============================
// CITYWIDE ROUTING - server.js
// TELNYX VERSION (NO TWILIO)
// ===============================

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Telnyx (safe load)
let telnyx = null;
try {
const Telnyx = require("telnyx");
if (process.env.TELNYX_API_KEY) {
telnyx = Telnyx(process.env.TELNYX_API_KEY);
}
} catch (e) {
// telnyx package not installed yet
}

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------
// DB (SQLite)
// -------------------------------
const dbFile = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbFile, (err) => {
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
status TEXT DEFAULT 'needs_assignment',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
console.log("DB table checked/updated");
});

// -------------------------------
// Health + Root
// -------------------------------
app.get("/", (req, res) => {
res.status(200).send("Citywide Routing Server Running ✅");
});

app.get("/health", (req, res) => {
res.status(200).json({
ok: true,
service: "citywide-routing",
telnyxConfigured: !!telnyx,
time: new Date().toISOString(),
});
});

// -------------------------------
// Helpers
// -------------------------------
function normalizePhone(input) {
if (!input) return "";
let p = String(input).trim();
// If user enters 443... make it +1...
if (/^\d{10}$/.test(p)) return "+1" + p;
if (/^\d{11}$/.test(p) && p.startsWith("1")) return "+" + p;
if (p.startsWith("+")) return p;
return p;
}

function requireLeadToken(req, res, next) {
const expected = process.env.LEAD_TOKEN;
if (!expected) {
return res.status(500).json({ error: "Server missing LEAD_TOKEN env var" });
}

const token =
req.headers["x-lead-token"] ||
req.query.token ||
(req.body && req.body.token);

if (!token || token !== expected) {
return res.status(401).json({ error: "Unauthorized: bad token" });
}
next();
}

async function sendSmsViaTelnyx({ to, text }) {
if (!telnyx) throw new Error("Telnyx not configured (missing TELNYX_API_KEY)");
const from = process.env.TELNYX_FROM; // must be your Telnyx number
if (!from) throw new Error("Missing TELNYX_FROM env var");

const resp = await telnyx.messages.create({
from,
to,
text,
});

return resp;
}

// -------------------------------
// Lead Intake (Protected by token)
// -------------------------------
app.post("/api/lead", requireLeadToken, (req, res) => {
const name = (req.body.name || "").trim();
const phone = normalizePhone(req.body.phone || "");
const zip = (req.body.zip || "").trim();
const service = (req.body.service || "").trim();
const details = (req.body.details || "").trim();

if (!phone || !service) {
return res.status(400).json({ error: "Missing required fields (phone, service)" });
}

db.run(
`INSERT INTO leads (name, phone, zip, service, details) VALUES (?, ?, ?, ?, ?)`,
[name, phone, zip, service, details],
async function (err) {
if (err) {
console.error("DB insert error:", err);
return res.status(500).json({ error: "DB error" });
}

const leadId = this.lastID;

console.log("LEAD RECEIVED:", { leadId, name, phone, zip, service, details });

// Notify Admin via SMS
const adminPhone = normalizePhone(process.env.ADMIN_PHONE || "");
let notifyResult = { sms: "skipped" };

if (adminPhone) {
try {
const msg = `🚨 NEW LEAD (#${leadId})
Service: ${service}
Name: ${name || "N/A"}
Phone: ${phone}
ZIP: ${zip || "N/A"}
Details: ${details || "N/A"}
Dashboard: /dashboard`;

await sendSmsViaTelnyx({ to: adminPhone, text: msg });
notifyResult = { sms: "sent" };
} catch (e) {
console.error("TELNYX SMS ERROR:", e?.message || e);
notifyResult = { sms: "failed", error: e?.message || "Telnyx error" };
}
} else {
notifyResult = { sms: "skipped", error: "Missing ADMIN_PHONE" };
}

console.log("NOTIFY RESULTS:", notifyResult);

return res.json({
ok: true,
leadId,
notify: notifyResult,
});
}
);
});

// -------------------------------
// Leads API for Dashboard
// -------------------------------
app.get("/api/leads", (req, res) => {
db.all(
`SELECT id, name, phone, zip, service, details, status, created_at
FROM leads
ORDER BY created_at DESC
LIMIT 200`,
[],
(err, rows) => {
if (err) {
console.error("DB read error:", err);
return res.status(500).json({ error: "DB error" });
}
res.json(rows);
}
);
});

// -------------------------------
// Dashboard Page
// -------------------------------
app.get("/dashboard", (req, res) => {
res.send(`
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Citywide Leads Dashboard</title>
<style>
body { font-family: system-ui, Arial; background:#0b1220; color:#e5e7eb; padding:18px; }
.top { display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
.card { background:#0f1a33; border:1px solid #1f2a44; border-radius:12px; padding:12px; }
button { padding:10px 12px; border-radius:10px; border:0; cursor:pointer; }
table { width:100%; border-collapse: collapse; margin-top:12px; }
th, td { padding:10px; border-bottom:1px solid #1f2a44; text-align:left; font-size:14px; }
th { color:#93c5fd; }
.pill { display:inline-block; padding:4px 8px; border-radius:999px; background:#132046; border:1px solid #233258; }
.small { color:#9ca3af; font-size:12px; }
input { padding:10px; border-radius:10px; border:1px solid #233258; background:#0b1220; color:#e5e7eb; }
</style>
</head>
<body>
<div class="top">
<div>
<h2 style="margin:0">Citywide Leads</h2>
<div class="small">Refreshes every 8 seconds</div>
</div>
<div style="display:flex; gap:10px; align-items:center;">
<input id="q" placeholder="Search name/phone/zip/service" />
<button onclick="loadLeads()">Refresh</button>
</div>
</div>

<div class="card" style="margin-top:12px;">
<div id="meta" class="small">Loading...</div>
<table>
<thead>
<tr>
<th>ID</th>
<th>Service</th>
<th>Name</th>
<th>Phone</th>
<th>ZIP</th>
<th>Details</th>
<th>Status</th>
<th>Time</th>
</tr>
</thead>
<tbody id="rows"></tbody>
</table>
</div>

<script>
async function loadLeads(){
const r = await fetch('/api/leads');
const data = await r.json();
const q = (document.getElementById('q').value || '').toLowerCase();

const filtered = data.filter(x => {
const s = (x.name+' '+x.phone+' '+x.zip+' '+x.service+' '+x.details).toLowerCase();
return !q || s.includes(q);
});

document.getElementById('meta').textContent =
"Showing " + filtered.length + " leads (latest 200).";

const tbody = document.getElementById('rows');
tbody.innerHTML = '';
filtered.forEach(l => {
const tr = document.createElement('tr');
tr.innerHTML = \`
<td>\${l.id}</td>
<td><span class="pill">\${l.service || ''}</span></td>
<td>\${l.name || ''}</td>
<td>\${l.phone || ''}</td>
<td>\${l.zip || ''}</td>
<td>\${(l.details || '').slice(0,80)}</td>
<td><span class="pill">\${l.status || ''}</span></td>
<td>\${l.created_at || ''}</td>
\`;
tbody.appendChild(tr);
});
}

loadLeads();
setInterval(loadLeads, 8000);
</script>
</body>
</html>
`);
});

// -------------------------------
// Start Server
// -------------------------------
app.listen(PORT, () => {
console.log("Server running on port", PORT);
console.log("Telnyx configured:", !!telnyx);
});
