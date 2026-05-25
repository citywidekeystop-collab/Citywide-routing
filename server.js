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
Robyn: "+14435781866",
"Car Key Chris": "+12232630824"
};

async function initDB() {
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer_name TEXT,
customer_phone TEXT,
tracking_number TEXT,
source TEXT,
service TEXT,
recording TEXT,
provider_assigned TEXT,
lead_status TEXT DEFAULT 'new',
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
provider_earnings TEXT DEFAULT '0',
nln_profit TEXT DEFAULT '0',
archived BOOLEAN DEFAULT false,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

const columns = [
"customer_name TEXT",
"customer_phone TEXT",
"tracking_number TEXT",
"source TEXT",
"service TEXT",
"recording TEXT",
"provider_assigned TEXT",
"lead_status TEXT DEFAULT 'new'",
"notes TEXT",
"job_amount TEXT DEFAULT '0'",
"lead_cost TEXT DEFAULT '35'",
"provider_earnings TEXT DEFAULT '0'",
"nln_profit TEXT DEFAULT '0'",
"archived BOOLEAN DEFAULT false"
];

for (const col of columns) {
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${col}`);
}
}

function providerCode(name) {
const phone = providers[name] || "";
return phone.replace(/\D/g, "").slice(-4);
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) return res.status(401).send("Admin Locked");
next();
}

function requireProviderAccess(req, res, next) {
const name = req.params.name;
const code = req.query.code;

if (!providers[name]) return res.status(404).send("Provider not found");

if (code !== providerCode(name)) {
return res.status(401).send(`
<div style="font-family:Arial;padding:30px;background:#050b14;color:white;min-height:100vh">
<h1>NLN Provider Login</h1>
<p>Enter your 4 digit access code.</p>
<form method="GET" action="/provider/${encodeURIComponent(name)}">
<input name="code" maxlength="4" placeholder="4 digit code" style="padding:14px;font-size:20px;border-radius:10px;border:1px solid #333">
<button style="padding:14px 18px;border:0;border-radius:10px;background:#2563eb;color:white;font-weight:900">Login</button>
</form>
</div>
`);
}

next();
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function safe(v) {
return String(v ?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}

function statusClean(s) {
const x = String(s || "").toLowerCase().trim();
if (x === "assigned") return "assigned";
if (x === "enroute" || x === "en route") return "enroute";
if (x === "completed" || x === "complete") return "completed";
if (x === "paid" || x === "closed") return "paid";
return "new";
}

function profit(l) {
return Number(l.job_amount || 0) - Number(l.lead_cost || 0);
}

async function getLeads() {
const result = await pool.query(`
SELECT *
FROM leads
WHERE archived=false OR archived IS NULL
ORDER BY id DESC
`);

return result.rows.map(l => ({
...l,
clean_status: statusClean(l.lead_status)
}));
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({ ok: true, app: "NLN Dashboard Running" });
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
await pool.query(`
INSERT INTO leads (
customer_name, customer_phone, source, service, recording,
provider_assigned, lead_status, job_amount, lead_cost, notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [
req.body.customer_name || "Customer",
req.body.customer_phone || "Unknown",
req.body.source || "Manual",
req.body.service || "Locksmith Service",
req.body.recording || "",
req.body.provider_assigned || "",
req.body.provider_assigned ? "assigned" : "new",
req.body.job_amount || "0",
req.body.lead_cost || "35",
req.body.notes || ""
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/update/:id", requireAdmin, async (req, res) => {
const status = statusClean(req.body.quickStatus || req.body.lead_status);
const jobAmount = Number(req.body.job_amount || 0);
const leadCost = Number(req.body.lead_cost || 0);
const nlnProfit = jobAmount - leadCost;

await pool.query(`
UPDATE leads
SET provider_assigned=$1,
lead_status=$2,
job_amount=$3,
lead_cost=$4,
provider_earnings=$5,
nln_profit=$6,
notes=$7,
recording=$8
WHERE id=$9
`, [
req.body.provider_assigned || "",
status,
String(jobAmount),
String(leadCost),
String(Math.max(0, nlnProfit)),
String(nlnProfit),
req.body.notes || "",
req.body.recording || "",
req.params.id
]);

res.redirect(req.body.return_to || `/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

function layout({ title, role, name, body }) {
return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#050b14;color:#fff;font-family:Arial,Helvetica,sans-serif}
.app{display:flex;min-height:100vh;background:radial-gradient(circle at top,#10213a,#050b14 55%)}
.sidebar{width:240px;background:#06101d;border-right:1px solid #1f2d3d;position:fixed;top:0;bottom:0;left:0;padding:22px}
.logo{font-size:38px;font-weight:900;font-style:italic;letter-spacing:-2px}
.sublogo{font-size:12px;font-weight:900}
.nav-title{font-size:11px;color:#94a3b8;margin:26px 0 8px;text-transform:uppercase}
.nav a{display:flex;justify-content:space-between;align-items:center;color:#cbd5e1;text-decoration:none;padding:12px 13px;border-radius:10px;margin:5px 0;font-size:14px}
.nav a.active,.nav a:hover{background:linear-gradient(135deg,#0067ff,#6d28d9);color:#fff}
.badge{background:#155dfc;border-radius:999px;padding:3px 8px;font-size:11px}
.help{position:absolute;bottom:20px;left:16px;right:16px;background:#071827;border:1px solid #1f2d3d;border-radius:14px;padding:16px}
.help button{width:100%;padding:12px;border:0;border-radius:8px;background:#0b63f6;color:white;font-weight:900}
.main{margin-left:240px;width:calc(100% - 240px)}
.topbar{height:70px;background:#050910;border-bottom:1px solid #1f2d3d;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:10}
.topbar h2{margin:0;font-size:20px}
.user{display:flex;align-items:center;gap:12px}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#22c55e);display:grid;place-items:center;font-weight:900}
.content{padding:22px}
.hero{background:linear-gradient(135deg,#071827,#08111f);border:1px solid #1f2d3d;border-radius:14px;padding:26px;margin-bottom:18px;display:flex;justify-content:space-between;gap:16px}
.hero h1{margin:0 0 8px;font-size:28px}
.hero p{margin:0;color:#cbd5e1}
.metric-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.metric,.panel,.tool,.job,.provider-card{background:#07111f;border:1px solid #1f2d3d;border-radius:12px;padding:18px;box-shadow:0 20px 50px #0004}
.metric h3{margin:0;font-size:26px}
.metric p{margin:6px 0 0;color:#94a3b8}
.green-text{color:#22c55e}.red-text{color:#ef4444}
.action-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:14px;margin-bottom:18px}
.action{background:#07111f;border:1px solid #1f2d3d;border-radius:12px;padding:20px 10px;text-align:center;text-decoration:none;color:white;font-weight:900}
.action .icon{font-size:30px;display:block;margin-bottom:10px}
.grid-2{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-bottom:18px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:18px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}
.panel h3{margin-top:0}
.chart{height:190px;border-radius:12px;background:linear-gradient(180deg,#111827,#0b1220);position:relative;overflow:hidden}
.chart:after{content:"";position:absolute;left:20px;right:20px;bottom:25px;height:120px;background:linear-gradient(135deg,transparent 10%,#7c3aed 40%,#2563eb 90%);clip-path:polygon(0 90%,15% 65%,30% 70%,45% 35%,60% 50%,75% 25%,100% 10%,100% 100%,0 100%);opacity:.85}
.threshold-bar{height:12px;background:#122033;border-radius:999px;overflow:hidden;margin:18px 0}
.threshold-fill{height:100%;width:92%;background:#0b63f6;border-radius:999px}
.big-money{font-size:30px;font-weight:900;color:#22c55e;text-align:center}
.btn,.small-btn{display:inline-block;border:0;text-decoration:none;color:white;padding:11px 14px;border-radius:8px;font-weight:900;text-align:center;cursor:pointer;margin:2px}
.blue{background:#0b63f6}.green{background:#16a34a}.purple{background:#7c3aed}.red{background:#991b1b}.orange{background:#ea580c}.dark{background:#111827}.teal{background:#0f766e}
.job{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-bottom:10px}
.status{border-radius:6px;padding:6px 8px;font-size:11px;font-weight:900;text-transform:uppercase}
.new{background:#0b63f6}.assigned{background:#d97706}.enroute{background:#7c3aed}.completed{background:#16a34a}.paid{background:#475569}
.quick-tools{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tool{text-decoration:none;color:white;display:block}
.tool small{display:block;color:#94a3b8;margin-top:4px}
table{width:100%;border-collapse:collapse}
td{padding:10px;border-bottom:1px solid #1f2d3d}
input,select,textarea{width:100%;background:#081827;color:white;border:1px solid #1f2d3d;border-radius:9px;padding:12px;margin:7px 0}
textarea{min-height:75px}
.card-form{background:#07111f;border:1px solid #1f2d3d;border-radius:12px;padding:16px;margin-top:14px}
.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.provider-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.mobile-nav{display:none}
@media(max-width:1000px){
.sidebar{display:none}.main{margin-left:0;width:100%}.topbar{height:auto;padding:14px}.content{padding:14px 12px 90px}
.hero{display:block}.metric-row,.grid-2,.grid-3,.grid-4,.action-grid,.quick-tools,.provider-grid,.form-grid{grid-template-columns:1fr 1fr}
.job{grid-template-columns:1fr}.mobile-nav{display:flex;position:fixed;bottom:12px;left:12px;right:12px;background:#07111f;border:1px solid #1f2d3d;border-radius:18px;justify-content:space-around;padding:12px;z-index:99}
.mobile-nav a{color:white;text-decoration:none;font-size:12px;font-weight:900}
}
</style>
</head>
<body>
<div class="app">
<aside class="sidebar">
<div class="logo">NLN</div>
<div class="sublogo">CITYWIDE ROUTING</div>

<div class="nav-title">Dashboard</div>
<div class="nav">
<a class="active" href="/${role === "admin" ? `admin?token=${ADMIN_TOKEN}` : `provider/${encodeURIComponent(name)}?code=${providerCode(name)}`}">Overview</a>
<a href="#jobs">Jobs</a>
<a href="#earnings">Earnings</a>
<a href="#payments">Wallet & Payments</a>
<a href="#recordings">Recordings</a>
<a href="#tools">Tools</a>
${role === "admin" ? `<a href="#providers">Providers</a><a href="#addJob">Add Job</a>` : ""}
</div>

<div class="help">
<b>NLN</b> <small>CITYWIDE ROUTING</small>
<p style="color:#cbd5e1;font-size:13px">We drive the work. You drive the mission.</p>
<button>Need Help?</button>
</div>
</aside>

<main class="main">
<div class="topbar">
<h2>${title}</h2>
<div class="user">
<span>💬</span><span>🔔</span>
<div class="avatar">${safe((name || "A")[0])}</div>
<div><b>${safe(name)}</b><br><small style="color:#22c55e">● Online</small></div>
</div>
</div>
<div class="content">${body}</div>
</main>
</div>
<div class="mobile-nav"><a href="#jobs">Jobs</a><a href="#tools">Tools</a><a href="#payments">Pay</a><a href="/${role === "admin" ? `admin?token=${ADMIN_TOKEN}` : `provider/${encodeURIComponent(name)}?code=${providerCode(name)}`}">Refresh</a></div>
</body>
</html>`;
}

function paymentPanel(threshold = 1000, balance = 0) {
return `
<div class="panel" id="payments">
<h3>🌈 Payment Threshold</h3>
<div class="big-money">${money(balance)}</div>
<p style="text-align:center;color:#cbd5e1">No balance due</p>
<div class="threshold-bar"><div class="threshold-fill"></div></div>
<p>Your entire ${money(threshold)} payment threshold is available. <a style="color:#60a5fa">Edit</a></p>
<p style="color:#94a3b8">Payment system placeholder like Google Ads threshold.</p>
<a class="btn blue" style="width:100%" href="#">MAKE A PAYMENT</a>
</div>`;
}

function jobCard(l) {
const customerPhone = l.customer_phone || "Unknown";
const providerPhone = providers[l.provider_assigned] || "";
return `
<div class="job">
<span class="status ${l.clean_status}">${l.clean_status}</span>
<div>
<b>${safe(l.service || "Locksmith Service")}</b><br>
<small style="color:#94a3b8">${safe(l.customer_name || "Customer")} • ${safe(customerPhone)}</small>
</div>
<div>
<a class="small-btn blue" href="tel:${safe(customerPhone)}">Call</a>
<a class="small-btn purple" href="sms:${safe(customerPhone)}">Text</a>
${l.recording ? `<a class="small-btn orange" href="${safe(l.recording)}">Recording</a>` : ""}
${providerPhone ? `<a class="small-btn teal" href="tel:${safe(providerPhone)}">Provider</a>` : ""}
</div>
</div>`;
}

app.get("/admin", requireAdmin, async (req, res) => {
const leads = await getLeads();
const revenue = leads.reduce((s, l) => s + Number(l.job_amount || 0), 0);
const costs = leads.reduce((s, l) => s + Number(l.lead_cost || 0), 0);
const totalProfit = revenue - costs;
const completed = leads.filter(l => ["completed", "paid"].includes(l.clean_status)).length;

const body = `
<div class="hero">
<div><h1>Welcome back, Admin! ✅</h1><p>Here’s what’s happening across dispatch today.</p></div>
</div>

<div class="metric-row">
<div class="metric"><h3>${leads.length}</h3><p>Total Jobs</p></div>
<div class="metric"><h3>${completed}</h3><p>Completed</p></div>
<div class="metric"><h3>${money(revenue)}</h3><p>Total Revenue</p></div>
<div class="metric"><h3>${money(totalProfit)}</h3><p>NLN Profit</p></div>
</div>

<div class="action-grid">
<a class="action" href="#addJob"><span class="icon">➕</span>Add Job</a>
<a class="action" href="#providers"><span class="icon">👥</span>Providers</a>
<a class="action" href="#jobs"><span class="icon">💼</span>Jobs</a>
<a class="action" href="#"><span class="icon">🤖</span>AI Dispatcher</a>
<a class="action" href="#"><span class="icon">📊</span>Reports</a>
<a class="action" href="#"><span class="icon">⚙️</span>Settings</a>
<a class="action" href="#"><span class="icon">🎧</span>Support</a>
</div>

<div class="grid-2">
<div class="panel"><h3>Jobs Overview</h3><div class="chart"></div></div>
${paymentPanel(10000, 0)}
</div>

<div class="grid-2" id="jobs">
<div class="panel">
<h3>Recent Jobs</h3>
${leads.slice(0, 15).map(jobCard).join("") || "<p>No jobs</p>"}
</div>
<div class="panel">
<h3>Summary</h3>
<table>
<tr><td>Total Revenue</td><td>${money(revenue)}</td></tr>
<tr><td>Total Profit</td><td>${money(totalProfit)}</td></tr>
<tr><td>Total Jobs</td><td>${leads.length}</td></tr>
</table>
</div>
</div>

<div class="panel" id="providers">
<h3>Providers</h3>
<div class="provider-grid">
${Object.entries(providers).map(([p, phone]) => `
<div class="provider-card">
<h3>${safe(p)}</h3>
<p style="color:#94a3b8">${safe(phone)}</p>
<p>Code: <b>${providerCode(p)}</b></p>
<a class="btn green" href="tel:${safe(phone)}">Call</a>
<a class="btn purple" href="sms:${safe(phone)}">Text</a>
<a class="btn blue" href="/provider/${encodeURIComponent(p)}?code=${providerCode(p)}">Dashboard</a>
</div>
`).join("")}
</div>
</div>

<div class="card-form" id="addJob">
<h3>Add Quick Job</h3>
<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">
<div class="form-grid">
<input name="customer_name" placeholder="Customer Name">
<input name="customer_phone" placeholder="Customer Phone">
<input name="service" placeholder="Service">
<input name="source" placeholder="Source">
<input name="recording" placeholder="Recording URL">
<input name="job_amount" type="number" placeholder="Job Amount">
<input name="lead_cost" type="number" placeholder="Lead Cost">
<select name="provider_assigned">
<option value="">Assign Provider</option>
${Object.keys(providers).map(p => `<option value="${p}">${p}</option>`).join("")}
</select>
</div>
<textarea name="notes" placeholder="Notes"></textarea>
<button class="btn blue" style="margin-top:10px">Create Job</button>
</form>
</div>`;

res.send(layout({ title: "Admin Dashboard", role: "admin", name: "Admin", body }));
});

app.get("/provider/:name", requireProviderAccess, async (req, res) => {
const providerName = req.params.name;
const allLeads = await getLeads();
const leads = allLeads.filter(l => l.provider_assigned === providerName || l.clean_status === "new");
const myJobs = allLeads.filter(l => l.provider_assigned === providerName);
const earnings = myJobs.reduce((s, l) => s + Math.max(0, Number(l.job_amount || 0) - Number(l.lead_cost || 0)), 0);

const body = `
<div class="hero">
<div><h1>Welcome back, ${safe(providerName)}! ✅</h1><p>Your provider command center.</p></div>
</div>

<div class="action-grid">
<a class="action" href="tel:+14435781686"><span class="icon">📞</span>Call Dispatch</a>
<a class="action" href="sms:+14435781686"><span class="icon">💬</span>Text Dispatch</a>
<a class="action" href="#jobs"><span class="icon">💼</span>Available Jobs</a>
<a class="action" href="#earnings"><span class="icon">💵</span>My Earnings</a>
<a class="action" href="#"><span class="icon">🗺️</span>Route Map</a>
<a class="action" href="#recordings"><span class="icon">🎙️</span>Recordings</a>
<a class="action" href="#"><span class="icon">🎧</span>Support</a>
</div>

<div class="grid-2">
<div class="panel" id="earnings"><h3>Earnings Overview</h3><div class="chart"></div><h2>${money(earnings)}</h2><p class="green-text">Provider earnings</p></div>
${paymentPanel(1000, 0)}
</div>

<div class="grid-4">
<div class="metric"><h3>${myJobs.filter(j => j.clean_status === "completed").length}</h3><p>Jobs Completed</p></div>
<div class="metric"><h3>${myJobs.filter(j => ["assigned","enroute"].includes(j.clean_status)).length}</h3><p>Jobs In Progress</p></div>
<div class="metric"><h3>${leads.length}</h3><p>Visible Leads</p></div>
<div class="metric"><h3>4.98 ⭐</h3><p>Rating</p></div>
</div>

<div class="grid-2" id="jobs">
<div class="panel">
<h3>Active / Available Jobs</h3>
${leads.slice(0, 12).map(jobCard).join("") || "<p>No jobs</p>"}
</div>
<div class="panel">
<h3>Earnings Summary</h3>
<table>
<tr><td>Today</td><td>${money(earnings)}</td></tr>
<tr><td>This Week</td><td>${money(earnings)}</td></tr>
<tr><td>This Month</td><td>${money(earnings)}</td></tr>
<tr><td>Total Earnings</td><td>${money(earnings)}</td></tr>
</table>
</div>
</div>

<div class="grid-2" id="tools">
<div class="panel">
<h3>Quick Actions</h3>
<div class="quick-tools">
<a class="tool" href="#">📞 Call Customer</a>
<a class="tool" href="#">💬 Text Customer</a>
<a class="tool" href="#">📍 Get Directions</a>
<a class="tool" href="#">🔗 Share ETA</a>
<a class="tool" href="#">✅ Mark Arrived</a>
<a class="tool" href="#">🚀 Start Job</a>
<a class="tool" href="#">✅ Complete Job</a>
<a class="tool" href="#">⭐ Request Review</a>
</div>
</div>
<div class="panel">
<h3>Provider Tools</h3>
<div class="quick-tools">
<a class="tool" href="#">🟢 Availability<small>Online</small></a>
<a class="tool" href="#">📍 Service Areas<small>Manage zones</small></a>
<a class="tool" href="#">🧰 Service Types<small>Edit services</small></a>
<a class="tool" href="#">💵 Pricing<small>Set prices</small></a>
<a class="tool" href="#">📄 Documents<small>Upload docs</small></a>
<a class="tool" href="#">🏦 Bank Info<small>Payment info</small></a>
</div>
</div>
</div>`;

res.send(layout({ title: "Provider Dashboard", role: "provider", name: providerName, body }));
});

initDB().then(() => {
app.listen(PORT, () => console.log("NLN dashboards running"));
});
