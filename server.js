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
customer_phone TEXT,
tracking_number TEXT,
source TEXT,
service TEXT,
duration TEXT,
recording TEXT,
lead_score TEXT,
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
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) return res.status(401).send("Admin locked");
next();
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function profit(l) {
return Number(l.job_amount || 0) - Number(l.lead_cost || 0);
}

function safe(v) {
return String(v ?? "").replace(/[&<>"']/g, m => ({
"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[m]));
}

app.get("/", (req, res) => res.redirect(`/admin?token=${ADMIN_TOKEN}`));
app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/admin/update/:id", requireAdmin, async (req, res) => {
try {
let status = req.body.quickStatus || req.body.lead_status || "new";
if (req.body.provider_assigned && status === "new") status = "assigned";

await pool.query(`
UPDATE leads
SET provider_assigned=$1,
lead_status=$2,
job_amount=$3,
lead_cost=$4,
provider_earnings=$5,
nln_profit=$6,
notes=$7
WHERE id=$8
`, [
req.body.provider_assigned || "",
status,
req.body.job_amount || "0",
req.body.lead_cost || "0",
String(Math.max(0, Number(req.body.job_amount || 0) - Number(req.body.lead_cost || 0))),
String(Number(req.body.job_amount || 0) - Number(req.body.lead_cost || 0)),
req.body.notes || "",
req.params.id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
} catch (e) {
res.status(500).send("Update error: " + e.message);
}
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
try {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
} catch (e) {
res.status(500).send("Delete error: " + e.message);
}
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
try {
await pool.query(`
INSERT INTO leads
(customer_phone, tracking_number, source, service, lead_status, provider_assigned, job_amount, lead_cost, notes)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`, [
req.body.customer_phone || req.body.phone || "Unknown",
req.body.tracking_number || "",
req.body.source || "Manual / LSA",
req.body.service || "Locksmith Service",
req.body.provider_assigned ? "assigned" : "new",
req.body.provider_assigned || "",
req.body.job_amount || "0",
req.body.lead_cost || "35",
req.body.notes || ""
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
} catch (e) {
res.status(500).send("Add job error: " + e.message);
}
});

app.get("/admin", requireAdmin, async (req, res) => {
const result = await pool.query("SELECT * FROM leads WHERE archived=false OR archived IS NULL ORDER BY id DESC");
const leads = result.rows;

const revenue = leads.reduce((s,l)=>s+Number(l.job_amount||0),0);
const costs = leads.reduce((s,l)=>s+Number(l.lead_cost||0),0);
const totalProfit = revenue - costs;
const completed = leads.filter(l => ["completed","paid"].includes(l.lead_status)).length;

const cols = [
["new","New Leads"],
["assigned","Assigned"],
["enroute","En Route"],
["completed","Completed"],
["paid","Paid / Closed"]
];

function card(l) {
const phone = l.customer_phone || l.tracking_number || "";
const providerPhone = providers[l.provider_assigned] || "";

return `
<div class="job-card">
<div class="job-top">
<b>Job #${l.id}</b>
<span class="pill ${safe(l.lead_status || "new")}">${safe(l.lead_status || "new").toUpperCase()}</span>
</div>

<p><b>Service:</b> ${safe(l.service)}</p>
<p><b>Customer Phone:</b> ${safe(l.customer_phone || "Unknown")}</p>
<p><b>Tracking:</b> ${safe(l.tracking_number || "")}</p>
<p><b>Provider:</b> ${safe(l.provider_assigned || "Not Assigned")}</p>
<p><b>Job Amount:</b> ${money(l.job_amount)}</p>
<p><b>Lead Cost:</b> ${money(l.lead_cost)}</p>
<p><b>Profit:</b> <span class="${profit(l)>=0 ? "good":"bad"}">${money(profit(l))}</span></p>

<details><summary>Lead Details</summary><div class="details">${safe(l.service || "No details")}</div></details>

<form method="POST" action="/admin/update/${l.id}?token=${ADMIN_TOKEN}">
<select name="provider_assigned">
<option value="">Assign Provider</option>
${Object.keys(providers).map(p => `<option value="${p}" ${l.provider_assigned===p?"selected":""}>${p}</option>`).join("")}
</select>

<select name="lead_status">
${["new","assigned","enroute","completed","paid"].map(s => `<option value="${s}" ${l.lead_status===s?"selected":""}>${s}</option>`).join("")}
</select>

<input name="job_amount" type="number" value="${safe(l.job_amount || 0)}">
<input name="lead_cost" type="number" value="${safe(l.lead_cost || 35)}">
<textarea name="notes" placeholder="Admin notes">${safe(l.notes || "")}</textarea>

<div class="btn-grid">
<button class="btn blue" type="submit">Save</button>
<a class="btn green" href="tel:${safe(phone)}">Call</a>
<a class="btn purple" href="${providerPhone ? `sms:${safe(providerPhone)}` : "#"}">Text Provider</a>
<button class="btn orange" type="submit" name="quickStatus" value="enroute">En Route</button>
<button class="btn dark" type="submit" name="quickStatus" value="completed">Complete</button>
<button class="btn teal" type="submit" name="quickStatus" value="paid">Paid</button>
</div>
</form>

<form method="POST" action="/admin/delete/${l.id}?token=${ADMIN_TOKEN}">
<button class="delete" type="submit">Delete Job</button>
</form>
</div>`;
}

res.send(`
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NLN Dispatch</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#f4f7fb;color:#0f172a}
.app{display:flex}.sidebar{width:250px;background:linear-gradient(180deg,#020617,#0f172a);color:white;position:fixed;top:0;bottom:0;padding:22px}
.logo h1{font-size:36px;margin:0}.nav a{display:block;color:white;text-decoration:none;padding:14px;border-radius:14px;margin:7px 0;font-weight:800}.nav a.active{background:linear-gradient(135deg,#2563eb,#7c3aed)}
.main{margin-left:250px;width:calc(100% - 250px);padding:24px}
.topbar{display:flex;justify-content:space-between;gap:15px;align-items:center}.search{padding:15px;border-radius:16px;border:1px solid #ddd;width:360px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:20px 0}.stat{background:white;border-radius:22px;padding:18px;box-shadow:0 10px 25px #0001}
.board{display:grid;grid-template-columns:repeat(5,minmax(270px,1fr));gap:16px;overflow-x:auto}.column{background:white;border-radius:24px;padding:14px;min-height:500px}
.job-card{background:white;border:1px solid #e5e7eb;border-radius:20px;padding:15px;margin-bottom:14px;box-shadow:0 12px 25px #0001}
.job-top{display:flex;justify-content:space-between}.pill{font-size:10px;padding:6px 9px;border-radius:999px;font-weight:900}.new{background:#dbeafe;color:#1d4ed8}.assigned{background:#fef3c7;color:#92400e}.enroute{background:#ede9fe;color:#6d28d9}.completed{background:#dcfce7;color:#15803d}.paid{background:#e2e8f0;color:#334155}
select,input,textarea{width:100%;padding:12px;margin-top:8px;border-radius:12px;border:1px solid #ddd}.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.btn{padding:12px;border:0;border-radius:13px;color:white;font-weight:900;text-align:center;text-decoration:none}.blue{background:#2563eb}.green{background:#16a34a}.purple{background:#9333ea}.orange{background:#ea580c}.dark{background:#111827}.teal{background:#0f766e}.delete{width:100%;padding:11px;border:0;border-radius:12px;background:#fee2e2;color:#991b1b;margin-top:10px;font-weight:900}
.good{color:#16a34a}.bad{color:#dc2626}.add-panel{background:white;border-radius:24px;padding:22px;margin-top:22px}.add-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media(max-width:1000px){.sidebar{display:none}.main{margin-left:0;width:100%;padding:14px 12px 90px}.topbar{display:block}.search{width:100%;margin:12px 0}.stats{grid-template-columns:repeat(2,1fr)}.board{display:block}.column{margin-bottom:16px;min-height:auto}.add-grid{grid-template-columns:1fr}}
</style></head><body>
<div class="app"><aside class="sidebar"><div class="logo"><h1>NLN</h1><b>CITYWIDE ROUTING</b></div><div class="nav"><a class="active" href="/admin?token=${ADMIN_TOKEN}">Dashboard</a><a href="#addJob">Add Job</a></div></aside>
<main class="main"><div class="topbar"><div><h1>NLN Dispatch Command Center</h1><p>Citywide Routing Control Center</p></div><input class="search" placeholder="Search jobs..."></div>
<section class="stats"><div class="stat"><h2>${leads.length}</h2><p>Total Leads</p></div><div class="stat"><h2>${money(revenue)}</h2><p>Job Amounts</p></div><div class="stat"><h2>${money(totalProfit)}</h2><p>NLN Profit</p></div><div class="stat"><h2>${completed}</h2><p>Completed</p></div></section>
<section class="board">${cols.map(([key,title])=>{const items=leads.filter(l=>(l.lead_status||"new")===key);return `<div class="column"><h3>${title} (${items.length})</h3>${items.map(card).join("") || "<p>No jobs</p>"}</div>`}).join("")}</section>
<section class="add-panel" id="addJob"><h2>Add Quick Job</h2><form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}"><div class="add-grid"><input name="customer_phone" placeholder="Customer phone"><input name="service" placeholder="Service"><input name="source" placeholder="Source"><input name="job_amount" type="number" placeholder="Job amount"><input name="lead_cost" type="number" placeholder="Lead cost"><select name="provider_assigned"><option value="">Assign provider</option>${Object.keys(providers).map(p=>`<option value="${p}">${p}</option>`).join("")}</select></div><textarea name="notes" placeholder="Notes"></textarea><button class="btn blue" style="margin-top:12px">Create Job</button></form></section>
</main></div></body></html>`);
});

initDB().then(() => app.listen(PORT, () => console.log("NLN fixed running")));
