const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

const providers = {
Max: "+14436792242",
Dreh: "+12024125443",
Tee: "+14104199281",
Robyn: "+14435781686",
"Car Key Chris": "+12232630824"
};

// ======================================================
// DATABASE
// ======================================================

async function initDB() {
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer_name TEXT,
customer_phone TEXT,
service TEXT,
source TEXT,
provider_assigned TEXT,
lead_status TEXT DEFAULT 'NEW',
recording TEXT,
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

const columns = [
"customer_name TEXT",
"customer_phone TEXT",
"service TEXT",
"source TEXT",
"provider_assigned TEXT",
"lead_status TEXT DEFAULT 'NEW'",
"recording TEXT",
"notes TEXT",
"job_amount TEXT DEFAULT '0'",
"lead_cost TEXT DEFAULT '35'"
];

for (const col of columns) {
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col}`);
}
}

// ======================================================
// HELPERS
// ======================================================

function money(v) {
return "$" + Number(v || 0).toLocaleString();
}

function safe(v) {
return String(v ?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}

function providerCode(name) {
const phone = providers[name] || "";
return phone.replace(/\D/g, "").slice(-4);
}

function cleanStatus(v) {
const s = String(v || "").toUpperCase().trim();
if (s === "ASSIGNED") return "ASSIGNED";
if (s === "ENROUTE" || s === "EN ROUTE") return "ENROUTE";
if (s === "ARRIVED") return "ARRIVED";
if (s === "COMPLETED" || s === "COMPLETE") return "COMPLETED";
if (s === "PAID" || s === "CLOSED") return "PAID";
if (s === "DECLINED") return "DECLINED";
return "NEW";
}

async function getLeads() {
const r = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

return r.rows.map(l => ({
...l,
clean_status: cleanStatus(l.lead_status)
}));
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) return res.status(401).send("ADMIN LOCKED");
next();
}

function requireProvider(req, res, next) {
const name = req.params.name;
const code = req.query.code;

if (!providers[name]) return res.status(404).send("Provider not found");

if (code !== providerCode(name)) {
return res.status(401).send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{background:#020617;color:white;font-family:Arial;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{width:360px;background:#071226;border:1px solid #1e293b;border-radius:24px;padding:28px}
input{width:100%;padding:16px;border:none;border-radius:14px;margin-top:14px;background:#0f172a;color:white;font-size:18px;box-sizing:border-box}
button{width:100%;padding:16px;border:none;border-radius:14px;margin-top:18px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:white;font-weight:900;font-size:18px}
</style>
</head>
<body>
<form class="box" method="GET" action="/provider/${encodeURIComponent(name)}">
<h1>Provider Login</h1>
<p>Enter your 4 digit access code.</p>
<input name="code" maxlength="4" placeholder="4 digit code">
<button>Login</button>
</form>
</body>
</html>
`);
}

next();
}

