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
call_status TEXT,
provider_assigned TEXT,
lead_status TEXT,
price TEXT,
notes TEXT,
archived BOOLEAN DEFAULT false,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

console.log("✅ DB table checked/updated");
}

initDB();

app.get("/health", (req, res) => {
res.json({
success: true,
status: "online",
app: "NLN Dashboard",
database: !!process.env.DATABASE_URL
});
});

app.post("/lead/new", async (req, res) => {
try {
const body = req.body;

const result = await pool.query(`
INSERT INTO leads (
customer_phone, tracking_number, source, service, duration,
recording, lead_score, call_status, provider_assigned,
lead_status, price, notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
RETURNING *
`, [
body.customer_phone_number || body.customer_number || body.callernum || body.from || "Unknown",
body.tracking_phone_number || body.tracking_number || body.destinationnum || body.to || "Unknown",
body.source || body.callsource || body.campaign || "CallRail",
body.tag || body.lead_explanation || body.keywords || "Service Request",
body.duration || body.call_duration || "0",
body.recording || body.recording_url || "",
body.lead_score || "N/A",
body.answered === false ? "Missed" : "New Lead",
"Unassigned",
"New",
"$35",
""
]);

console.log("✅ New lead saved:", result.rows[0]);

res.json({ success: true, lead: result.rows[0] });
} catch (err) {
console.error("❌ Lead save error:", err);
res.status(500).json({ success: false, error: err.message });
}
});

app.post("/lead/test", async (req, res) => {
const result = await pool.query(`
INSERT INTO leads (
customer_phone, tracking_number, source, service, duration,
recording, lead_score, call_status, provider_assigned,
lead_status, price, notes
)
VALUES (
'443-555-0100',
'443-578-1686',
'Test Lead',
'Emergency Lockout',
'55',
'',
'92',
'New Lead',
'Citywide Lock & Key',
'New',
'$35',
''
)
RETURNING *
`);

res.json({ success: true, lead: result.rows[0] });
});

