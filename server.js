const express = require("express");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

let providers = [
{ id: 1, name: "Max", phone: "+14436792242", balance: 500, earnings: 0 },
{ id: 2, name: "Dreh", phone: "+12024125443", balance: 500, earnings: 0 },
{ id: 3, name: "Tee", phone: "+14104199281", balance: 500, earnings: 0 },
{ id: 4, name: "Robyn", phone: "+14434199281", balance: 500, earnings: 0 }
];

let leads = [
{
id: 43,
customer: "Unknown",
phone: "Unknown",
trackingNumber: "+14437819117",
source: "Google My Business",
service: "Car Key Replacement",
location: "Edgewood Area",
details: "Customer called about key cutting for a 2006 Hyundai Tucson. Customer accepted quote and ended call.",
providerId: null,
status: "new",
jobAmount: 0,
leadCost: 35,
notes: "",
createdAt: new Date().toLocaleString()
}
];

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function getProvider(id) {
return providers.find(p => String(p.id) === String(id));
}

function profit(lead) {
return Number(lead.jobAmount || 0) - Number(lead.leadCost || 0);
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) {
return res.status(401).send(`
<h2>NLN Admin Locked</h2>
<p>Add your admin token to the URL:</p>
<p><b>?token=${ADMIN_TOKEN}</b></p>
`);
}
next();
}

app.get("/health", (req, res) => {
res.json({ ok: true, system: "NLN Routing Dashboard" });
});

app.post("/lead/new", (req, res) => {
const body = req.body || {};
const lead = {
id: Date.now(),
customer: body.customer || "Unknown",
phone: body.phone || "Unknown",
trackingNumber: body.trackingNumber || "",
source: body.source || "Manual / LSA",
service: body.service || "Locksmith Service",
location: body.location || "",
details: body.details || "",
providerId: null,
status: "new",
jobAmount: Number(body.jobAmount || 0),
leadCost: Number(body.leadCost || 35),
notes: "",
createdAt: new Date().toLocaleString()
};

leads.unshift(lead);
res.json({ success: true, lead });
});

app.post("/admin/update/:id", requireAdmin, (req, res) => {
const lead = leads.find(l => String(l.id) === String(req.params.id));
if (!lead) return res.redirect("/admin?token=" + ADMIN_TOKEN);

lead.providerId = req.body.providerId || null;
lead.status = req.body.status || lead.status;
lead.jobAmount = Number(req.body.jobAmount || 0);
lead.leadCost = Number(req.body.leadCost || 0);
lead.notes = req.body.notes || "";

res.redirect("/admin?token=" + ADMIN_TOKEN);
});

app.post("/admin/add-job", requireAdmin, (req, res) => {
leads.unshift({
id: Date.now(),
customer: req.body.customer || "Unknown",
phone: req.body.phone || "Unknown",
trackingNumber: req.body.trackingNumber || "",
source: req.body.source || "Manual",
service: req.body.service || "Locksmith Service",
location: req.body.location || "",
details: req.body.details || "",
providerId: req.body.providerId || null,
status: req.body.status || "new",
jobAmount: Number(req.body.jobAmount || 0),
leadCost: Number(req.body.leadCost || 35),
notes: req.body.notes || "",
createdAt: new Date().toLocaleString()
});

res.redirect("/admin?token=" + ADMIN_TOKEN);
});

app.get("/", (req, res) => {
res.redirect("/admin?token=" + ADMIN_TOKEN);
});

