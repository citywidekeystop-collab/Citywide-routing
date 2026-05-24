const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

let providers = [
{ id: 1, name: "Max", phone: "+14436792242" },
{ id: 2, name: "Dreh", phone: "+12024125443" },
{ id: 3, name: "Tee", phone: "+14104199281" },
{ id: 4, name: "Robyn", phone: "+14434199281" }
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
details: "Customer called to inquire about key cutting services for a 2006 Hyundai Tucson in the Edgewood area.",
providerId: "",
status: "new",
jobAmount: 0,
leadCost: 35,
notes: "",
createdAt: new Date().toLocaleString()
}
];

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) {
return res.status(401).send(`
<h2>NLN Admin Locked</h2>
<p>Use your admin link:</p>
<b>/admin?token=${ADMIN_TOKEN}</b>
`);
}
next();
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function getProvider(id) {
return providers.find(p => String(p.id) === String(id));
}

function leadProfit(l) {
return Number(l.jobAmount || 0) - Number(l.leadCost || 0);
}

function safeCallNumber(l) {
if (l.phone && l.phone !== "Unknown") return l.phone;
if (l.trackingNumber) return l.trackingNumber;
return "";
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({ ok: true, app: "NLN Dispatch Dashboard" });
});

app.post("/lead/new", (req, res) => {
const b = req.body;

leads.unshift({
id: Date.now(),
customer: b.customer || "Unknown",
phone: b.phone || "Unknown",
trackingNumber: b.trackingNumber || "",
source: b.source || "Manual / LSA",
service: b.service || "Locksmith Service",
location: b.location || "",
details: b.details || "",
providerId: "",
status: "new",
jobAmount: Number(b.jobAmount || 0),
leadCost: Number(b.leadCost || 35),
notes: "",
createdAt: new Date().toLocaleString()
});

res.json({ success: true });
});

