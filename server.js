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

function providerCode(name) {
const phone = providers[name] || "";
return phone.replace(/\D/g, "").slice(-4);
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) return res.status(401).send("Admin Locked");
next();
}

function requireProvider(req, res, next) {
const name = req.params.name;
const code = req.query.code;

if (!providers[name]) return res.status(404).send("Provider not found");

if (code !== providerCode(name)) {
return res.status(401).send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Provider Login</title>
<style>
body{margin:0;background:#020617;color:#fff;font-family:Arial;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{width:360px;background:#071226;border:1px solid #1f2d3d;border-radius:24px;padding:28px;box-shadow:0 30px 80px #0008}
h1{margin:0 0 10px;font-size:30px}
p{color:#cbd5e1}
input{width:100%;padding:16px;margin:12px 0;border:1px solid #1f2d3d;border-radius:14px;background:#0f172a;color:white;font-size:20px;box-sizing:border-box}
button{width:100%;padding:16px;border:0;border-radius:14px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:white;font-size:18px;font-weight:900}
</style>
</head>
<body>
<form class="box" method="GET" action="/provider/${encodeURIComponent(name)}">
<h1>NLN Provider Login</h1>
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

function cleanStatus(s) {
const x = String(s || "").toLowerCase().trim();
if (x === "assigned") return "assigned";
if (x === "enroute" || x === "en route") return "enroute";
if (x === "completed" || x === "complete") return "completed";
if (x === "paid" || x === "closed") return "paid";
return "new";
}

async function getLeads() {
const result = await pool.query(`SELECT * FROM leads ORDER BY id DESC`);
return result.rows.map(l => ({ ...l, clean_status: cleanStatus(l.lead_status) }));
}

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
req.body.provider_assigned ? "assigned" : "new",
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
notes=$5,
recording=$6
WHERE id=$7
`, [
req.body.provider_assigned || "",
status,
req.body.job_amount || "0",
req.body.lead_cost || "35",
req.body.notes || "",
req.body.recording || "",
req.params.id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

function css() {
return `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#020817;color:white;overflow-x:hidden}
a{text-decoration:none}
.app{display:flex;min-height:100vh;background:radial-gradient(circle at top,#0a1c35,#020817 60%)}
.sidebar{width:245px;background:#050d19;border-right:1px solid #1f2d3d;position:fixed;top:0;bottom:0;left:0;padding:22px;overflow:auto}
.logo{font-size:40px;font-weight:900;font-style:italic;letter-spacing:-2px}
.sublogo{font-size:12px;font-weight:900;margin-bottom:28px}
.nav-title{font-size:11px;color:#8ba0b7;text-transform:uppercase;margin:22px 0 8px}
.nav a{display:flex;align-items:center;gap:10px;color:#dbeafe;padding:12px;border-radius:10px;margin:5px 0;font-weight:800}
.nav a.active,.nav a:hover{background:linear-gradient(90deg,#0867ff,#155dfc)}
.side-help{position:absolute;bottom:18px;left:14px;right:14px;background:#071827;border:1px solid #1f2d3d;border-radius:14px;padding:14px}
.side-help button{width:100%;padding:12px;border:0;border-radius:9px;background:#0b63f6;color:white;font-weight:900}
.main{margin-left:245px;width:calc(100% - 245px);padding:22px}
.topbar{height:58px;display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.top-left{display:flex;align-items:center;gap:16px}
.hamb{font-size:24px;color:#cbd5e1}
.topbar h1{margin:0;font-size:22px}
.top-icons{display:flex;align-items:center;gap:16px}
.avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#22c55e);display:grid;place-items:center;font-weight:900}
.online{color:#22c55e;font-size:13px}
.hero-row{display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:14px;margin-bottom:16px}
.welcome,.card,.panel,.job-card,.provider-card{background:rgba(7,18,34,.94);border:1px solid #1f2d3d;border-radius:14px;box-shadow:0 20px 50px #0004}
.welcome{padding:20px}
.welcome h2{margin:0 0 8px;font-size:25px}
.welcome p{margin:0;color:#cbd5e1}
.card{padding:18px}
.card .icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;margin-bottom:12px;font-size:22px}
.card h3{margin:0;font-size:24px}
.card p{margin:6px 0 0;color:#aebbd0}
.green-text{color:#22c55e}.muted{color:#94a3b8}
.action-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:14px;margin-bottom:16px}
.action{background:rgba(7,18,34,.94);border:1px solid #1f2d3d;border-radius:12px;min-height:92px;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900}
.action span{font-size:30px;margin-bottom:8px}
.grid-3{display:grid;grid-template-columns:1.1fr 1.15fr .95fr;gap:16px;margin-bottom:16px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.panel{padding:16px}
.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.panel h3{margin:0;font-size:20px}
.chart{height:190px;border-radius:12px;background:#081222;position:relative;overflow:hidden;border:1px solid #142238}
.chart:after{content:"";position:absolute;left:20px;right:20px;bottom:25px;height:120px;background:linear-gradient(135deg,#7c3aed,#2563eb);clip-path:polygon(0 80%,15% 65%,30% 68%,45% 45%,60% 55%,75% 28%,100% 10%,100% 100%,0 100%);opacity:.88}
.donut{width:185px;height:185px;border-radius:50%;background:conic-gradient(#2563eb 0 24%,#7c3aed 24% 51%,#22c55e 51% 82%,#f97316 82% 100%);margin:auto;display:grid;place-items:center}
.donut div{width:105px;height:105px;border-radius:50%;background:#071226;display:grid;place-items:center;text-align:center;font-weight:900}
.pay-money{font-size:30px;font-weight:900;color:#22c55e;text-align:center;margin:10px 0 2px}
.threshold{height:10px;background:#10233c;border-radius:999px;overflow:hidden;margin:14px 0}
.threshold div{height:100%;width:88%;background:#0b63f6}
.btn{display:inline-block;color:white;padding:10px 13px;border-radius:8px;font-weight:900;text-align:center;border:0;cursor:pointer}
.blue{background:#0b63f6}.green{background:#16a34a}.purple{background:#7c3aed}.orange{background:#ea580c}.red{background:#991b1b}.dark{background:#111827}
.job-card{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:13px;margin-bottom:10px}
.status{padding:6px 8px;border-radius:6px;font-size:11px;font-weight:900;text-transform:uppercase}
.new{background:#0b63f6}.assigned{background:#d97706}.enroute{background:#7c3aed}.completed{background:#16a34a}.paid{background:#475569}
.job-title{font-weight:900}.job-sub{color:#94a3b8;font-size:13px;margin-top:4px}
.job-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
table{width:100%;border-collapse:collapse}td{padding:11px;border-bottom:1px solid #1f2d3d}
.provider-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.provider-card{padding:14px}
.provider-card h4{margin:0 0 8px}
.form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
input,select,textarea{width:100%;padding:12px;border-radius:10px;border:1px solid #1f2d3d;background:#081827;color:white;margin:6px 0}
textarea{min-height:80px}
.mobile-nav{display:none}

@media(max-width:900px){
.app{display:block}
.sidebar{display:none}
.main{margin-left:0;width:100%;padding:16px 14px 105px}
.topbar{height:auto;margin-bottom:14px}
.topbar h1{font-size:22px}
.hamb{font-size:28px}
.top-icons{gap:12px}
.hide-mobile{display:none}
.hero-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.welcome{display:none}
.card{border-radius:14px;padding:14px;min-height:122px}
.card .icon{width:34px;height:34px;font-size:18px;margin-bottom:8px}
.card h3{font-size:25px}
.card p{font-size:15px}
.action-grid{grid-template-columns:repeat(4,1fr);gap:10px}
.action{min-height:82px;border-radius:12px;font-size:13px;padding:8px;text-align:center}
.action span{font-size:28px;margin-bottom:6px}
.grid-3,.grid-2{grid-template-columns:1fr 1fr;gap:10px}
.grid-3 .panel:nth-child(2){display:none}
.panel{border-radius:13px;padding:14px}
.panel h3{font-size:18px}
.chart{height:160px}
.pay-money{font-size:25px}
.payment-text{font-size:12px;line-height:1.35}
.job-card{grid-template-columns:auto 1fr auto;padding:10px;border-radius:12px}
.job-title{font-size:15px}
.job-sub{font-size:12px}
.job-actions .btn{padding:8px 10px;font-size:12px}
.provider-grid,.form-grid{grid-template-columns:1fr}
.mobile-nav{display:flex;position:fixed;left:14px;right:14px;bottom:12px;background:rgba(7,18,34,.98);border:1px solid #1f2d3d;border-radius:26px;height:82px;align-items:center;justify-content:space-around;z-index:999;backdrop-filter:blur(18px)}
.mobile-nav a{color:#dbeafe;text-align:center;font-weight:900;font-size:13px}
.mobile-nav span{display:block;font-size:23px;margin-bottom:4px}
}
`;
}

function jobCard(l, admin = true) {
const phone = l.customer_phone || "";
const recordingButton = l.recording ? `<a class="btn orange" href="${safe(l.recording)}">Recording</a>` : "";
return `
<div class="job-card">
<span class="status ${l.clean_status}">${l.clean_status}</span>
<div>
<div class="job-title">${safe(l.service || "Locksmith Service")}</div>
<div class="job-sub">${safe(l.customer_name || "Customer")} • ${safe(phone || "No phone")}</div>
</div>
<div class="job-actions">
<span class="muted">${money(l.job_amount)}</span>
<a class="btn blue" href="tel:${safe(phone)}">Call</a>
<a class="btn purple" href="sms:${safe(phone)}">Text</a>
${recordingButton}
<span class="status ${l.clean_status}">${l.clean_status}</span>
</div>
</div>
`;
}

function shell(title, body) {
return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe(title)}</title>
<style>${css()}</style>
</head>
<body>
<div class="app">
<aside class="sidebar">
<div class="logo">NLN</div>
<div class="sublogo">CITYWIDE ROUTING</div>
<div class="nav-title">Dashboard</div>
<div class="nav">
<a class="active" href="#">▦ Overview</a>
<a href="#jobs">▣ All Jobs</a>
<a href="#providers">👥 Providers</a>
<a href="#addJob">➕ Add Job</a>
<a href="#payments">💳 Payments</a>
<a href="/health">⚙ System</a>
</div>
<div class="nav-title">System</div>
<div class="nav">
<a href="#">📊 Reports</a>
<a href="#">🤖 AI Dispatcher</a>
<a href="#">🎧 Support</a>
</div>
<div class="side-help">
<b>NLN</b> <small>CITYWIDE ROUTING</small>
<p style="color:#cbd5e1;font-size:13px">We drive the work. You drive the mission.</p>
<button>Need Help?</button>
</div>
</aside>
<main class="main">${body}</main>
</div>
<div class="mobile-nav">
<a href="#jobs"><span>💼</span>Jobs</a>
<a href="#tools"><span>▦</span>Tools</a>
<a href="#payments"><span>💲</span>Pay</a>
<a href="javascript:location.reload()"><span>↻</span>Refresh</a>
</div>
</body>
</html>
`;
}

app.get("/admin", requireAdmin, async (req, res) => {
const leads = await getLeads();
const revenue = leads.reduce((s, l) => s + Number(l.job_amount || 0), 0);
const costs = leads.reduce((s, l) => s + Number(l.lead_cost || 0), 0);
const profit = revenue - costs;
const completed = leads.filter(l => ["completed", "paid"].includes(l.clean_status)).length;

const body = `
<div class="topbar">
<div class="top-left"><div class="hamb">☰</div><h1>Admin Dashboard</h1></div>
<div class="top-icons"><span>💬</span><span>🔔<b style="color:#ef4444">12</b></span><div class="avatar">A</div><div><b>Admin</b><br><span class="online">● Online</span></div></div>
</div>

<div class="hero-row">
<div class="welcome"><h2>Welcome back, Admin! 👋</h2><p>Here’s what’s happening across your dispatch today.</p></div>
<div class="card"><div class="icon blue">💼</div><p>Total Jobs</p><h3>${leads.length}</h3><p class="green-text">View all jobs</p></div>
<div class="card"><div class="icon green">✅</div><p>Completed</p><h3>${completed}</h3><p class="green-text">This month</p></div>
<div class="card"><div class="icon purple">💲</div><p>Total Revenue</p><h3>${money(revenue)}</h3><p>This month</p></div>
<div class="card"><div class="icon orange">⭐</div><p>Total Profit</p><h3>${money(profit)}</h3><p class="green-text">This month</p></div>
</div>

<div class="action-grid" id="tools">
<a class="action" href="#addJob"><span>➕</span>Add Job</a>
<a class="action" href="#providers"><span>👥</span>Providers</a>
<a class="action" href="#jobs"><span>💼</span>Jobs</a>
<a class="action" href="#"><span>🤖</span>AI Dispatcher</a>
<a class="action" href="#"><span>📊</span>Reports</a>
<a class="action" href="#"><span>⚙️</span>Settings</a>
<a class="action" href="#"><span>🎧</span>Support</a>
</div>

<div class="grid-3">
<div class="panel"><div class="panel-head"><h3>Jobs Overview</h3><span class="muted">This Week</span></div><div class="chart"></div></div>
<div class="panel hide-mobile"><div class="panel-head"><h3>Job Status</h3></div><div class="donut"><div>${leads.length}<br><small>Total Jobs</small></div></div></div>
<div class="panel" id="payments">
<h3>Payment Threshold</h3>
<div class="pay-money">$0.00</div>
<p style="text-align:center" class="muted">No balance due</p>
<div class="threshold"><div></div></div>
<p class="payment-text">Your entire $10,000 payment threshold is available. <span style="color:#60a5fa">Edit</span></p>
<p class="payment-text muted">Last payment was on May 24 for $918.76</p>
<a class="btn blue" style="width:100%;margin-top:10px" href="#">MAKE A PAYMENT</a>
</div>
</div>

<div class="grid-2">
<div class="panel" id="jobs">
<div class="panel-head"><h3>Recent Jobs</h3><span style="color:#60a5fa">View All</span></div>
${leads.slice(0, 12).map(l => jobCard(l)).join("") || "<p>No jobs yet</p>"}
</div>
<div class="panel hide-mobile">
<div class="panel-head"><h3>Earnings Summary</h3><span style="color:#60a5fa">View Full Report</span></div>
<table>
<tr><td>Today</td><td>${money(revenue)}</td></tr>
<tr><td>This Week</td><td>${money(revenue)}</td></tr>
<tr><td>Total Profit</td><td>${money(profit)}</td></tr>
<tr><td>Total Jobs</td><td>${leads.length}</td></tr>
</table>
</div>
</div>

<div class="panel" id="providers">
<div class="panel-head"><h3>Providers</h3></div>
<div class="provider-grid">
${Object.entries(providers).map(([p, phone]) => `
<div class="provider-card">
<h4>${safe(p)}</h4>
<p class="muted">${safe(phone)}</p>
<p>Code: <b>${providerCode(p)}</b></p>
<a class="btn green" href="tel:${safe(phone)}">Call</a>
<a class="btn purple" href="sms:${safe(phone)}">Text</a>
<a class="btn blue" href="/provider/${encodeURIComponent(p)}?code=${providerCode(p)}">Dashboard</a>
</div>
`).join("")}
</div>
</div>

<div class="panel" id="addJob" style="margin-top:16px">
<div class="panel-head"><h3>Add Quick Job</h3></div>
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
<button class="btn blue" style="margin-top:8px">Create Job</button>
</form>
</div>
`;

res.send(shell("NLN Admin Dashboard", body));
});

app.get("/provider/:name", requireProvider, async (req, res) => {
const name = req.params.name;
const leads = (await getLeads()).filter(l => l.provider_assigned === name || !l.provider_assigned);

const body = `
<div class="topbar">
<div class="top-left"><div class="hamb">☰</div><h1>Provider Dashboard</h1></div>
<div class="top-icons"><span>💬</span><span>🔔</span><div class="avatar">${safe(name[0])}</div><div><b>${safe(name)}</b><br><span class="online">● Online</span></div></div>
</div>

<div class="hero-row">
<div class="welcome"><h2>Welcome back, ${safe(name)}! ✅</h2><p>Here’s what’s happening with your dispatch today.</p></div>
<div class="card"><div class="icon blue">💼</div><p>Total Jobs</p><h3>${leads.length}</h3></div>
<div class="card"><div class="icon green">✅</div><p>Completed</p><h3>${leads.filter(l => l.clean_status === "completed").length}</h3></div>
<div class="card"><div class="icon purple">💲</div><p>Earnings</p><h3>${money(leads.reduce((s,l)=>s+Number(l.job_amount||0),0))}</h3></div>
<div class="card"><div class="icon orange">⭐</div><p>Rating</p><h3>4.98</h3></div>
</div>

<div class="action-grid" id="tools">
<a class="action" href="tel:+14435781686"><span>📞</span>Call Dispatch</a>
<a class="action" href="sms:+14435781686"><span>💬</span>Text Dispatch</a>
<a class="action" href="#jobs"><span>💼</span>Available Jobs</a>
<a class="action" href="#"><span>🗺️</span>Route Map</a>
<a class="action" href="#"><span>🎙️</span>Recordings</a>
<a class="action" href="#"><span>💵</span>Earnings</a>
<a class="action" href="#"><span>🎧</span>Support</a>
</div>

<div class="grid-2">
<div class="panel"><div class="panel-head"><h3>Earnings Overview</h3><span class="muted">This Week</span></div><div class="chart"></div></div>
<div class="panel" id="payments">
<h3>Payment Threshold</h3>
<div class="pay-money">$0.00</div>
<p style="text-align:center" class="muted">No balance due</p>
<div class="threshold"><div></div></div>
<p class="payment-text">Your entire $1,000 payment threshold is available.</p>
<a class="btn blue" style="width:100%;margin-top:10px" href="#">MAKE A PAYMENT</a>
</div>
</div>

<div class="panel" id="jobs">
<div class="panel-head"><h3>Active / Available Jobs</h3><span style="color:#60a5fa">View All</span></div>
${leads.slice(0, 12).map(l => jobCard(l, false)).join("") || "<p>No jobs yet</p>"}
</div>
`;

res.send(shell("NLN Provider Dashboard", body));
});

initDB().then(() => {
app.listen(PORT, () => {
console.log("NLN SERVER RUNNING");
});
});
