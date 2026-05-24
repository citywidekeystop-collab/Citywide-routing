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
ssl: {
rejectUnauthorized: false
}
});

const providers = [
{ id: 1, name: "Max", phone: "+14436792242" },
{ id: 2, name: "Dreh", phone: "+12024125443" },
{ id: 3, name: "Tee", phone: "+14104199281" },
{ id: 4, name: "Robyn", phone: "+14435781866" }
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
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function getProvider(id) {
return providers.find(p => String(p.id) === String(id));
}

function profit(job) {
return Number(job.job_amount || 0) - Number(job.lead_cost || 0);
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];

if (token !== ADMIN_TOKEN) {
return res.status(401).send(`
<h2>NLN Admin Locked</h2>
<p>Use:</p>
<b>/admin?token=${ADMIN_TOKEN}</b>
`);
}

next();
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({
ok: true,
app: "NLN Dispatch Dashboard"
});
});

app.get("/admin/debug-leads", async (req, res) => {
try {
const result = await pool.query(
"SELECT * FROM leads ORDER BY created_at DESC LIMIT 100"
);

res.json(result.rows);
} catch (err) {
res.status(500).json({
error: err.message
});
}
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
const b = req.body;

await pool.query(`
INSERT INTO leads (
customer,
phone,
tracking_number,
source,
service,
location,
details,
provider_id,
status,
job_amount,
lead_cost,
notes
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

await pool.query(`
UPDATE leads
SET
provider_id = $1,
status = $2,
job_amount = $3,
lead_cost = $4,
notes = $5
WHERE id = $6
`, [
req.body.providerId || "",
req.body.quickStatus || req.body.status || "new",
Number(req.body.jobAmount || 0),
Number(req.body.leadCost || 0),
req.body.notes || "",
id
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query(
"DELETE FROM leads WHERE id = $1",
[req.params.id]
);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/admin", requireAdmin, async (req, res) => {
const result = await pool.query(
"SELECT * FROM leads ORDER BY created_at DESC"
);

const leads = result.rows;

const totalRevenue = leads.reduce(
(s, l) => s + Number(l.job_amount || 0),
0
);

const totalCost = leads.reduce(
(s, l) => s + Number(l.lead_cost || 0),
0
);

const totalProfit = totalRevenue - totalCost;

const completed = leads.filter(
l => l.status === "completed" || l.status === "paid"
).length;

const columns = [
["new", "New Leads"],
["assigned", "Assigned"],
["enroute", "En Route"],
["completed", "Completed"],
["paid", "Paid / Closed"]
];

function card(l) {
const provider = getProvider(l.provider_id);

const callNumber =
l.phone && l.phone !== "Unknown"
? l.phone
: l.tracking_number || "";

return `
<div class="job-card">
<div class="job-head">
<b>Job #${l.id}</b>
<span class="pill ${l.status}">
${l.status.toUpperCase()}
</span>
</div>

<p><b>Service:</b> ${l.service}</p>
<p><b>Location:</b> ${l.location || "Not set"}</p>
<p><b>Customer:</b> ${l.customer}</p>
<p><b>Phone:</b> ${l.phone}</p>
<p><b>Provider:</b> ${provider ? provider.name : "Not Assigned"}</p>

<p><b>Job Amount:</b> ${money(l.job_amount)}</p>
<p><b>Lead Cost:</b> ${money(l.lead_cost)}</p>

<p>
<b>Profit:</b>
<span class="${profit(l) >= 0 ? "good" : "bad"}">
${money(profit(l))}
</span>
</p>

<details>
<summary>Lead Details</summary>
<div class="details">
${l.details || "No details"}
</div>
</details>

<form method="POST"
action="/admin/update/${l.id}?token=${ADMIN_TOKEN}">

<select name="providerId">
<option value="">Assign Provider</option>

${providers.map(p => `
<option value="${p.id}"
${String(p.id) === String(l.provider_id)
? "selected"
: ""}>
${p.name}
</option>
`).join("")}
</select>

<select name="status">
${["new","assigned","enroute","completed","paid"]
.map(s => `
<option value="${s}"
${l.status === s ? "selected" : ""}>
${s}
</option>
`).join("")}
</select>

<input
name="jobAmount"
type="number"
value="${l.job_amount}"
placeholder="Job amount">

<input
name="leadCost"
type="number"
value="${l.lead_cost}"
placeholder="Lead cost">

<textarea
name="notes"
placeholder="Admin notes">${l.notes || ""}</textarea>

<div class="btn-grid">
<button class="btn blue" type="submit">
Save
</button>

<a class="btn green"
href="tel:${callNumber}">
Call
</a>

<a class="btn purple"
href="${provider ? `sms:${provider.phone}` : "#"}">
Text Provider
</a>

<button class="btn orange"
type="submit"
name="quickStatus"
value="enroute">
En Route
</button>

<button class="btn dark"
type="submit"
name="quickStatus"
value="completed">
Complete
</button>

<button class="btn paid"
type="submit"
name="quickStatus"
value="paid">
Paid
</button>
</div>
</form>

<form method="POST"
action="/admin/delete/${l.id}?token=${ADMIN_TOKEN}">
<button class="delete">
Delete Job
</button>
</form>
</div>
`;
}

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>NLN Dispatch Command Center</title>

<style>
body{
margin:0;
font-family:Arial;
background:#f5f7fb;
}
.main{
padding:18px;
}
.board{
display:grid;
grid-template-columns:repeat(5,minmax(280px,1fr));
gap:15px;
overflow-x:auto;
}
.column{
background:white;
border-radius:22px;
padding:14px;
}
.job-card{
background:#fff;
border:1px solid #e5e7eb;
border-radius:18px;
padding:14px;
margin-bottom:12px;
box-shadow:0 8px 18px rgba(0,0,0,.06);
}
.job-head{
display:flex;
justify-content:space-between;
margin-bottom:10px;
}
.pill{
padding:5px 8px;
border-radius:999px;
font-size:10px;
font-weight:900;
}
.new{background:#dbeafe;color:#1d4ed8}
.assigned{background:#fef3c7;color:#92400e}
.enroute{background:#ede9fe;color:#6d28d9}
.completed{background:#dcfce7;color:#15803d}
.paid{background:#e2e8f0;color:#334155}
.btn-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:8px;
margin-top:10px;
}
.btn{
padding:11px;
border-radius:12px;
border:0;
color:white;
font-weight:800;
cursor:pointer;
text-align:center;
text-decoration:none;
}
.blue{background:#2563eb}
.green{background:#16a34a}
.purple{background:#9333ea}
.orange{background:#ea580c}
.dark{background:#111827}
.paid{background:#0f766e}
.delete{
width:100%;
margin-top:10px;
padding:11px;
border:0;
border-radius:12px;
background:#fee2e2;
font-weight:800;
}
.good{color:#16a34a}
.bad{color:#dc2626}
.details{
background:#f8fafc;
padding:10px;
border-radius:12px;
margin:10px 0;
}
select,input,textarea{
width:100%;
padding:11px;
margin-top:8px;
border-radius:10px;
border:1px solid #d1d5db;
}
@media(max-width:1000px){
.board{
display:block;
}
.column{
margin-bottom:16px;
}
}
</style>
</head>

<body>
<div class="main">

<h1>NLN Dispatch Command Center</h1>

<p>
Revenue: ${money(totalRevenue)}
|
Profit: ${money(totalProfit)}
|
Completed: ${completed}
</p>

<div class="board">

${columns.map(([key,title]) => {
const items = leads.filter(l => l.status === key);

return `
<div class="column">
<h3>${title} (${items.length})</h3>
${items.map(card).join("")}
</div>
`;
}).join("")}

</div>

<br><br>

<h2>Add Quick Job</h2>

<form method="POST"
action="/admin/add-job?token=${ADMIN_TOKEN}">

<input name="customer" placeholder="Customer">
<input name="phone" placeholder="Phone">
<input name="service" placeholder="Service">
<input name="location" placeholder="Location">

<input name="source"
placeholder="Source: LSA / Manual">

<input name="jobAmount"
type="number"
placeholder="Job Amount">

<input name="leadCost"
type="number"
placeholder="Lead Cost">

<select name="providerId">
<option value="">Assign Provider</option>

${providers.map(p => `
<option value="${p.id}">
${p.name}
</option>
`).join("")}
</select>

<textarea
name="details"
placeholder="Lead details"></textarea>

<br><br>

<button class="btn blue">
Create Job
</button>

</form>

</div>
</body>
</html>
`);
});

initDB().then(() => {
app.listen(PORT, () => {
console.log("NLN running on port " + PORT);
});
});