app.post("/admin/add-job", requireAdmin, (req, res) => {
const b = req.body;

leads.unshift({
id: Date.now(),
customer: b.customer || "Unknown",
phone: b.phone || "Unknown",
trackingNumber: b.trackingNumber || "",
source: b.source || "Manual",
service: b.service || "Locksmith Service",
location: b.location || "",
details: b.details || "",
providerId: b.providerId || "",
status: b.providerId ? "assigned" : "new",
jobAmount: Number(b.jobAmount || 0),
leadCost: Number(b.leadCost || 35),
notes: "",
createdAt: new Date().toLocaleString()
});

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/update/:id", requireAdmin, (req, res) => {
const lead = leads.find(l => String(l.id) === String(req.params.id));
if (!lead) return res.redirect(`/admin?token=${ADMIN_TOKEN}`);

lead.providerId = req.body.providerId || "";
lead.status = req.body.quickStatus || req.body.status || lead.status;
lead.jobAmount = Number(req.body.jobAmount || 0);
lead.leadCost = Number(req.body.leadCost || 0);
lead.notes = req.body.notes || "";

if (lead.providerId && lead.status === "new") lead.status = "assigned";

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, (req, res) => {
leads = leads.filter(l => String(l.id) !== String(req.params.id));
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/admin", requireAdmin, (req, res) => {
const totalLeads = leads.length;
const revenue = leads.reduce((s, l) => s + Number(l.jobAmount || 0), 0);
const leadCosts = leads.reduce((s, l) => s + Number(l.leadCost || 0), 0);
const profit = revenue - leadCosts;
const completed = leads.filter(l => l.status === "completed" || l.status === "paid").length;

const columns = [
{ key: "new", title: "New Leads" },
{ key: "assigned", title: "Assigned" },
{ key: "enroute", title: "En Route" },
{ key: "completed", title: "Completed" },
{ key: "paid", title: "Paid / Closed" }
];

function card(l) {
const provider = getProvider(l.providerId);
const callNum = safeCallNumber(l);

return `
<div class="job-card">
<div class="job-head">
<b>Job #${l.id}</b>
<span class="pill ${l.status}">${l.status.toUpperCase()}</span>
</div>

<p><b>Service:</b> ${l.service}</p>
<p><b>Location:</b> ${l.location || "Not set"}</p>
<p><b>Customer:</b> ${l.customer}</p>
<p><b>Phone:</b> ${l.phone}</p>
<p><b>Provider:</b> ${provider ? provider.name : "Not Assigned"}</p>
<p><b>Job Amount:</b> ${money(l.jobAmount)}</p>
<p><b>Lead Cost:</b> ${money(l.leadCost)}</p>
<p><b>Profit:</b> <span class="${leadProfit(l) >= 0 ? "good" : "bad"}">${money(leadProfit(l))}</span></p>

<details>
<summary>Lead Details</summary>
<div class="details">${l.details || "No details"}</div>
</details>

<form method="POST" action="/admin/update/${l.id}?token=${ADMIN_TOKEN}">
<select name="providerId">
<option value="">Assign Provider</option>
${providers.map(p => `
<option value="${p.id}" ${String(p.id) === String(l.providerId) ? "selected" : ""}>${p.name}</option>
`).join("")}
</select>

<select name="status">
${["new","assigned","enroute","completed","paid"].map(s => `
<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>
`).join("")}
</select>

<input name="jobAmount" type="number" value="${l.jobAmount}" placeholder="Job amount">
<input name="leadCost" type="number" value="${l.leadCost}" placeholder="Lead cost">
<textarea name="notes" placeholder="Admin notes">${l.notes || ""}</textarea>

<div class="btn-grid">
<button class="btn blue" type="submit">Save</button>
<a class="btn green" href="tel:${callNum}">Call</a>
<a class="btn purple" href="${provider ? `sms:${provider.phone}` : "#"}">Text Provider</a>
<button class="btn dark" type="submit" name="quickStatus" value="completed">Complete</button>
<button class="btn orange" type="submit" name="quickStatus" value="enroute">En Route</button>
<button class="btn paid" type="submit" name="quickStatus" value="paid">Paid</button>
</div>
</form>

<form method="POST" action="/admin/delete/${l.id}?token=${ADMIN_TOKEN}">
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
body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;color:#0f172a}
.app{display:flex;min-height:100vh}
.sidebar{width:245px;background:linear-gradient(180deg,#020617,#111827);color:white;padding:22px;position:fixed;top:0;bottom:0}
.logo{display:flex;gap:12px;align-items:center;margin-bottom:25px}
.logo-icon{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:25px}
.logo h1{margin:0;font-size:32px}
.logo small{font-weight:800;font-size:11px;opacity:.8}
.nav a{display:block;color:white;text-decoration:none;padding:14px 15px;border-radius:14px;margin:7px 0;font-weight:800;opacity:.82}
.nav a.active,.nav a:hover{background:linear-gradient(135deg,#2563eb,#7c3aed);opacity:1}
.side-card{margin-top:28px;background:rgba(255,255,255,.08);border-radius:20px;padding:16px}
.side-card p{display:flex;justify-content:space-between;margin:8px 0;font-size:13px}
.main{margin-left:245px;width:calc(100% - 245px);padding:22px 28px 95px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:20px}
.topbar h2{margin:0;font-size:28px}
.topbar p{margin:5px 0;color:#64748b}
.search{padding:15px;border:1px solid #e2e8f0;border-radius:15px;width:360px}
.top-btn{display:inline-block;text-decoration:none;border:0;padding:15px 18px;border-radius:16px;font-weight:900;color:#0f172a;background:white;box-shadow:0 8px 22px rgba(15,23,42,.08)}
.top-btn.primary{color:white;background:linear-gradient(135deg,#2563eb,#7c3aed)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}
.stat{background:white;border:1px solid #e5e7eb;border-radius:22px;padding:20px;box-shadow:0 12px 25px rgba(15,23,42,.07)}
.stat h3{margin:0;font-size:30px}
.stat p{margin:5px 0 0;color:#64748b;font-weight:800}
.board{display:grid;grid-template-columns:repeat(5,minmax(260px,1fr));gap:16px;overflow-x:auto}
.column{background:rgba(255,255,255,.8);border:1px solid #e2e8f0;border-radius:22px;padding:14px;min-height:440px}
.column h3{font-size:14px;text-transform:uppercase}
.count{background:#2563eb;color:white;border-radius:999px;padding:4px 8px;font-size:12px}
.job-card{background:white;border:1px solid #e5e7eb;border-radius:20px;padding:16px;margin-bottom:14px;box-shadow:0 12px 25px rgba(15,23,42,.08)}
.job-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.job-card p{font-size:13px;margin:7px 0}
.pill{font-size:10px;padding:6px 9px;border-radius:999px;font-weight:900}
.pill.new{background:#dbeafe;color:#1d4ed8}
.pill.assigned{background:#fef3c7;color:#92400e}
.pill.enroute{background:#ede9fe;color:#6d28d9}
.pill.completed{background:#dcfce7;color:#15803d}
.pill.paid{background:#e2e8f0;color:#334155}
.good{color:#16a34a;font-weight:900}
.bad{color:#dc2626;font-weight:900}
.details{background:#f8fafc;padding:10px;border-radius:12px;margin:10px 0;font-size:13px}
select,input,textarea{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-top:8px}
textarea{min-height:65px}
.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
.btn{text-align:center;text-decoration:none;border:0;padding:12px;border-radius:13px;color:white;font-weight:900;font-size:13px;cursor:pointer}
.blue{background:linear-gradient(135deg,#2563eb,#06b6d4)}
.green{background:linear-gradient(135deg,#16a34a,#22c55e)}
.purple{background:linear-gradient(135deg,#7c3aed,#ec4899)}
.dark{background:linear-gradient(135deg,#111827,#374151)}
.orange{background:linear-gradient(135deg,#f59e0b,#f97316)}
.paid{background:linear-gradient(135deg,#0f766e,#14b8a6)}
.delete{width:100%;margin-top:10px;border:0;background:#fee2e2;color:#991b1b;border-radius:12px;padding:11px;font-weight:900}
.add-panel{margin-top:24px;background:white;border-radius:24px;padding:22px;box-shadow:0 12px 25px rgba(15,23,42,.07)}
.add-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.mobile-nav{display:none}

@media(max-width:1000px){
.sidebar{display:none}
.main{margin-left:0;width:100%;padding:14px 12px 95px}
.topbar{display:block}
.topbar h2{font-size:22px}
.search{width:100%;margin:14px 0;font-size:16px}
.stats{grid-template-columns:repeat(2,1fr);gap:10px}
.stat{padding:14px;border-radius:18px}
.stat h3{font-size:22px}
.board{display:block;overflow:visible}
.column{margin-bottom:16px;min-height:auto}
.add-grid{grid-template-columns:1fr}
.mobile-nav{display:flex;position:fixed;bottom:12px;left:12px;right:12px;background:white;border-radius:22px;box-shadow:0 15px 40px rgba(15,23,42,.2);justify-content:space-around;padding:13px;z-index:999}
.mobile-nav a{text-decoration:none;color:#0f172a;font-size:12px;font-weight:900}
}
</style>
</head>

<body>
<div class="app">
<aside class="sidebar">
<div class="logo">
<div class="logo-icon">🛡️</div>
<div><h1>NLN</h1><small>CITYWIDE ROUTING</small></div>
</div>

<div class="nav">
<a class="active" href="/admin?token=${ADMIN_TOKEN}">▦ Dispatch</a>
<a href="#addJob">☎ Calls / Leads</a>
<a href="#jobs">▣ Jobs</a>
<a href="#providers">👤 Providers</a>
<a href="#addJob">➕ Add Job</a>
</div>

<div class="side-card">
<b>Today's Summary</b>
<p><span>Total Jobs</span><b>${totalLeads}</b></p>
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

<div>
<a class="top-btn" href="#jobs">Jobs</a>
<a class="top-btn primary" href="#addJob">+ Add Job</a>
</div>
</div>

<section class="stats">
<div class="stat"><h3>${totalLeads}</h3><p>Total Leads</p></div>
<div class="stat"><h3>${money(revenue)}</h3><p>Job Amounts</p></div>
<div class="stat"><h3>${money(profit)}</h3><p>NLN Profit</p></div>
<div class="stat"><h3>${completed}</h3><p>Completed</p></div>
</section>

<section class="board" id="jobs">
${columns.map(col => {
const items = leads.filter(l => l.status === col.key);
return `
<div class="column">
<h3>${col.title} <span class="count">${items.length}</span></h3>
${items.map(card).join("") || `<p style="color:#94a3b8;padding:12px;">No jobs</p>`}
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
${providers.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
</select>
</div>

<textarea name="details" placeholder="Paste LSA message or call details here"></textarea>
<button class="btn blue" type="submit" style="margin-top:12px;width:220px;">Create Job</button>
</form>
</section>

<section class="add-panel" id="providers">
<h2>Providers</h2>
${providers.map(p => `<p><b>${p.name}</b> — <a href="tel:${p.phone}">${p.phone}</a></p>`).join("")}
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

app.listen(PORT, () => {
console.log("NLN Dashboard running on port " + PORT);
});