app.get("/admin", requireAdmin, (req, res) => {
const totalLeads = leads.length;
const totalJobs = leads.reduce((sum, l) => sum + Number(l.jobAmount || 0), 0);
const totalLeadCost = leads.reduce((sum, l) => sum + Number(l.leadCost || 0), 0);
const totalProfit = totalJobs - totalLeadCost;
const completed = leads.filter(l => l.status === "completed" || l.status === "paid").length;
const providerEarnings = leads.reduce((sum, l) => {
if (l.providerId) return sum + Math.max(0, Number(l.jobAmount || 0) - Number(l.leadCost || 0));
return sum;
}, 0);

const columns = [
{ key: "new", title: "New Leads" },
{ key: "assigned", title: "Assigned" },
{ key: "enroute", title: "En Route" },
{ key: "completed", title: "Completed" },
{ key: "paid", title: "Paid / Closed" }
];

function leadCard(l) {
const provider = getProvider(l.providerId);
return `
<div class="job-card">
<div class="job-top">
<b>Job #${l.id}</b>
<span class="pill ${l.status}">${l.status.toUpperCase()}</span>
</div>

<p><span>Service:</span> ${l.service}</p>
<p><span>Location:</span> ${l.location || "Not set"}</p>
<p><span>Customer:</span> ${l.customer}</p>
<p><span>Phone:</span> ${l.phone}</p>
<p><span>Provider:</span> ${provider ? provider.name : "Not Assigned"}</p>
<p><span>Job Amount:</span> ${money(l.jobAmount)}</p>
<p><span>Lead Cost:</span> ${money(l.leadCost)}</p>
<p><span>Profit:</span> <b class="${profit(l) >= 0 ? "green" : "red"}">${money(profit(l))}</b></p>

<details>
<summary>Lead Details</summary>
<div class="details">${l.details || "No details"}</div>
</details>

<form method="POST" action="/admin/update/${l.id}?token=${ADMIN_TOKEN}">
<select name="providerId">
<option value="">Assign Provider</option>
${providers.map(p => `
<option value="${p.id}" ${String(p.id) === String(l.providerId) ? "selected" : ""}>
${p.name}
</option>
`).join("")}
</select>

<select name="status">
${["new","assigned","enroute","completed","paid"].map(s => `
<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>
`).join("")}
</select>

<input name="jobAmount" type="number" placeholder="Job amount" value="${l.jobAmount}">
<input name="leadCost" type="number" placeholder="Lead cost" value="${l.leadCost}">
<textarea name="notes" placeholder="Admin notes">${l.notes || ""}</textarea>

<div class="btn-grid">
<button class="btn blue">Save</button>
<a class="btn green" href="tel:${l.phone}">Call</a>
<a class="btn purple" href="sms:${provider ? provider.phone : ""}">Text Provider</a>
<button class="btn dark" name="status" value="completed">Complete</button>
</div>
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
body{
margin:0;
font-family:Inter,Arial,sans-serif;
background:#f5f7fb;
color:#0f172a;
}
.app{
display:flex;
min-height:100vh;
}
.sidebar{
width:250px;
background:linear-gradient(180deg,#020617,#0f172a);
color:white;
padding:22px;
position:fixed;
top:0;
bottom:0;
left:0;
}
.logo{
display:flex;
align-items:center;
gap:12px;
margin-bottom:28px;
}
.logo-badge{
width:50px;
height:50px;
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
font-size:34px;
letter-spacing:-2px;
}
.logo small{
font-weight:800;
opacity:.75;
}
.nav a{
display:flex;
gap:12px;
align-items:center;
text-decoration:none;
color:white;
padding:14px 16px;
border-radius:14px;
margin:6px 0;
font-weight:700;
opacity:.82;
}
.nav a.active,.nav a:hover{
background:linear-gradient(135deg,#2563eb,#7c3aed);
opacity:1;
}
.side-card{
margin-top:28px;
background:rgba(255,255,255,.08);
border:1px solid rgba(255,255,255,.12);
border-radius:20px;
padding:18px;
}
.side-card p{
display:flex;
justify-content:space-between;
margin:10px 0;
font-size:14px;
}
.main{
margin-left:250px;
width:calc(100% - 250px);
padding:22px 28px 90px;
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
font-size:28px;
}
.topbar p{margin:5px 0;color:#64748b}
.search{
flex:1;
max-width:430px;
padding:16px 18px;
border-radius:16px;
border:1px solid #e2e8f0;
}
.top-actions{
display:flex;
gap:12px;
}
.top-btn{
border:0;
padding:15px 18px;
border-radius:16px;
font-weight:900;
cursor:pointer;
background:white;
box-shadow:0 8px 20px rgba(15,23,42,.08);
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
border-radius:22px;
padding:20px;
box-shadow:0 10px 25px rgba(15,23,42,.07);
border:1px solid #e5e7eb;
}
.stat h3{
margin:0;
font-size:28px;
}
.stat p{
margin:5px 0 0;
color:#64748b;
font-weight:700;
font-size:13px;
}
.board{
display:grid;
grid-template-columns:repeat(5, minmax(260px,1fr));
gap:16px;
overflow-x:auto;
}
.column{
background:rgba(255,255,255,.7);
border:1px solid #e2e8f0;
border-radius:22px;
padding:14px;
min-height:500px;
}
.column h3{
margin:5px 5px 14px;
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
.job-card{
background:white;
border:1px solid #e5e7eb;
border-radius:20px;
padding:16px;
margin-bottom:14px;
box-shadow:0 12px 25px rgba(15,23,42,.08);
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
}
.job-card span{
color:#64748b;
font-weight:700;
}
.green{color:#16a34a}
.red{color:#dc2626}
.details{
margin:10px 0;
padding:10px;
background:#f8fafc;
border-radius:12px;
font-size:13px;
color:#334155;
}
select,input,textarea{
width:100%;
border:1px solid #e2e8f0;
border-radius:12px;
padding:12px;
margin-top:8px;
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
padding:12px;
border-radius:13px;
color:white;
font-weight:900;
cursor:pointer;
font-size:13px;
}
.blue{background:linear-gradient(135deg,#2563eb,#06b6d4)}
.green{background:linear-gradient(135deg,#16a34a,#22c55e);color:white}
.purple{background:linear-gradient(135deg,#7c3aed,#ec4899)}
.dark{background:linear-gradient(135deg,#111827,#374151)}
.add-panel{
margin-top:24px;
background:white;
border-radius:24px;
padding:22px;
box-shadow:0 12px 25px rgba(15,23,42,.07);
}
.add-grid{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:12px;
}
.mobile-nav{
display:none;
}
@media(max-width:1000px){
.sidebar{display:none}
.main{margin-left:0;width:100%;padding:16px 16px 90px}
.topbar{display:block}
.search{width:100%;max-width:none;margin:15px 0}
.stats{grid-template-columns:repeat(2,1fr)}
.board{grid-template-columns:1fr}
.add-grid{grid-template-columns:1fr}
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
padding:12px;
z-index:99;
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

<div class="nav">
<a class="active">▦ Dispatch</a>
<a>☎ Calls / Leads</a>
<a>▣ Jobs</a>
<a>👤 Providers</a>
<a>👥 Customers</a>
<a>▤ Invoices</a>
<a>💳 Payments</a>
<a>📊 Reports</a>
<a>⚙ Settings</a>
</div>

<div class="side-card">
<b>Today's Summary</b>
<p><span>Total Jobs</span><b>${totalLeads}</b></p>
<p><span>Completed</span><b>${completed}</b></p>
<p><span>Revenue</span><b>${money(totalJobs)}</b></p>
<p><span>Profit</span><b>${money(totalProfit)}</b></p>
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
<button class="top-btn">☎ Call Logs</button>
<button class="top-btn">💬 Messages</button>
<button class="top-btn primary">+ Add Job</button>
</div>
</div>

<section class="stats">
<div class="stat"><h3>${totalLeads}</h3><p>Total Leads</p></div>
<div class="stat"><h3>${money(totalJobs)}</h3><p>Job Amounts</p></div>
<div class="stat"><h3>${money(totalProfit)}</h3><p>NLN Profit</p></div>
<div class="stat"><h3>${completed}</h3><p>Completed</p></div>
<div class="stat"><h3>${money(providerEarnings)}</h3><p>Provider Earnings</p></div>
<div class="stat"><h3>${leads.length}</h3><p>Total Jobs</p></div>
</section>

<section class="board">
${columns.map(col => {
const items = leads.filter(l => l.status === col.key);
return `
<div class="column">
<h3>${col.title} <span class="count">${items.length}</span></h3>
${items.map(leadCard).join("") || `<p style="color:#94a3b8;padding:15px;">No jobs</p>`}
</div>
`;
}).join("")}
</section>

<section class="add-panel">
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
${providers.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
</select>
</div>
<textarea name="details" placeholder="Paste LSA message or call details here"></textarea>
<button class="btn blue" style="margin-top:12px;width:220px;">Create Job</button>
</form>
</section>
</main>
</div>

<div class="mobile-nav">
<a>▦ Board</a>
<a>▣ Jobs</a>
<a>👤 Providers</a>
<a>⚙ More</a>
</div>

</body>
</html>
`);
});

app.listen(PORT, () => {
console.log("NLN Dashboard running on port " + PORT);
});
