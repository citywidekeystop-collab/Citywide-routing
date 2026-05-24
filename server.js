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

const providers = [
{ id: 1, name: "Max", phone: "+14436792242" },
{ id: 2, name: "Dreh", phone: "+12024125443" },
{ id: 3, name: "Tee", phone: "+14104199281" },
{ id: 4, name: "Robyn", phone: "+14435781866" },
{ id: 5, name: "Car Key Chris", phone: "+12232630824" }
];

async function initDB() {
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer TEXT,
phone TEXT,
tracking_number TEXT,
source TEXT,
service TEXT,
location TEXT,
details TEXT,
provider_id TEXT,
status TEXT DEFAULT 'new',
job_amount NUMERIC DEFAULT 0,
lead_cost NUMERIC DEFAULT 35,
notes TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

const columns = [
["provider_id", "TEXT"],
["tracking_number", "TEXT"],
["job_amount", "NUMERIC DEFAULT 0"],
["lead_cost", "NUMERIC DEFAULT 35"],
["notes", "TEXT"]
];

for (const [name, type] of columns) {
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ${name} ${type}`);
}
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function getProvider(id) {
return providers.find(p => String(p.id) === String(id));
}

function leadProfit(job) {
return Number(job.job_amount || 0) - Number(job.lead_cost || 0);
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) {
return res.status(401).send(`
<div style="font-family:Arial;padding:40px">
<h2>NLN Admin Locked</h2>
<p>Use your admin link:</p>
<b>/admin?token=${ADMIN_TOKEN}</b>
</div>
`);
}
next();
}

function safe(v) {
return String(v ?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({ ok: true, app: "NLN Fancy Dispatch Dashboard" });
});

app.get("/admin/debug-leads", requireAdmin, async (req, res) => {
const result = await pool.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200");
res.json(result.rows);
});

app.post("/lead/new", async (req, res) => {
const b = req.body;

await pool.query(`
INSERT INTO leads (
customer, phone, tracking_number, source, service, location,
details, provider_id, status, job_amount, lead_cost, notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
`, [
b.customer || "Unknown",
b.phone || "Unknown",
b.trackingNumber || b.tracking_number || "",
b.source || "Manual / LSA",
b.service || "Locksmith Service",
b.location || "",
b.details || "",
b.providerId || b.provider_id || "",
b.providerId || b.provider_id ? "assigned" : "new",
Number(b.jobAmount || b.job_amount || 0),
Number(b.leadCost || b.lead_cost || 35),
b.notes || ""
]);

res.json({ success: true });
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
const b = req.body;

await pool.query(`
INSERT INTO leads (
customer, phone, tracking_number, source, service, location,
details, provider_id, status, job_amount, lead_cost, notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
`, [
b.customer || "Unknown",
b.phone || "Unknown",
b.trackingNumber || "",
b.source || "Manual / LSA",
b.service || "Locksmith Service",
b.location || "",
b.details || "",
b.providerId || "",
b.providerId ? "assigned" : "new",
Number(b.jobAmount || 0),
Number(b.leadCost || 35),
b.notes || ""
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/update/:id", requireAdmin, async (req, res) => {
const id = req.params.id;

let finalStatus = req.body.quickStatus || req.body.status || "new";
if (req.body.providerId && finalStatus === "new") finalStatus = "assigned";

await pool.query(`
UPDATE leads
SET provider_id=$1, status=$2, job_amount=$3, lead_cost=$4, notes=$5
WHERE id=$6
`, [
req.body.providerId || "",
finalStatus,
Number(req.body.jobAmount || 0),
Number(req.body.leadCost || 0),
req.body.notes || "",
id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/admin", requireAdmin, async (req, res) => {
const result = await pool.query("SELECT * FROM leads ORDER BY created_at DESC");
const leads = result.rows;

const revenue = leads.reduce((s, l) => s + Number(l.job_amount || 0), 0);
const costs = leads.reduce((s, l) => s + Number(l.lead_cost || 0), 0);
const profit = revenue - costs;
const completed = leads.filter(l => l.status === "completed" || l.status === "paid").length;
const providerEarnings = leads.reduce((s, l) => {
if (l.provider_id) return s + Math.max(0, Number(l.job_amount || 0) - Number(l.lead_cost || 0));
return s;
}, 0);

const columns = [
["new", "New Leads"],
["assigned", "Assigned"],
["enroute", "En Route"],
["completed", "Completed"],
["paid", "Paid / Closed"]
];

function card(l) {
const provider = getProvider(l.provider_id);
const callNumber = l.phone && l.phone !== "Unknown" ? l.phone : l.tracking_number || "";

return `
<div class="job-card">
<div class="job-top">
<b>Job #${safe(l.id)}</b>
<span class="pill ${safe(l.status)}">${safe(l.status || "new").toUpperCase()}</span>
</div>

<p><span>Service:</span> ${safe(l.service)}</p>
<p><span>Location:</span> ${safe(l.location || "Not set")}</p>
<p><span>Customer:</span> ${safe(l.customer)}</p>
<p><span>Phone:</span> ${safe(l.phone)}</p>
<p><span>Provider:</span> ${provider ? safe(provider.name) : "Not Assigned"}</p>
<p><span>Job Amount:</span> ${money(l.job_amount)}</p>
<p><span>Lead Cost:</span> ${money(l.lead_cost)}</p>
<p><span>Profit:</span> <b class="${leadProfit(l) >= 0 ? "profit-good" : "profit-bad"}">${money(leadProfit(l))}</b></p>

<details>
<summary>Lead Details</summary>
<div class="details">${safe(l.details || "No details")}</div>
</details>

<form method="POST" action="/admin/update/${safe(l.id)}?token=${ADMIN_TOKEN}">
<select name="providerId">
<option value="">Assign Provider</option>
${providers.map(p => `
<option value="${p.id}" ${String(p.id) === String(l.provider_id) ? "selected" : ""}>
${safe(p.name)}
</option>
`).join("")}
</select>

<select name="status">
${["new","assigned","enroute","completed","paid"].map(s => `
<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>
`).join("")}
</select>

<input name="jobAmount" type="number" value="${safe(l.job_amount)}" placeholder="Job amount">
<input name="leadCost" type="number" value="${safe(l.lead_cost)}" placeholder="Lead cost">
<textarea name="notes" placeholder="Admin notes">${safe(l.notes || "")}</textarea>

<div class="btn-grid">
<button class="btn blue" type="submit">Save</button>
<a class="btn green" href="tel:${safe(callNumber)}">Call</a>
<a class="btn purple" href="${provider ? `sms:${safe(provider.phone)}` : "#"}">Text Provider</a>
<button class="btn orange" type="submit" name="quickStatus" value="enroute">En Route</button>
<button class="btn dark" type="submit" name="quickStatus" value="completed">Complete</button>
<button class="btn teal" type="submit" name="quickStatus" value="paid">Paid</button>
</div>
</form>

<form method="POST" action="/admin/delete/${safe(l.id)}?token=${ADMIN_TOKEN}">
<button class="delete" type="submit">Delete Job</button>
</form>
</div>
`;
}

res.send(`
<!DOCTYPE html>
<html>
<head>
<title>NLN Dispatch Command Center</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
margin:0;
font-family:Inter,Arial,sans-serif;
background:#f4f7fb;
color:#0f172a;
}
.app{display:flex;min-height:100vh}
.sidebar{
width:250px;
background:linear-gradient(180deg,#020617,#081827,#0f172a);
color:white;
padding:22px;
position:fixed;
top:0;
bottom:0;
left:0;
box-shadow:12px 0 35px rgba(2,6,23,.18);
}
.logo{
display:flex;
align-items:center;
gap:12px;
margin-bottom:28px;
}
.logo-badge{
width:54px;
height:54px;
border-radius:18px;
background:linear-gradient(135deg,#2563eb,#7c3aed);
display:flex;
align-items:center;
justify-content:center;
font-size:28px;
box-shadow:0 18px 35px rgba(37,99,235,.35);
}
.logo h1{
margin:0;
font-size:36px;
letter-spacing:-2px;
}
.logo small{
font-weight:900;
opacity:.75;
font-size:11px;
}
.nav-title{
font-size:11px;
letter-spacing:.12em;
text-transform:uppercase;
color:#93c5fd;
margin:18px 0 8px;
}
.nav a{
display:flex;
gap:11px;
align-items:center;
text-decoration:none;
color:white;
padding:14px 15px;
border-radius:15px;
margin:6px 0;
font-weight:800;
opacity:.85;
}
.nav a.active,.nav a:hover{
background:linear-gradient(135deg,#2563eb,#7c3aed);
opacity:1;
box-shadow:0 12px 25px rgba(37,99,235,.25);
}
.side-card{
margin-top:26px;
background:rgba(255,255,255,.08);
border:1px solid rgba(255,255,255,.12);
border-radius:22px;
padding:18px;
}
.side-card p{
display:flex;
justify-content:space-between;
margin:10px 0;
font-size:13px;
}
.main{
margin-left:250px;
width:calc(100% - 250px);
padding:22px 28px 100px;
}
.topbar{
display:flex;
justify-content:space-between;
align-items:center;
gap:18px;
margin-bottom:22px;
}
.topbar h2{
margin:0;
font-size:29px;
letter-spacing:-.04em;
}
.topbar p{
margin:5px 0 0;
color:#64748b;
font-weight:700;
}
.search{
flex:1;
max-width:430px;
padding:16px 18px;
border-radius:17px;
border:1px solid #e2e8f0;
background:white;
box-shadow:0 8px 25px rgba(15,23,42,.05);
}
.top-actions{
display:flex;
gap:12px;
}
.top-btn{
display:inline-flex;
align-items:center;
gap:7px;
text-decoration:none;
border:0;
padding:15px 18px;
border-radius:17px;
font-weight:900;
cursor:pointer;
color:#0f172a;
background:white;
box-shadow:0 10px 24px rgba(15,23,42,.08);
white-space:nowrap;
}
.top-btn.primary{
color:white;
background:linear-gradient(135deg,#2563eb,#7c3aed);
}
.stats{
display:grid;
grid-template-columns:repeat(6,1fr);
gap:16px;
margin-bottom:24px;
}
.stat{
background:white;
border-radius:23px;
padding:20px;
box-shadow:0 12px 28px rgba(15,23,42,.07);
border:1px solid #e5e7eb;
}
.stat h3{
margin:0;
font-size:28px;
letter-spacing:-.04em;
}
.stat p{
margin:6px 0 0;
color:#64748b;
font-weight:800;
font-size:13px;
}
.board{
display:grid;
grid-template-columns:repeat(5,minmax(270px,1fr));
gap:16px;
overflow-x:auto;
padding-bottom:10px;
}
.column{
background:rgba(255,255,255,.78);
border:1px solid #e2e8f0;
border-radius:24px;
padding:14px;
min-height:520px;
box-shadow:0 10px 28px rgba(15,23,42,.05);
}
.column h3{
margin:6px 6px 14px;
font-size:15px;
text-transform:uppercase;
}
.count{
background:#2563eb;
color:white;
padding:4px 9px;
border-radius:999px;
margin-left:8px;
font-size:12px;
}
.empty{
color:#94a3b8;
padding:14px;
font-weight:700;
}
.job-card{
background:white;
border:1px solid #e5e7eb;
border-radius:21px;
padding:16px;
margin-bottom:14px;
box-shadow:0 14px 28px rgba(15,23,42,.08);
}
.job-top{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:12px;
}
.pill{
font-size:10px;
padding:6px 9px;
border-radius:999px;
font-weight:900;
}
.pill.new{background:#dbeafe;color:#1d4ed8}
.pill.assigned{background:#fef3c7;color:#92400e}
.pill.enroute{background:#ede9fe;color:#6d28d9}
.pill.completed{background:#dcfce7;color:#15803d}
.pill.paid{background:#e2e8f0;color:#334155}
.job-card p{
margin:7px 0;
font-size:13px;
line-height:1.3;
}
.job-card span{
color:#64748b;
font-weight:800;
}
.profit-good{color:#16a34a}
.profit-bad{color:#dc2626}
.details{
margin:10px 0;
padding:10px;
background:#f8fafc;
border-radius:13px;
font-size:13px;
color:#334155;
line-height:1.4;
}
select,input,textarea{
width:100%;
border:1px solid #e2e8f0;
border-radius:13px;
padding:12px;
margin-top:8px;
background:white;
font-size:14px;
}
textarea{min-height:70px}
.btn-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:9px;
margin-top:10px;
}
.btn{
text-align:center;
text-decoration:none;
border:0;
padding:12px 10px;
border-radius:14px;
color:white;
font-weight:900;
cursor:pointer;
font-size:13px;
}
.blue{background:linear-gradient(135deg,#2563eb,#06b6d4)}
.green{background:linear-gradient(135deg,#16a34a,#22c55e)}
.purple{background:linear-gradient(135deg,#7c3aed,#ec4899)}
.dark{background:linear-gradient(135deg,#111827,#374151)}
.orange{background:linear-gradient(135deg,#f59e0b,#f97316)}
.teal{background:linear-gradient(135deg,#0f766e,#14b8a6)}
.delete{
width:100%;
margin-top:10px;
border:0;
background:#fee2e2;
color:#991b1b;
border-radius:13px;
padding:11px;
font-weight:900;
cursor:pointer;
}
.add-panel{
margin-top:24px;
background:white;
border-radius:26px;
padding:22px;
box-shadow:0 14px 30px rgba(15,23,42,.07);
border:1px solid #e5e7eb;
}
.add-grid{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:12px;
}
.provider-grid{
display:grid;
grid-template-columns:repeat(5,1fr);
gap:12px;
}
.provider-card{
background:#f8fafc;
border:1px solid #e2e8f0;
border-radius:18px;
padding:15px;
}
.mobile-nav{display:none}

@media(max-width:1000px){
.sidebar{display:none}
.main{
margin-left:0;
width:100%;
padding:14px 12px 95px;
}
.topbar{display:block}
.topbar h2{font-size:22px}
.search{
width:100%;
max-width:none;
margin:14px 0;
font-size:16px;
}
.top-actions{
display:grid;
grid-template-columns:1fr 1fr;
gap:10px;
}
.stats{
grid-template-columns:repeat(2,1fr);
gap:10px;
}
.stat{
padding:14px;
border-radius:18px;
}
.stat h3{font-size:22px}
.board{
display:block;
overflow:visible;
}
.column{
margin-bottom:16px;
min-height:auto;
}
.job-card{
border-radius:18px;
padding:14px;
}
.add-grid,.provider-grid{
grid-template-columns:1fr;
}
.mobile-nav{
display:flex;
position:fixed;
bottom:12px;
left:12px;
right:12px;
background:white;
border-radius:22px;
box-shadow:0 15px 40px rgba(15,23,42,.2);
justify-content:space-around;
padding:13px;
z-index:999;
}
.mobile-nav a{
text-decoration:none;
color:#0f172a;
font-size:12px;
font-weight:900;
}
}
</style>
</head>

<body>
<div class="app">

<aside class="sidebar">
<div class="logo">
<div class="logo-badge">🛡️</div>
<div>
<h1>NLN</h1>
<small>CITYWIDE ROUTING</small>
</div>
</div>

<div class="nav-title">Dispatch</div>
<div class="nav">
<a class="active" href="/admin?token=${ADMIN_TOKEN}">▦ Dashboard</a>
<a href="#jobs">☎ Calls / Leads</a>
<a href="#jobs">▣ Jobs</a>
<a href="#providers">👤 Providers</a>
<a href="#addJob">➕ Add Job</a>
<a href="/admin/debug-leads?token=${ADMIN_TOKEN}">⬇ Export Jobs</a>
</div>

<div class="side-card">
<b>Today's Summary</b>
<p><span>Total Jobs</span><b>${leads.length}</b></p>
<p><span>Completed</span><b>${completed}</b></p>
<p><span>Revenue</span><b>${money(revenue)}</b></p>
<p><span>Profit</span><b>${money(profit)}</b></p>
</div>
</aside>

<main class="main">
<div class="topbar">
<div>
<h2>NLN Dispatch Command Center</h2>
<p>Citywide Routing Control Center</p>
</div>

<input class="search" placeholder="Search jobs, customers, providers...">

<div class="top-actions">
<a class="top-btn" href="#jobs">▣ Jobs</a>
<a class="top-btn primary" href="#addJob">+ Add Job</a>
</div>
</div>

<section class="stats">
<div class="stat"><h3>${leads.length}</h3><p>Total Leads</p></div>
<div class="stat"><h3>${money(revenue)}</h3><p>Job Amounts</p></div>
<div class="stat"><h3>${money(profit)}</h3><p>NLN Profit</p></div>
<div class="stat"><h3>${completed}</h3><p>Completed</p></div>
<div class="stat"><h3>${money(providerEarnings)}</h3><p>Provider Earnings</p></div>
<div class="stat"><h3>${leads.length}</h3><p>Total Jobs</p></div>
</section>

<section class="board" id="jobs">
${columns.map(([key,title]) => {
const items = leads.filter(l => (l.status || "new") === key);
return `
<div class="column">
<h3>${title} <span class="count">${items.length}</span></h3>
${items.map(card).join("") || `<p class="empty">No jobs</p>`}
</div>
`;
}).join("")}
</section>

<section class="add-panel" id="addJob">
<h2>Add Quick Job / LSA Message Lead</h2>
<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">
<div class="add-grid">
<input name="customer" placeholder="Customer name">
<input name="phone" placeholder="Customer phone">
<input name="service" placeholder="Service type">
<input name="location" placeholder="Location">
<input name="source" placeholder="Source: LSA / GMB / Manual">
<input name="jobAmount" type="number" placeholder="Job amount">
<input name="leadCost" type="number" placeholder="Lead cost">
<select name="providerId">
<option value="">Assign provider</option>
${providers.map(p => `<option value="${p.id}">${safe(p.name)}</option>`).join("")}
</select>
</div>

<textarea name="details" placeholder="Paste LSA message or call details here"></textarea>
<button class="btn blue" type="submit" style="margin-top:12px;width:220px;">Create Job</button>
</form>
</section>

<section class="add-panel" id="providers">
<h2>Providers</h2>
<div class="provider-grid">
${providers.map(p => `
<div class="provider-card">
<b>${safe(p.name)}</b>
<p><a href="tel:${safe(p.phone)}">${safe(p.phone)}</a></p>
<a class="btn green" href="tel:${safe(p.phone)}">Call</a>
</div>
`).join("")}
</div>
</section>
</main>
</div>

<div class="mobile-nav">
<a href="#jobs">▦ Board</a>
<a href="#addJob">➕ Add</a>
<a href="#providers">👤 Providers</a>
<a href="/admin?token=${ADMIN_TOKEN}">↻ Refresh</a>
</div>
</body>
</html>
`);
});

initDB().then(() => {
app.listen(PORT, () => {
console.log("NLN Fancy Dashboard running on port " + PORT);
});
});
