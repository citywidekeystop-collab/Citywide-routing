const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "citywide123";

const providers = {
"Max": "4436792242",
"Dreh": "2024125443",
"Tee": "4104199281",
"Robyn": "4435781686",
"Car Key Chris": "2232630824"
};

async function initDB() {
try {
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer_phone TEXT,
tracking_number TEXT,
source TEXT,
service TEXT,
duration TEXT,
recording TEXT,
lead_score TEXT,
provider_assigned TEXT,
lead_status TEXT,
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
provider_earnings TEXT DEFAULT '0',
nln_profit TEXT DEFAULT '35',
archived BOOLEAN DEFAULT false,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

const columns = [
["job_amount", "TEXT DEFAULT '0'"],
["lead_cost", "TEXT DEFAULT '35'"],
["provider_earnings", "TEXT DEFAULT '0'"],
["nln_profit", "TEXT DEFAULT '35'"],
["notes", "TEXT"],
["archived", "BOOLEAN DEFAULT false"]
];

for (const [name, type] of columns) {
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${name} ${type}`);
}

console.log("✅ DB ready");
} catch (err) {
console.log("DB ERROR:", err);
}
}

initDB();

function money(n) {
return Number(n || 0).toFixed(0);
}

function cleanPhone(phone) {
return String(phone || "").replace(/[^0-9]/g, "");
}

function smsLink(phone, lead) {
const msg =
`NEW LOCKSMITH JOB

Customer Phone: ${lead.customer_phone || "Unknown"}
Service / Call Summary:
${lead.service || "Locksmith Service"}

Job Amount: $${money(lead.job_amount)}
Lead Cost: $${money(lead.lead_cost)}
Status: ${lead.lead_status || "New"}

Call customer ASAP.`;

return "sms:+1" + cleanPhone(phone) + "?body=" + encodeURIComponent(msg);
}

async function getLeads() {
const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);
return result.rows;
}

function baseStyle() {
return `
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f8fb;font-family:Arial;color:#0f172a}
.wrap{max-width:1150px;margin:0 auto;padding:18px;padding-bottom:115px}
.top,.card{background:white;border-radius:28px;padding:22px;margin-bottom:18px;box-shadow:0 12px 30px rgba(0,0,0,.08)}
.logo{display:flex;align-items:center;gap:14px}
.logo-box{width:72px;height:72px;border-radius:22px;background:linear-gradient(135deg,#0b2a67,#06b6d4);color:white;display:flex;align-items:center;justify-content:center;font-size:34px}
.logo h1{margin:0;font-size:28px}
.logo p{margin:4px 0 0;color:#64748b;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px}
.stat{background:#f8fafc;border-radius:22px;padding:20px;box-shadow:0 10px 25px rgba(0,0,0,.05)}
.stat h2{margin:0;font-size:34px}
.stat p{margin:6px 0 0;color:#64748b;font-weight:800}
.info{margin:10px 0;font-size:18px;line-height:1.45;font-weight:700;white-space:pre-wrap}
.info b{color:#334155}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
input,select,textarea{width:100%;padding:16px;border-radius:16px;border:1px solid #cbd5e1;font-size:17px;font-weight:700}
textarea{min-height:120px}
.full{grid-column:1 / -1}
.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
button,.btn{border:none;border-radius:18px;padding:17px;font-size:18px;font-weight:900;text-align:center;text-decoration:none;color:white;cursor:pointer;display:block;width:100%}
.blue{background:linear-gradient(135deg,#2563eb,#1d4ed8)}
.green{background:linear-gradient(135deg,#22c55e,#15803d)}
.purple{background:linear-gradient(135deg,#8b5cf6,#6d28d9)}
.orange{background:linear-gradient(135deg,#f59e0b,#d97706);color:#111827}
.gray{background:linear-gradient(135deg,#64748b,#475569)}
.red{background:linear-gradient(135deg,#ef4444,#dc2626)}
.teal{background:linear-gradient(135deg,#06b6d4,#0891b2)}
.quickTextBox{margin-top:20px;padding:18px;border-radius:26px;background:linear-gradient(135deg,#f8fafc,#e0e7ff);border:1px solid #dbe3f0;box-shadow:0 14px 35px rgba(15,23,42,.12)}
.quickTitle{font-size:22px;font-weight:900;color:#111827;text-align:center;margin-bottom:14px}
.providerTextGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.providerTextBtn{padding:18px;border-radius:20px;color:white;text-align:center;text-decoration:none;font-size:17px;font-weight:900;box-shadow:0 10px 22px rgba(0,0,0,.18)}
.providerTextBtn:active{transform:scale(.97)}
.maxBtn{background:linear-gradient(135deg,#2563eb,#1d4ed8)}
.drehBtn{background:linear-gradient(135deg,#7c3aed,#5b21b6)}
.teeBtn{background:linear-gradient(135deg,#06b6d4,#0891b2)}
.robynBtn{background:linear-gradient(135deg,#22c55e,#15803d)}
.chrisBtn{background:linear-gradient(135deg,#111827,#334155)}
.bottom{position:fixed;left:0;right:0;bottom:0;background:white;display:flex;justify-content:space-around;padding:13px 8px;box-shadow:0 -8px 25px rgba(0,0,0,.13);z-index:999}
.bottom a{color:#334155;text-decoration:none;font-weight:900;font-size:16px;text-align:center}
@media(max-width:800px){.stats,.form-grid,.providerTextGrid{grid-template-columns:1fr}.btn-grid{grid-template-columns:1fr 1fr}.logo h1{font-size:23px}}
</style>`;
}

function adminPage(content) {
return `
<!DOCTYPE html>
<html>
<head>
<title>NLN Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseStyle()}
</head>
<body>
<div class="wrap">${content}</div>
<div class="bottom">
<a href="/admin?token=${ADMIN_TOKEN}">🏠<br>Admin</a>
<a href="/providers?token=${ADMIN_TOKEN}">👷<br>Providers</a>
<a href="/calls?token=${ADMIN_TOKEN}">☎️<br>Calls</a>
<a href="/settings?token=${ADMIN_TOKEN}">⚙️<br>Settings</a>
</div>
</body>
</html>`;
}

function providerPage(content, provider) {
const safe = encodeURIComponent(provider);
return `
<!DOCTYPE html>
<html>
<head>
<title>${provider} Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseStyle()}
</head>
<body>
<div class="wrap">${content}</div>
<div class="bottom">
<a href="/provider/${safe}">📋<br>My Jobs</a>
<a href="/provider/${safe}?filter=new">🆕<br>New</a>
<a href="/provider/${safe}?filter=completed">✅<br>Done</a>
<a href="/provider/${safe}/earnings">💵<br>Earnings</a>
</div>
</body>
</html>`;
}

function requireAdmin(req, res) {
const token = req.query.token || req.body.token;
if (token !== ADMIN_TOKEN) {
res.send(`<h2 style="font-family:Arial;text-align:center;margin-top:80px;">Locked Admin Dashboard</h2>`);
return false;
}
return true;
}

function providerDispatchButtons(lead) {
const rows = Object.keys(providers).map(name => {
const cls =
name === "Max" ? "maxBtn" :
name === "Dreh" ? "drehBtn" :
name === "Tee" ? "teeBtn" :
name === "Robyn" ? "robynBtn" : "chrisBtn";

return `
<a class="providerTextBtn ${cls}" href="${smsLink(providers[name], lead)}">💬 Text ${name}</a>

<form method="POST" action="/lead/${lead.id}/send/${encodeURIComponent(name)}">
<input type="hidden" name="token" value="${ADMIN_TOKEN}">
<button class="providerTextBtn ${cls}" type="submit">🚀 Send To ${name}</button>
</form>
`;
}).join("");

return `
<div class="quickTextBox">
<div class="quickTitle">🚀 Send Job To Provider Dashboard</div>
<div class="providerTextGrid">${rows}</div>
</div>`;
}

function leadCard(lead, admin = true) {
const providerEarnings = Number(lead.job_amount || 0) - Number(lead.lead_cost || 0);
const nlnProfit = Number(lead.lead_cost || 0);

let options = Object.keys(providers).map(p =>
`<option value="${p}" ${lead.provider_assigned === p ? "selected" : ""}>${p}</option>`
).join("");

return `
<div class="card">
<div class="info"><b>Lead #:</b> ${lead.id}</div>
<div class="info"><b>Customer Phone:</b> ${lead.customer_phone || "Unknown"}</div>
<div class="info"><b>Tracking Number:</b> ${lead.tracking_number || ""}</div>
<div class="info"><b>Source:</b> ${lead.source || ""}</div>
<div class="info"><b>Service / Call Summary:</b> ${lead.service || "Locksmith Service"}</div>
<div class="info"><b>Provider:</b> ${lead.provider_assigned || "Not Assigned"}</div>
<div class="info"><b>Status:</b> ${lead.lead_status || "New"}</div>
<div class="info"><b>Job Amount:</b> $${money(lead.job_amount)}</div>
<div class="info"><b>Lead Cost:</b> $${money(lead.lead_cost)}</div>
<div class="info"><b>Provider Earnings:</b> $${money(providerEarnings)}</div>
<div class="info"><b>NLN Profit:</b> $${money(nlnProfit)}</div>
<div class="info"><b>Notes:</b> ${lead.notes || ""}</div>

${admin ? `
<form method="POST" action="/lead/${lead.id}/pricing">
<input type="hidden" name="token" value="${ADMIN_TOKEN}">
<div class="form-grid">
<select name="provider_assigned">${options}</select>
<input name="job_amount" value="${lead.job_amount || 0}" placeholder="Job Amount">
<input name="lead_cost" value="${lead.lead_cost || 35}" placeholder="Lead Cost">
<textarea class="full" name="service" placeholder="Edit service / call summary before sending">${lead.service || ""}</textarea>
<textarea class="full" name="notes" placeholder="Admin Notes">${lead.notes || ""}</textarea>
</div>
<div class="btn-grid">
<button class="blue" type="submit">💾 Save Edits</button>
<a class="btn green" href="tel:${cleanPhone(lead.customer_phone)}">📞 Call Customer</a>
</div>
</form>

${providerDispatchButtons(lead)}
` : ""}

<div class="btn-grid">
<form method="POST" action="/lead/${lead.id}/status">
<input type="hidden" name="status" value="Accepted">
<button class="green">✅ Accept</button>
</form>

<form method="POST" action="/lead/${lead.id}/status">
<input type="hidden" name="status" value="On The Way">
<button class="purple">🚗 On The Way</button>
</form>

<form method="POST" action="/lead/${lead.id}/status">
<input type="hidden" name="status" value="Completed">
<button class="teal">✅ Complete</button>
</form>

<form method="POST" action="/lead/${lead.id}/status">
<input type="hidden" name="status" value="Paid">
<button class="orange">💵 Paid</button>
</form>

${admin ? `
<form method="POST" action="/lead/${lead.id}/archive">
<input type="hidden" name="token" value="${ADMIN_TOKEN}">
<button class="gray">📦 Archive</button>
</form>

<form method="POST" action="/lead/${lead.id}/delete">
<input type="hidden" name="token" value="${ADMIN_TOKEN}">
<button class="red">🗑 Delete</button>
</form>
` : ""}
</div>
</div>`;
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({ success: true, status: "online" });
});

app.get("/admin", async (req, res) => {
if (!requireAdmin(req, res)) return;

const leads = await getLeads();

const totalLeads = leads.length;
const totalJobAmount = leads.reduce((sum, l) => sum + Number(l.job_amount || 0), 0);
const totalLeadCost = leads.reduce((sum, l) => sum + Number(l.lead_cost || 0), 0);
const completed = leads.filter(l => String(l.lead_status).toLowerCase().includes("complete")).length;

let content = `
<div class="top">
<div class="logo">
<div class="logo-box">🔐</div>
<div>
<h1>NLN Admin Dashboard</h1>
<p>Citywide Routing Control Center</p>
</div>
</div>
<div class="stats">
<div class="stat"><h2>${totalLeads}</h2><p>Total Leads</p></div>
<div class="stat"><h2>$${money(totalJobAmount)}</h2><p>Job Amounts</p></div>
<div class="stat"><h2>$${money(totalLeadCost)}</h2><p>NLN Profit</p></div>
<div class="stat"><h2>${completed}</h2><p>Completed</p></div>
</div>
</div>`;

if (!leads.length) content += `<div class="card"><h2>No leads yet.</h2></div>`;
leads.forEach(lead => content += leadCard(lead, true));

res.send(adminPage(content));
});

app.get("/providers", (req, res) => {
if (!requireAdmin(req, res)) return;

let content = `<div class="top"><h1>👷 Provider Dashboards</h1><p>Providers only see assigned jobs.</p></div><div class="card">`;

Object.keys(providers).forEach(p => {
content += `<a class="btn blue" style="margin-bottom:12px;" href="/provider/${encodeURIComponent(p)}">Open ${p} Dashboard</a>`;
});

content += `</div>`;
res.send(adminPage(content));
});

app.get("/calls", async (req, res) => {
if (!requireAdmin(req, res)) return;
const leads = await getLeads();
let content = `<div class="top"><h1>☎️ Calls / Leads</h1></div>`;
leads.forEach(lead => content += leadCard(lead, true));
res.send(adminPage(content));
});

app.get("/settings", (req, res) => {
if (!requireAdmin(req, res)) return;

let content = `
<div class="top"><h1>⚙️ Settings</h1><p>Provider dispatch buttons are active.</p></div>
<div class="card">
<h2>Providers</h2>
${Object.entries(providers).map(([name, phone]) => `<p><b>${name}:</b> ${phone}</p>`).join("")}
</div>`;

res.send(adminPage(content));
});

app.get("/provider/:provider", async (req, res) => {
const provider = req.params.provider;
const filter = req.query.filter || "";

let query = `
SELECT *
FROM leads
WHERE archived = false
AND provider_assigned = $1
`;

if (filter === "new") query += ` AND (lead_status IS NULL OR lead_status = 'New' OR lead_status = 'Dispatched')`;
if (filter === "completed") query += ` AND lead_status = 'Completed'`;

query += ` ORDER BY created_at DESC`;

const result = await pool.query(query, [provider]);
const leads = result.rows;

let content = `<div class="top"><h1>👷 ${provider} Dashboard</h1><p>Only your assigned jobs show here.</p></div>`;

if (!leads.length) content += `<div class="card"><h2>No jobs assigned yet.</h2></div>`;
leads.forEach(lead => content += leadCard(lead, false));

res.send(providerPage(content, provider));
});

app.get("/provider/:provider/earnings", async (req, res) => {
const provider = req.params.provider;

const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
AND provider_assigned = $1
ORDER BY created_at DESC
`, [provider]);

const leads = result.rows;
const earnings = leads.reduce((sum, l) => sum + (Number(l.job_amount || 0) - Number(l.lead_cost || 0)), 0);

let content = `
<div class="top">
<h1>💵 ${provider} Earnings</h1>
<div class="stats">
<div class="stat"><h2>${leads.length}</h2><p>Total Jobs</p></div>
<div class="stat"><h2>$${money(earnings)}</h2><p>Total Earnings</p></div>
</div>
</div>`;

leads.forEach(lead => content += leadCard(lead, false));

res.send(providerPage(content, provider));
});

app.post("/lead/new", async (req, res) => {
try {
const data = req.body;

const result = await pool.query(`
INSERT INTO leads (
customer_phone, tracking_number, source, service, duration, recording,
lead_score, provider_assigned, lead_status, notes,
job_amount, lead_cost, provider_earnings, nln_profit
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
RETURNING *
`, [
data.customer_phone || data.phone || "",
data.tracking_number || "",
data.source || "Manual",
data.service || data.notes || "Locksmith Service",
data.duration || "",
data.recording || "",
data.lead_score || "",
data.provider_assigned || "",
data.lead_status || "New",
data.notes || "",
data.job_amount || "0",
data.lead_cost || "35",
data.provider_earnings || "0",
data.nln_profit || "35"
]);

res.json({ success: true, lead: result.rows[0] });
} catch (err) {
res.status(500).json({ success: false, error: err.message });
}
});

app.post("/lead/:id/pricing", async (req, res) => {
if (!requireAdmin(req, res)) return;

const id = req.params.id;
const jobAmount = Number(req.body.job_amount || 0);
const leadCost = Number(req.body.lead_cost || 0);
const providerEarnings = jobAmount - leadCost;
const nlnProfit = leadCost;

await pool.query(`
UPDATE leads
SET provider_assigned = $1,
job_amount = $2,
lead_cost = $3,
provider_earnings = $4,
nln_profit = $5,
service = $6,
notes = $7
WHERE id = $8
`, [
req.body.provider_assigned || "",
String(jobAmount),
String(leadCost),
String(providerEarnings),
String(nlnProfit),
req.body.service || "",
req.body.notes || "",
id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/lead/:id/send/:provider", async (req, res) => {
if (!requireAdmin(req, res)) return;

const id = req.params.id;
const provider = req.params.provider;

await pool.query(`
UPDATE leads
SET provider_assigned = $1,
lead_status = 'Dispatched'
WHERE id = $2
`, [provider, id]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/lead/:id/status", async (req, res) => {
const id = req.params.id;
const status = req.body.status || "New";

await pool.query(`
UPDATE leads
SET lead_status = $1
WHERE id = $2
`, [status, id]);

res.redirect(req.get("referer") || `/admin?token=${ADMIN_TOKEN}`);
});

app.post("/lead/:id/archive", async (req, res) => {
if (!requireAdmin(req, res)) return;

await pool.query(`
UPDATE leads
SET archived = true
WHERE id = $1
`, [req.params.id]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/lead/:id/delete", async (req, res) => {
if (!requireAdmin(req, res)) return;

await pool.query(`
DELETE FROM leads
WHERE id = $1
`, [req.params.id]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("✅ Citywide Routing server running on port " + PORT);
});