app.get("/admin/leads", async (req, res) => {
const result = await pool.query(`
SELECT * FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

res.json({
success: true,
total: result.rows.length,
leads: result.rows
});
});

app.post("/lead/:id/status", async (req, res) => {
await pool.query(
"UPDATE leads SET lead_status=$1 WHERE id=$2",
[req.body.status, req.params.id]
);
res.json({ success: true });
});

app.post("/lead/:id/provider", async (req, res) => {
await pool.query(
"UPDATE leads SET provider_assigned=$1 WHERE id=$2",
[req.body.provider, req.params.id]
);
res.json({ success: true });
});

app.post("/lead/:id/notes", async (req, res) => {
await pool.query(
"UPDATE leads SET notes=$1 WHERE id=$2",
[req.body.notes, req.params.id]
);
res.json({ success: true });
});

app.post("/lead/:id/archive", async (req, res) => {
await pool.query(
"UPDATE leads SET archived=true WHERE id=$1",
[req.params.id]
);
res.json({ success: true });
});

app.delete("/lead/:id", async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.json({ success: true });
});

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>NLN Lead Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
*{box-sizing:border-box}
body{
margin:0;
font-family:Arial, sans-serif;
background:#020617;
color:white;
}
.layout{
display:flex;
min-height:100vh;
}
.sidebar{
width:240px;
background:#020617;
border-right:1px solid #1e293b;
padding:22px;
position:fixed;
top:0;
bottom:0;
}
.logo{
font-size:24px;
font-weight:bold;
margin-bottom:25px;
}
.nav a{
display:block;
color:#cbd5e1;
padding:12px;
border-radius:10px;
text-decoration:none;
margin-bottom:8px;
}
.nav a:hover,.nav a.active{
background:#1d4ed8;
color:white;
}
.main{
margin-left:240px;
width:calc(100% - 240px);
padding:24px;
}
.top{
background:linear-gradient(135deg,#0f172a,#1e3a8a);
border:1px solid #334155;
border-radius:20px;
padding:24px;
margin-bottom:20px;
}
.top h1{
margin:0;
font-size:30px;
}
.top p{
color:#cbd5e1;
}
.actions{
display:flex;
gap:10px;
flex-wrap:wrap;
margin-top:18px;
}
button,a.btn{
border:none;
border-radius:10px;
padding:11px 14px;
font-weight:bold;
cursor:pointer;
text-decoration:none;
color:white;
background:#2563eb;
}
.stats{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
gap:14px;
margin-bottom:20px;
}
.stat{
background:#0f172a;
border:1px solid #1e293b;
border-radius:16px;
padding:18px;
}
.stat h2{
margin:0;
font-size:30px;
color:#38bdf8;
}
.stat span{
color:#94a3b8;
font-size:14px;
}
.filters{
display:flex;
gap:10px;
flex-wrap:wrap;
margin-bottom:18px;
}
input,select,textarea{
background:#020617;
color:white;
border:1px solid #334155;
border-radius:10px;
padding:10px;
}
input{
min-width:260px;
}
.lead-card{
background:#0f172a;
border:1px solid #1e293b;
border-radius:18px;
padding:18px;
margin-bottom:16px;
box-shadow:0 12px 30px rgba(0,0,0,.3);
}
.lead-head{
display:flex;
justify-content:space-between;
gap:12px;
flex-wrap:wrap;
}
.lead-phone{
font-size:22px;
font-weight:bold;
}
.badge{
padding:8px 14px;
border-radius:999px;
font-weight:bold;
background:#16a34a;
}
.badge.Booked{background:#7c3aed}
.badge.Paid{background:#f59e0b;color:#111827}
.badge.Declined{background:#64748b}
.info{
margin-top:14px;
color:#cbd5e1;
line-height:1.8;
}
.controls{
display:flex;
gap:8px;
flex-wrap:wrap;
margin-top:14px;
}
.accept{background:#16a34a}
.booked{background:#7c3aed}
.paid{background:#f59e0b;color:#111827}
.decline{background:#64748b}
.archive{background:#475569}
.delete{background:#dc2626}
textarea{
width:100%;
min-height:70px;
margin-top:12px;
}
.empty{
padding:50px;
text-align:center;
border:1px dashed #334155;
border-radius:18px;
color:#94a3b8;
background:#0f172a;
}
.small{
color:#94a3b8;
font-size:13px;
}
@media(max-width:800px){
.sidebar{
position:relative;
width:100%;
height:auto;
}
.layout{
display:block;
}
.main{
margin-left:0;
width:100%;
}
}
</style>
</head>

<body>
<div class="layout">

<aside class="sidebar">
<div class="logo">🔥 NLN</div>
<div class="nav">
<a class="active" href="/">Dashboard</a>
<a href="/admin/leads" target="_blank">Raw Leads</a>
<a href="/health" target="_blank">Health</a>
<a href="#">Providers</a>
<a href="#">Calls</a>
<a href="#">Invoices</a>
<a href="#">Settings</a>
</div>
</aside>

<main class="main">
<div class="top">
<h1>NLN Lead Dashboard</h1>
<p>Live CallRail leads, provider routing, booked jobs, paid leads, and permanent PostgreSQL storage.</p>
<div class="actions">
<button onclick="createTestLead()">+ Create Test Lead</button>
<button onclick="loadLeads()">Refresh</button>
<a class="btn" href="/admin/leads" target="_blank">View JSON</a>
</div>
</div>

<div class="stats">
<div class="stat"><h2 id="total">0</h2><span>Total Leads</span></div>
<div class="stat"><h2 id="newLeads">0</h2><span>New Leads</span></div>
<div class="stat"><h2 id="accepted">0</h2><span>Accepted</span></div>
<div class="stat"><h2 id="booked">0</h2><span>Booked</span></div>
<div class="stat"><h2 id="paid">0</h2><span>Paid</span></div>
<div class="stat"><h2 id="revenue">$0</h2><span>Lead Value</span></div>
</div>

<div class="filters">
<input id="search" placeholder="Search phone, source, service..." oninput="renderLeads()">
<select id="statusFilter" onchange="renderLeads()">
<option value="">All Statuses</option>
<option>New</option>
<option>Accepted</option>
<option>Booked</option>
<option>Paid</option>
<option>Declined</option>
</select>
</div>

<div id="leads"></div>
</main>

</div>

<script>
let allLeads = [];

async function loadLeads(){
const res = await fetch("/admin/leads");
const data = await res.json();
allLeads = data.leads || [];

document.getElementById("total").innerText = allLeads.length;
document.getElementById("newLeads").innerText = allLeads.filter(l => l.lead_status === "New").length;
document.getElementById("accepted").innerText = allLeads.filter(l => l.lead_status === "Accepted").length;
document.getElementById("booked").innerText = allLeads.filter(l => l.lead_status === "Booked").length;
document.getElementById("paid").innerText = allLeads.filter(l => l.lead_status === "Paid").length;
document.getElementById("revenue").innerText = "$" + (allLeads.length * 35);

renderLeads();
}

function renderLeads(){
const search = document.getElementById("search").value.toLowerCase();
const status = document.getElementById("statusFilter").value;

let leads = allLeads.filter(l => {
const text = JSON.stringify(l).toLowerCase();
const matchesSearch = text.includes(search);
const matchesStatus = !status || l.lead_status === status;
return matchesSearch && matchesStatus;
});

const box = document.getElementById("leads");

if(!leads.length){
box.innerHTML = '<div class="empty">No leads found.</div>';
return;
}

box.innerHTML = leads.map(lead => \`
<div class="lead-card">
<div class="lead-head">
<div>
<div class="lead-phone">📞 \${lead.customer_phone}</div>
<div class="small">Lead #\${lead.id}</div>
</div>
<div class="badge \${lead.lead_status}">\${lead.lead_status}</div>
</div>

<div class="info">
<strong>Service:</strong> \${lead.service || "Service Request"}<br>
<strong>Source:</strong> \${lead.source || "Unknown"}<br>
<strong>Tracking #:</strong> \${lead.tracking_number || "Unknown"}<br>
<strong>Duration:</strong> \${lead.duration || "0"} seconds<br>
<strong>Lead Score:</strong> \${lead.lead_score || "N/A"}<br>
<strong>Provider:</strong> \${lead.provider_assigned || "Unassigned"}<br>
<strong>Price:</strong> \${lead.price || "$35"}<br>
<strong>Created:</strong> \${new Date(lead.created_at).toLocaleString()}
</div>

<div class="controls">
<button class="accept" onclick="updateStatus(\${lead.id}, 'Accepted')">Accept</button>
<button class="booked" onclick="updateStatus(\${lead.id}, 'Booked')">Booked</button>
<button class="paid" onclick="updateStatus(\${lead.id}, 'Paid')">Paid</button>
<button class="decline" onclick="updateStatus(\${lead.id}, 'Declined')">Decline</button>
<button class="archive" onclick="archiveLead(\${lead.id})">Archive</button>
<button class="delete" onclick="deleteLead(\${lead.id})">Delete</button>
\${lead.recording ? '<a class="btn" href="' + lead.recording + '" target="_blank">Recording</a>' : ''}
</div>

<div class="controls">
<select onchange="assignProvider(\${lead.id}, this.value)">
<option \${lead.provider_assigned === "Unassigned" ? "selected" : ""}>Unassigned</option>
<option \${lead.provider_assigned === "Citywide Lock & Key" ? "selected" : ""}>Citywide Lock & Key</option>
<option \${lead.provider_assigned === "Provider A" ? "selected" : ""}>Provider A</option>
<option \${lead.provider_assigned === "Provider B" ? "selected" : ""}>Provider B</option>
<option \${lead.provider_assigned === "Provider C" ? "selected" : ""}>Provider C</option>
</select>
</div>

<textarea id="notes-\${lead.id}" placeholder="Add lead notes...">\${lead.notes || ""}</textarea>
<div class="controls">
<button onclick="saveNotes(\${lead.id})">Save Notes</button>
</div>
</div>
\`).join("");
}

async function updateStatus(id,status){
await fetch("/lead/" + id + "/status", {
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({status})
});
await loadLeads();
}

async function assignProvider(id,provider){
await fetch("/lead/" + id + "/provider", {
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({provider})
});
await loadLeads();
}

async function saveNotes(id){
const notes = document.getElementById("notes-" + id).value;
await fetch("/lead/" + id + "/notes", {
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({notes})
});
await loadLeads();
}

async function archiveLead(id){
await fetch("/lead/" + id + "/archive", {method:"POST"});
await loadLeads();
}

async function deleteLead(id){
if(!confirm("Delete this lead?")) return;
await fetch("/lead/" + id, {method:"DELETE"});
await loadLeads();
}

async function createTestLead(){
await fetch("/lead/test", {method:"POST"});
await loadLeads();
}

loadLeads();
setInterval(loadLeads, 7000);
</script>

</body>
</html>
`);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
