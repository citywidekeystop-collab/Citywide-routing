const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PORT = process.env.PORT || 10000;
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
}

function safe(v) {
return String(v || "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}

function money(v) {
return "$" + Number(v || 0).toLocaleString();
}

function providerCode(name) {
return (providers[name] || "").replace(/\D/g, "").slice(-4);
}

function cleanStatus(v) {
const s = String(v || "").toUpperCase().trim();
if (["NEW", "ASSIGNED", "ENROUTE", "ARRIVED", "COMPLETED", "PAID", "DECLINED"].includes(s)) return s;
return "NEW";
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) return res.status(403).send("ADMIN LOCKED");
next();
}

async function getLeads() {
const r = await pool.query("SELECT * FROM leads ORDER BY id DESC");
return r.rows.map(x => ({ ...x, lead_status: cleanStatus(x.lead_status) }));
}

function css() {
return `
*{box-sizing:border-box}
body{margin:0;background:#020817;color:white;font-family:Arial,Helvetica,sans-serif}
a{text-decoration:none;color:white}
.layout{display:flex;min-height:100vh}
.side{width:250px;background:#030b1a;border-right:1px solid #162033;padding:22px;position:fixed;top:0;bottom:0;left:0}
.logo{font-size:42px;font-weight:900;font-style:italic;line-height:.85}
.logo small{display:block;font-size:12px;margin-top:8px;color:#94a3b8}
.nav-title{font-size:12px;color:#64748b;margin:28px 0 10px;text-transform:uppercase}
.nav a{display:block;padding:13px 14px;border-radius:13px;margin:7px 0;color:#dbeafe;font-weight:800}
.nav a.active,.nav a:hover{background:linear-gradient(90deg,#0867ff,#7c3aed)}
.main{margin-left:250px;width:calc(100% - 250px);padding:22px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}
.top h1{margin:0;font-size:32px}
.muted{color:#94a3b8}
.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#22c55e);display:grid;place-items:center;font-weight:900}
.top-icons{display:flex;gap:16px;align-items:center}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}
.card,.panel,.job{background:#071226;border:1px solid #1e293b;border-radius:22px;padding:20px;box-shadow:0 18px 50px #0005}
.big{font-size:36px;font-weight:900}
.actions{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:18px}
.action{background:#071226;border:1px solid #1e293b;border-radius:18px;min-height:105px;display:grid;place-items:center;text-align:center;font-weight:900}
.action span{display:block;font-size:32px;margin-bottom:8px}
.grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-bottom:18px}
.chart{height:210px;border-radius:18px;background:linear-gradient(180deg,#7c3aed,#2563eb);opacity:.85;margin-top:14px}
.pay{font-size:44px;color:#22c55e;font-weight:900;text-align:center}
.bar{height:13px;border-radius:99px;background:#102544;overflow:hidden;margin:18px 0}
.bar div{height:100%;width:86%;background:#2563eb}
.jobs{display:flex;flex-direction:column;gap:16px}
.job-head{display:flex;justify-content:space-between;gap:14px;align-items:start}
.job-title{font-size:24px;font-weight:900;line-height:1.3;word-break:break-word}
.status{padding:9px 13px;border-radius:12px;font-size:12px;font-weight:900}
.NEW{background:#2563eb}.ASSIGNED{background:#d97706}.ENROUTE{background:#7c3aed}.ARRIVED{background:#0ea5e9}.COMPLETED{background:#16a34a}.PAID{background:#475569}.DECLINED{background:#991b1b}
.sub{color:#cbd5e1;line-height:1.55;margin-top:7px;word-break:break-word}
.note{background:#020817;border-radius:16px;padding:14px;margin-top:12px;color:#dbeafe;line-height:1.55;max-height:110px;overflow:auto}
.buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.btn{border:0;border-radius:12px;padding:12px 15px;color:white;font-weight:900;cursor:pointer;display:inline-block;text-align:center}
.blue{background:#2563eb}.purple{background:#9333ea}.green{background:#16a34a}.orange{background:#ea580c}.red{background:#991b1b}.dark{background:#111827}
input,select,textarea{width:100%;padding:14px;border:0;border-radius:13px;background:#0f172a;color:white;margin-top:10px}
.formgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.submit{width:100%;margin-top:12px;padding:15px;border:0;border-radius:13px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:white;font-weight:900;font-size:16px}
form.inline{display:inline}
.mobile-nav{display:none}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-box{width:100%;max-width:430px;background:#071226;border:1px solid #1e293b;border-radius:28px;padding:28px;box-shadow:0 18px 50px #0007}
.login-box h1{margin:0 0 8px;font-size:34px}
@media(max-width:900px){
.side{display:none}
.main{margin-left:0;width:100%;padding:16px 14px 110px}
.top h1{font-size:26px}
.stats{grid-template-columns:1fr 1fr}
.actions{grid-template-columns:1fr 1fr}
.grid2{grid-template-columns:1fr}
.formgrid{grid-template-columns:1fr}
.job-title{font-size:21px}
.buttons{display:grid;grid-template-columns:1fr 1fr}
.btn{width:100%}
.mobile-nav{display:flex;position:fixed;left:14px;right:14px;bottom:14px;height:78px;background:#071226;border:1px solid #1e293b;border-radius:28px;justify-content:space-around;align-items:center;z-index:999}
.mobile-nav a{font-weight:900;text-align:center}
.mobile-nav span{display:block;font-size:22px;margin-bottom:4px}
}
`;
}

function callRailSummary(b) {
const summary = b.call_summary || b.summary || b.transcription || b.transcript || b.note || "";
const city = b.customer_city || b.formatted_customer_location || "";
const tracking = b.tracking_phone_number || b.formatted_tracking_phone_number || "";
const source = b.source_name || b.source || "";

let clean = "";
if (source) clean += `Source: ${source}\n`;
if (tracking) clean += `Tracking Number: ${tracking}\n`;
if (city) clean += `Location: ${city}\n`;
if (summary) clean += `Summary: ${summary}`;

return clean || "Incoming CallRail phone lead";
}

function callRailCustomerPhone(b) {
return b.customer_phone_number || b.formatted_customer_phone_number || b.customer_number || b.caller_number || b.customer_phone || b.from || b.phone || "Unknown";
}

function callRailCustomerName(b) {
return b.formatted_customer_name || b.customer_name || b.name || b.company || "Phone Lead";
}

function callRailRecording(b) {
return b.recording || b.recording_url || b.call_recording || b.recording_player || "";
}

function renderJob(job, providerMode = false, providerName = "") {
const providerPhone = providers[job.provider_assigned] || "";
const smsBody = encodeURIComponent(
`New NLN Job\nService: ${job.service || "Service"}\nCustomer: ${job.customer_name || "Unknown"}\nPhone: ${job.customer_phone || "Unknown"}\nNotes: ${job.notes || ""}`
);

return `
<div class="job">
<div class="job-head">
<div>
<div class="job-title">${safe(job.service || "Locksmith Service")}</div>
<div class="sub">${safe(job.customer_name || "Unknown")} • ${safe(job.customer_phone || "No Phone")}</div>
<div class="sub">Provider: ${safe(job.provider_assigned || "Not Assigned")} • Amount: ${money(job.job_amount)}</div>
</div>
<div class="status ${safe(job.lead_status)}">${safe(job.lead_status)}</div>
</div>

<div class="note">${safe(job.notes || "No notes yet.")}</div>

<div class="buttons">
<a class="btn blue" href="tel:${safe(job.customer_phone)}">Call Customer</a>
<a class="btn purple" href="sms:${safe(job.customer_phone)}">Text Customer</a>
<a class="btn orange" href="${safe(job.recording || "#")}">Recording</a>

${providerPhone ? `<a class="btn green" href="sms:${providerPhone}?body=${smsBody}">Text Provider</a>` : ""}

${
providerMode
? `
<form class="inline" method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="ENROUTE">
<button class="btn orange" type="submit">En Route</button>
</form>
<form class="inline" method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn green" type="submit">Complete</button>
</form>
`
: `
<form class="inline" method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn green" type="submit">Complete</button>
</form>
<form class="inline" method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="PAID">
<button class="btn dark" type="submit">Paid</button>
</form>
<form class="inline" method="POST" action="/admin/delete/${job.id}?token=${ADMIN_TOKEN}">
<button class="btn red" type="submit">Delete</button>
</form>
`
}
</div>

${
!providerMode
? `
<form method="POST" action="/admin/assign/${job.id}?token=${ADMIN_TOKEN}" style="margin-top:14px">
<select name="provider_assigned">
<option value="">Send To Provider</option>
${Object.keys(providers).map(p => `<option value="${safe(p)}">${safe(p)}</option>`).join("")}
</select>
<button class="submit" type="submit">Assign / Send Job</button>
</form>
`
: ""
}
</div>
`;
}

app.get("/", (req, res) => res.redirect(`/admin?token=${ADMIN_TOKEN}`));

app.get("/health", (req, res) => res.send("SERVER RUNNING"));

app.get("/manifest.json", (req, res) => {
res.json({
name: "NLN Provider",
short_name: "NLN",
start_url: "/provider-login/Max",
display: "standalone",
background_color: "#020817",
theme_color: "#020817",
icons: []
});
});

app.get("/callrail/test", async (req, res) => {
await pool.query(
`INSERT INTO leads (customer_name, customer_phone, service, source, provider_assigned, lead_status, recording, notes, job_amount, lead_cost)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
["CallRail Test Lead", "+14430000000", "Incoming Phone Call", "CallRail Test", "", "NEW", "", "Manual test lead", "0", "35"]
);
res.send("CallRail test lead added");
});

app.post("/callrail/webhook", async (req, res) => {
try {
const b = req.body || {};
await pool.query(
`INSERT INTO leads (customer_name, customer_phone, service, source, provider_assigned, lead_status, recording, notes, job_amount, lead_cost)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
[
callRailCustomerName(b),
callRailCustomerPhone(b),
b.service || b.call_type || "Phone Call",
"CallRail",
"",
"NEW",
callRailRecording(b),
callRailSummary(b),
"0",
"35"
]
);

console.log("CALLRAIL LEAD INSERTED");
res.json({ success: true });
} catch (err) {
console.log("CALLRAIL ERROR:", err);
res.status(500).json({ success: false, error: err.message });
}
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
await pool.query(
`INSERT INTO leads (customer_name, customer_phone, service, source, provider_assigned, lead_status, recording, notes, job_amount, lead_cost)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
[
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
]
);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/assign/:id", requireAdmin, async (req, res) => {
await pool.query(
`UPDATE leads SET provider_assigned=$1, lead_status='ASSIGNED' WHERE id=$2`,
[req.body.provider_assigned || "", req.params.id]
);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/status/:id", requireAdmin, async (req, res) => {
await pool.query(
`UPDATE leads SET lead_status=$1 WHERE id=$2`,
[cleanStatus(req.body.status), req.params.id]
);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/provider/:name/status/:id", async (req, res) => {
const name = req.params.name;
if (!providers[name]) return res.send("Provider not found");
if (req.query.code !== providerCode(name)) return res.send("LOCKED");

await pool.query(
`UPDATE leads SET provider_assigned=$1, lead_status=$2 WHERE id=$3`,
[name, cleanStatus(req.body.status), req.params.id]
);

res.redirect(`/provider/${encodeURIComponent(name)}?code=${providerCode(name)}`);
});

app.get("/provider-login/:name", (req, res) => {
const name = req.params.name;
if (!providers[name]) return res.send("Provider not found");

res.send(`
<html>
<head>
<title>${safe(name)} Login</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="NLN Provider">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>${css()}</style>
</head>
<body>
<div class="login-wrap">
<div class="login-box">
<h1>${safe(name)} Login</h1>
<p class="muted">Enter your private 4-digit access code.</p>
<input id="code" maxlength="4" placeholder="4 digit code">
<button class="submit" onclick="login()">Login</button>
</div>
</div>
<script>
function login(){
const code = document.getElementById("code").value;
if(!code){ alert("Enter your code"); return; }
window.location.href = "/provider/${encodeURIComponent(name)}?code=" + encodeURIComponent(code);
}
</script>
</body>
</html>
`);
});

app.get("/admin", requireAdmin, async (req, res) => {
const allLeads = await getLeads();
const activeLeads = allLeads.filter(l => !["COMPLETED", "PAID", "DECLINED"].includes(l.lead_status));
const closedLeads = allLeads.filter(l => ["COMPLETED", "PAID", "DECLINED"].includes(l.lead_status));
const revenue = allLeads.reduce((s, l) => s + Number(l.job_amount || 0), 0);

res.send(`
<html>
<head>
<title>NLN Admin Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>
<div class="layout">
<aside class="side">
<div class="logo">NLN<small>CITYWIDE ROUTING</small></div>
<div class="nav-title">Dashboard</div>
<div class="nav">
<a class="active" href="/admin?token=${ADMIN_TOKEN}">📊 Overview</a>
<a href="#jobs">💼 Jobs</a>
<a href="#addJob">➕ Add Job</a>
<a href="#providers">👥 Providers</a>
<a href="#payments">💳 Payments</a>
<a href="#closed">✅ Closed</a>
</div>
</aside>

<main class="main">
<div class="top">
<div>
<h1>Admin Dashboard</h1>
<div class="muted">Luxury Dispatch Command Center</div>
</div>
<div class="top-icons">
<span>💬</span><span>🔔</span><div class="avatar">A</div>
</div>
</div>

<div class="stats">
<div class="card"><div class="big">${activeLeads.length}</div><div class="muted">Active Jobs</div></div>
<div class="card"><div class="big">${money(revenue)}</div><div class="muted">Revenue</div></div>
<div class="card"><div class="big">${closedLeads.length}</div><div class="muted">Closed</div></div>
<div class="card"><div class="big">${Object.keys(providers).length}</div><div class="muted">Providers</div></div>
</div>

<div class="actions">
<a class="action" href="#addJob"><div><span>➕</span>Add Job</div></a>
<a class="action" href="#providers"><div><span>👥</span>Providers</div></a>
<a class="action" href="#jobs"><div><span>💼</span>Jobs</div></a>
<a class="action" href="#payments"><div><span>💳</span>Payments</div></a>
<a class="action" href="/callrail/test"><div><span>📞</span>Test CallRail</div></a>
<a class="action" href="/health"><div><span>⚙️</span>System</div></a>
</div>

<div class="grid2">
<section class="panel">
<h2>Jobs Overview</h2>
<div class="chart"></div>
</section>
<section class="panel" id="payments">
<h2>Payment Threshold</h2>
<div class="pay">$0.00</div>
<div class="muted" style="text-align:center">No balance due</div>
<div class="bar"><div></div></div>
<p class="muted">Your entire $10,000 payment threshold is available.</p>
<button class="submit">MAKE A PAYMENT</button>
</section>
</div>

<section class="panel" id="providers">
<h2>Providers</h2>
<div class="stats">
${Object.entries(providers).map(([n,p]) => `
<div class="card">
<h3>${safe(n)}</h3>
<div class="muted">${safe(p)}</div>
<div class="muted">Private Login: /provider-login/${encodeURIComponent(n)}</div>
<div class="buttons">
<a class="btn blue" href="tel:${safe(p)}">Call</a>
<a class="btn purple" href="sms:${safe(p)}">Text</a>
<a class="btn green" href="/provider-login/${encodeURIComponent(n)}">Login Page</a>
</div>
</div>
`).join("")}
</div>
</section>

<section class="panel" id="addJob" style="margin-top:18px">
<h2>Add Quick Job</h2>
<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">
<div class="formgrid">
<input name="customer_name" placeholder="Customer Name">
<input name="customer_phone" placeholder="Customer Phone">
<input name="service" placeholder="Service">
<input name="source" placeholder="Source">
<input name="job_amount" placeholder="Job Amount">
<input name="lead_cost" placeholder="Lead Cost">
<input name="recording" placeholder="Recording URL">
<select name="provider_assigned">
<option value="">Assign Provider</option>
${Object.keys(providers).map(p => `<option value="${safe(p)}">${safe(p)}</option>`).join("")}
</select>
</div>
<textarea name="notes" placeholder="Notes"></textarea>
<button class="submit">Create Job</button>
</form>
</section>

<section class="panel" id="jobs" style="margin-top:18px">
<h2>Active Jobs</h2>
<div class="jobs">${activeLeads.map(j => renderJob(j)).join("") || "<div class='card'>No active jobs.</div>"}</div>
</section>

<section class="panel" id="closed" style="margin-top:18px">
<h2>Closed Jobs</h2>
<div class="jobs">${closedLeads.slice(0, 20).map(j => renderJob(j)).join("") || "<div class='card'>No closed jobs.</div>"}</div>
</section>
</main>
</div>

<div class="mobile-nav">
<a href="#jobs"><span>💼</span>Jobs</a>
<a href="#providers"><span>👥</span>Providers</a>
<a href="#payments"><span>💳</span>Pay</a>
<a href="javascript:location.reload()"><span>🔄</span>Refresh</a>
</div>
</body>
</html>
`);
});

app.get("/provider/:name", async (req, res) => {
const name = req.params.name;
if (!providers[name]) return res.send("Provider not found");

if (req.query.code !== providerCode(name)) {
return res.redirect(`/provider-login/${encodeURIComponent(name)}`);
}

const allLeads = await getLeads();
const leads = allLeads.filter(l =>
l.provider_assigned === name &&
!["COMPLETED", "PAID", "DECLINED"].includes(l.lead_status)
);

res.send(`
<html>
<head>
<title>${safe(name)} Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="NLN Provider">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>${css()}</style>
</head>
<body>
<main class="main" style="margin:0;width:100%">
<div class="top">
<div><h1>${safe(name)} Dashboard</h1><div class="muted">Provider Dispatch App</div></div>
<div class="avatar">${safe(name[0])}</div>
</div>
<div class="stats">
<div class="card"><div class="big">${leads.length}</div><div class="muted">Assigned Jobs</div></div>
<div class="card"><div class="big">Online</div><div class="muted">Status</div></div>
</div>
<section class="panel"><h2>My Jobs</h2><div class="jobs">${leads.map(j => renderJob(j, true, name)).join("") || "<div class='card'>No jobs assigned.</div>"}</div></section>
</main>
<div class="mobile-nav">
<a href="#"><span>🏠</span>Home</a>
<a href="#jobs"><span>💼</span>Jobs</a>
<a href="tel:+14435781686"><span>📞</span>Dispatch</a>
<a href="javascript:location.reload()"><span>🔄</span>Refresh</a>
</div>
</body>
</html>
`);
});

initDB().then(() => {
app.listen(PORT, () => {
console.log("SERVER RUNNING");
});
});