// ======================================================
// ROUTES
// ======================================================

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.send("NLN SERVER RUNNING");
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
source,
provider_assigned,
lead_status,
recording,
notes,
job_amount,
lead_cost
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [
req.body.customer_name || "Unknown",
req.body.customer_phone || "Unknown",
req.body.service || "Locksmith Service",
req.body.source || "Manual",
req.body.provider_assigned || "",
req.body.provider_assigned ? "ASSIGNED" : "NEW",
req.body.recording || "",
req.body.notes || "",
req.body.job_amount || "0",
req.body.lead_cost || "35"
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/update/:id", requireAdmin, async (req, res) => {
const status = cleanStatus(req.body.quickStatus || req.body.lead_status);

await pool.query(`
UPDATE leads
SET provider_assigned=$1,
lead_status=$2,
job_amount=$3,
lead_cost=$4,
recording=$5,
notes=$6
WHERE id=$7
`, [
req.body.provider_assigned || "",
status,
req.body.job_amount || "0",
req.body.lead_cost || "35",
req.body.recording || "",
req.body.notes || "",
req.params.id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/status/:id", requireAdmin, async (req, res) => {
const status = cleanStatus(req.body.status);
await pool.query("UPDATE leads SET lead_status=$1 WHERE id=$2", [status, req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/provider/:name/status/:id", requireProvider, async (req, res) => {
const name = req.params.name;
const status = cleanStatus(req.body.status);

await pool.query(
"UPDATE leads SET provider_assigned=$1, lead_status=$2 WHERE id=$3",
[name, status, req.params.id]
);

res.redirect(`/provider/${encodeURIComponent(name)}?code=${providerCode(name)}`);
});

app.post("/provider/:name/accept/:id", requireProvider, async (req, res) => {
const name = req.params.name;

await pool.query(
"UPDATE leads SET provider_assigned=$1, lead_status='ASSIGNED' WHERE id=$2",
[name, req.params.id]
);

res.redirect(`/provider/${encodeURIComponent(name)}?code=${providerCode(name)}`);
});

app.post("/provider/:name/decline/:id", requireProvider, async (req, res) => {
const name = req.params.name;

await pool.query(
"UPDATE leads SET lead_status='DECLINED' WHERE id=$1",
[req.params.id]
);

res.redirect(`/provider/${encodeURIComponent(name)}?code=${providerCode(name)}`);
});

// ======================================================
// CSS
// ======================================================

function css() {
return `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:Inter,Arial;background:#020817;color:white;overflow-x:hidden}
.dashboard{display:flex;min-height:100vh}
.sidebar{width:260px;background:#030b1a;border-right:1px solid #162033;padding:24px 18px;position:fixed;top:0;left:0;bottom:0;overflow:auto}
.logo{font-size:36px;font-weight:900;margin-bottom:30px}
.logo span{display:block;font-size:12px;color:#64748b;margin-top:4px}
.menu{display:flex;flex-direction:column;gap:10px}
.menu a{text-decoration:none;color:#cbd5e1;padding:14px 16px;border-radius:14px;font-weight:700;display:flex;align-items:center;gap:12px}
.menu a.active,.menu a:hover{background:linear-gradient(90deg,#2563eb,#7c3aed);color:white}
.main{margin-left:260px;width:calc(100% - 260px);padding:24px}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.topbar-left h1{margin:0;font-size:38px;font-weight:900}
.topbar-left p{color:#94a3b8;margin-top:6px}
.topbar-right{display:flex;align-items:center;gap:18px}
.avatar{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:900}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:24px}
.stat-card{background:#071225;border:1px solid #1e293b;border-radius:22px;padding:24px}
.stat-card h2{margin:0;font-size:42px}
.stat-card p{color:#94a3b8;margin-top:8px}
.action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:24px}
.action-card{background:#071225;border-radius:22px;padding:26px;border:1px solid #1e293b;text-align:center;color:white;text-decoration:none;font-weight:900}
.action-icon{font-size:42px;margin-bottom:16px}
.grid-2{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;margin-bottom:24px}
.panel{background:#071225;border-radius:24px;border:1px solid #1e293b;padding:24px}
.fake-chart{height:240px;border-radius:18px;background:linear-gradient(180deg,#7c3aed,#2563eb);margin-top:20px;opacity:.85}
.jobs{display:flex;flex-direction:column;gap:16px}
.job-card{display:grid;grid-template-columns:90px 1fr 190px;gap:14px;align-items:center;background:#06101f;border:1px solid #1f2d3d;border-radius:20px;padding:16px}
.status{padding:10px 12px;border-radius:12px;text-align:center;font-size:12px;font-weight:900}
.status.NEW{background:#2563eb}
.status.ASSIGNED{background:#f59e0b}
.status.ENROUTE{background:#7c3aed}
.status.ARRIVED{background:#0ea5e9}
.status.COMPLETED{background:#16a34a}
.status.PAID{background:#475569}
.status.DECLINED{background:#991b1b}
.job-title{font-size:22px;font-weight:900;line-height:1.4;word-break:break-word}
.job-sub{color:#94a3b8;margin-top:8px;line-height:1.5;font-size:15px;word-break:break-word}
.job-actions{display:flex;flex-direction:column;gap:8px}
.btn{border:none;border-radius:12px;padding:12px;font-weight:900;cursor:pointer;color:#fff;text-decoration:none;text-align:center;display:block}
.call{background:#2563eb}.text{background:#9333ea}.recording{background:#ea580c}.complete{background:#16a34a}.dark{background:#111827}.red{background:#991b1b}.blue{background:#2563eb}.green{background:#16a34a}.purple{background:#9333ea}.orange{background:#ea580c}
.inline-form{margin:0}
.add-job{background:#071225;padding:24px;border-radius:24px;border:1px solid #1e293b;margin-top:24px}
.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
input,select,textarea{width:100%;padding:16px;border:none;border-radius:14px;margin-top:14px;background:#0f172a;color:white;font-size:16px}
.submit{width:100%;padding:16px;border:none;border-radius:14px;margin-top:18px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:white;font-size:18px;font-weight:900}
.provider-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.provider-card{background:#06101f;border:1px solid #1f2d3d;border-radius:18px;padding:16px}
.mobile-nav{display:none}
@media(max-width:900px){
.sidebar{display:none}
.main{margin-left:0;width:100%;padding:16px;padding-bottom:120px}
.topbar{flex-direction:column;align-items:flex-start;gap:18px}
.topbar-left h1{font-size:28px}
.stats{grid-template-columns:1fr 1fr}
.action-grid{grid-template-columns:1fr 1fr}
.grid-2{grid-template-columns:1fr}
.form-grid{grid-template-columns:1fr}
.provider-grid{grid-template-columns:1fr}
.job-card{grid-template-columns:1fr;align-items:flex-start}
.job-title{font-size:18px;line-height:1.45}
.job-sub{font-size:14px}
.job-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}
.mobile-nav{position:fixed;left:14px;right:14px;bottom:16px;height:78px;background:rgba(4,12,28,.96);border:1px solid #1e293b;border-radius:26px;display:flex;justify-content:space-around;align-items:center;z-index:999}
.mobile-nav a{color:#fff;text-decoration:none;font-size:14px;font-weight:800;display:flex;flex-direction:column;align-items:center;gap:6px}
}
`;
}

// ======================================================
// HTML PARTS
// ======================================================

function renderAdminJob(job) {
return `
<div class="job-card">
<div class="status ${safe(job.clean_status)}">${safe(job.clean_status)}</div>

<div>
<div class="job-title">${safe(job.service || "Locksmith Service")}</div>
<div class="job-sub">${safe(job.customer_name || "Unknown")} • ${safe(job.customer_phone || "No Phone")}</div>
<div class="job-sub">Provider: ${safe(job.provider_assigned || "Not Assigned")} • Amount: ${money(job.job_amount)}</div>
</div>

<div class="job-actions">
<a class="btn call" href="tel:${safe(job.customer_phone)}">Call</a>
<a class="btn text" href="sms:${safe(job.customer_phone)}">Text</a>
<a class="btn recording" href="${safe(job.recording || "#")}">Recording</a>

<form class="inline-form" method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn complete" type="submit">Complete</button>
</form>

<form class="inline-form" method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="PAID">
<button class="btn green" type="submit">Paid</button>
</form>

<form class="inline-form" method="POST" action="/admin/delete/${job.id}?token=${ADMIN_TOKEN}">
<button class="btn red" type="submit">Delete</button>
</form>
</div>
</div>
`;
}

function renderProviderJob(job, providerName) {
return `
<div class="job-card">
<div class="status ${safe(job.clean_status)}">${safe(job.clean_status)}</div>

<div>
<div class="job-title">${safe(job.service || "Locksmith Service")}</div>
<div class="job-sub">${safe(job.customer_name || "Unknown")} • ${safe(job.customer_phone || "No Phone")}</div>
<div class="job-sub">Amount: ${money(job.job_amount)}</div>
</div>

<div class="job-actions">
<a class="btn call" href="tel:${safe(job.customer_phone)}">Call</a>
<a class="btn text" href="sms:${safe(job.customer_phone)}">Text</a>
<a class="btn recording" href="${safe(job.recording || "#")}">Recording</a>

<form class="inline-form" method="POST" action="/provider/${encodeURIComponent(providerName)}/accept/${job.id}?code=${providerCode(providerName)}">
<button class="btn blue" type="submit">Accept</button>
</form>

<form class="inline-form" method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="ENROUTE">
<button class="btn orange" type="submit">En Route</button>
</form>

<form class="inline-form" method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn complete" type="submit">Complete</button>
</form>
</div>
</div>
`;
}

// ======================================================
// ADMIN DASHBOARD
// ======================================================

app.get("/admin", requireAdmin, async (req, res) => {
const leads = await getLeads();

const revenue = leads.reduce((s, l) => s + Number(l.job_amount || 0), 0);
const completed = leads.filter(l => ["COMPLETED", "PAID"].includes(l.clean_status)).length;

res.send(`
<html>
<head>
<title>NLN Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>

<div class="dashboard">
<div class="sidebar">
<div class="logo">NLN<span>CITYWIDE ROUTING</span></div>
<div class="menu">
<a class="active" href="/admin?token=${ADMIN_TOKEN}">📊 Dashboard</a>
<a href="#jobs">💼 Jobs</a>
<a href="#providers">👥 Providers</a>
<a href="#payments">💳 Payments</a>
<a href="#addJob">➕ Add Job</a>
<a href="/health">⚙️ System</a>
</div>
</div>

<div class="main">
<div class="topbar">
<div class="topbar-left">
<h1>Admin Dashboard</h1>
<p>Luxury Dispatch Center</p>
</div>
<div class="topbar-right">
<div>💬</div>
<div>🔔</div>
<div class="avatar">A</div>
</div>
</div>

<div class="stats">
<div class="stat-card"><h2>${leads.length}</h2><p>Total Jobs</p></div>
<div class="stat-card"><h2>${money(revenue)}</h2><p>Revenue</p></div>
<div class="stat-card"><h2>${Object.keys(providers).length}</h2><p>Providers</p></div>
<div class="stat-card"><h2>${completed}</h2><p>Completed</p></div>
</div>

<div class="action-grid">
<a class="action-card" href="#addJob"><div class="action-icon">➕</div>Add Job</a>
<a class="action-card" href="#providers"><div class="action-icon">👥</div>Providers</a>
<a class="action-card" href="#jobs"><div class="action-icon">💼</div>Jobs</a>
<a class="action-card" href="#payments"><div class="action-icon">💳</div>Payments</a>
</div>

<div class="grid-2">
<div class="panel">
<h2>Jobs Overview</h2>
<div class="fake-chart"></div>
</div>

<div class="panel" id="payments">
<h2>Payment Threshold</h2>
<h1 style="font-size:52px">$0</h1>
<p>No balance due</p>
<div style="height:14px;background:#102544;border-radius:999px;overflow:hidden;margin-top:20px">
<div style="height:100%;width:82%;background:#2563eb"></div>
</div>
<button class="submit" style="margin-top:22px">MAKE A PAYMENT</button>
</div>
</div>

<div class="panel" id="providers">
<h2>Providers</h2>
<div class="provider-grid">
${Object.entries(providers).map(([name, phone]) => `
<div class="provider-card">
<h3>${safe(name)}</h3>
<p>${safe(phone)}</p>
<p>Code: <b>${providerCode(name)}</b></p>
<a class="btn call" href="tel:${safe(phone)}">Call</a>
<a class="btn text" href="sms:${safe(phone)}">Text</a>
<a class="btn blue" href="/provider/${encodeURIComponent(name)}?code=${providerCode(name)}">Dashboard</a>
</div>
`).join("")}
</div>
</div>

<div class="panel" id="jobs" style="margin-top:24px">
<h2>Recent Jobs</h2>
<div class="jobs">${leads.map(renderAdminJob).join("") || "<p>No jobs yet.</p>"}</div>
</div>

<div class="add-job" id="addJob">
<h2>Add Job</h2>
<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">
<div class="form-grid">
<input name="customer_name" placeholder="Customer Name">
<input name="customer_phone" placeholder="Customer Phone">
<input name="service" placeholder="Service">
<input name="source" placeholder="Source">
<input name="recording" placeholder="Recording URL">
<input name="job_amount" placeholder="Job Amount">
<input name="lead_cost" placeholder="Lead Cost">
<select name="provider_assigned">
<option value="">Assign Provider</option>
${Object.keys(providers).map(p => `<option value="${safe(p)}">${safe(p)}</option>`).join("")}
</select>
</div>
<textarea name="notes" placeholder="Notes"></textarea>
<button class="submit">Create Job</button>
</form>
</div>
</div>
</div>

<div class="mobile-nav">
<a href="#jobs">💼<span>Jobs</span></a>
<a href="#providers">👥<span>Providers</span></a>
<a href="#payments">💳<span>Pay</span></a>
<a href="javascript:location.reload()">🔄<span>Refresh</span></a>
</div>

</body>
</html>
`);
});

// ======================================================
// PROVIDER DASHBOARD
// ======================================================

app.get("/provider/:name", requireProvider, async (req, res) => {
const name = req.params.name;

const leads = (await getLeads()).filter(l =>
l.provider_assigned === name || l.clean_status === "NEW"
);

const assigned = leads.filter(l => l.provider_assigned === name);
const revenue = assigned.reduce((s, l) => s + Number(l.job_amount || 0), 0);

res.send(`
<html>
<head>
<title>Provider Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>

<div class="dashboard">
<div class="sidebar">
<div class="logo">NLN<span>PROVIDER PANEL</span></div>
<div class="menu">
<a class="active" href="/provider/${encodeURIComponent(name)}?code=${providerCode(name)}">📊 Dashboard</a>
<a href="#jobs">💼 Jobs</a>
<a href="#payments">💳 Payments</a>
<a href="tel:+14435781686">📞 Dispatch</a>
</div>
</div>

<div class="main">
<div class="topbar">
<div class="topbar-left">
<h1>Welcome ${safe(name)}</h1>
<p>Provider Dashboard</p>
</div>
<div class="topbar-right">
<div class="avatar">${safe(name[0])}</div>
</div>
</div>

<div class="stats">
<div class="stat-card"><h2>${leads.length}</h2><p>Visible Jobs</p></div>
<div class="stat-card"><h2>${assigned.length}</h2><p>Assigned</p></div>
<div class="stat-card"><h2>${money(revenue)}</h2><p>Earnings</p></div>
<div class="stat-card"><h2>Online</h2><p>Status</p></div>
</div>

<div class="action-grid">
<a class="action-card" href="tel:+14435781686"><div class="action-icon">📞</div>Call Dispatch</a>
<a class="action-card" href="sms:+14435781686"><div class="action-icon">💬</div>Text Dispatch</a>
<a class="action-card" href="#jobs"><div class="action-icon">💼</div>Jobs</a>
<a class="action-card" href="#payments"><div class="action-icon">💳</div>Payments</a>
</div>

<div class="grid-2">
<div class="panel">
<h2>Earnings Overview</h2>
<div class="fake-chart"></div>
</div>

<div class="panel" id="payments">
<h2>Payment Threshold</h2>
<h1 style="font-size:52px">$0</h1>
<p>No balance due</p>
<div style="height:14px;background:#102544;border-radius:999px;overflow:hidden;margin-top:20px">
<div style="height:100%;width:82%;background:#2563eb"></div>
</div>
<button class="submit" style="margin-top:22px">MAKE A PAYMENT</button>
</div>
</div>

<div class="panel" id="jobs">
<h2>Active / Available Jobs</h2>
<div class="jobs">${leads.map(l => renderProviderJob(l, name)).join("") || "<p>No jobs yet.</p>"}</div>
</div>
</div>
</div>

<div class="mobile-nav">
<a href="#jobs">💼<span>Jobs</span></a>
<a href="tel:+14435781686">📞<span>Dispatch</span></a>
<a href="#payments">💳<span>Pay</span></a>
<a href="javascript:location.reload()">🔄<span>Refresh</span></a>
</div>

</body>
</html>
`);
});

// ======================================================
// START
// ======================================================

initDB().then(() => {
app.listen(PORT, () => {
console.log("NLN LUXURY SERVER RUNNING");
});
});
