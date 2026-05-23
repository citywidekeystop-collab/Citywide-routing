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
try {
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

console.log("✅ DB ready");
} catch (err) {
console.error(err);
}
}

initDB();

function page(title, content) {
return `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
body{
margin:0;
font-family:Arial;
background:#020617;
color:white;
}

.layout{
display:flex;
min-height:100vh;
}

.sidebar{
width:230px;
background:#0f172a;
padding:20px;
border-right:1px solid #1e293b;
}

.logo{
font-size:28px;
font-weight:bold;
margin-bottom:30px;
}

.nav a{
display:block;
padding:12px;
margin-bottom:10px;
border-radius:12px;
background:#111827;
color:#cbd5e1;
text-decoration:none;
}

.nav a:hover{
background:#2563eb;
color:white;
}

.main{
flex:1;
padding:25px;
}

.top{
background:linear-gradient(135deg,#0f172a,#1d4ed8);
padding:25px;
border-radius:18px;
margin-bottom:20px;
}

.card{
background:#0f172a;
border:1px solid #1e293b;
border-radius:18px;
padding:20px;
margin-bottom:15px;
}

.stats{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
gap:12px;
margin-bottom:20px;
}

.stat{
background:#111827;
padding:18px;
border-radius:16px;
}

.stat h2{
margin:0;
color:#38bdf8;
}

button{
border:none;
padding:10px 14px;
border-radius:10px;
cursor:pointer;
margin:4px;
font-weight:bold;
}

.accept{background:#16a34a;color:white;}
.booked{background:#7c3aed;color:white;}
.paid{background:#f59e0b;color:black;}
.archive{background:#475569;color:white;}
.delete{background:#dc2626;color:white;}

textarea{
width:100%;
margin-top:10px;
background:#020617;
color:white;
border:1px solid #334155;
border-radius:10px;
padding:10px;
}

select,input{
padding:10px;
border-radius:10px;
background:#020617;
color:white;
border:1px solid #334155;
margin:4px;
}

a{
color:#38bdf8;
}

@media(max-width:800px){

.layout{
display:block;
}

.sidebar{
width:100%;
position:sticky;
top:0;
z-index:999;
padding:12px;
border-right:none;
border-bottom:1px solid #1e293b;
}

.logo{
font-size:22px;
margin-bottom:10px;
}

.nav{
display:flex;
overflow-x:auto;
gap:8px;
padding-bottom:6px;
}

.nav a{
white-space:nowrap;
font-size:13px;
padding:10px 12px;
margin-bottom:0;
}

.main{
padding:14px;
}

.top{
padding:18px;
border-radius:16px;
}

.top h1{
font-size:22px;
}

.stats{
grid-template-columns:repeat(2,1fr);
gap:10px;
}

.stat{
padding:14px;
}

.stat h2{
font-size:24px;
}

.card{
padding:16px;
border-radius:16px;
}

.card h2{
font-size:20px;
}

button{
width:48%;
margin:4px 1%;
padding:12px;
font-size:14px;
}

select,
input,
textarea{
width:100%;
font-size:16px;
}

textarea{
min-height:90px;
}
}
</style>
</head>

<body>
<div class="layout">
<div class="sidebar">
<div class="logo">🔥 NLN</div>
<div class="nav">
<a href="/">Dashboard</a>
<a href="/providers">Providers</a>
<a href="/calls">Calls</a>
<a href="/settings">Settings</a>
<a href="/admin/leads" target="_blank">Raw Leads</a>
<a href="/health" target="_blank">Health</a>
</div>
</div>

<div class="main">
${content}
</div>
</div>
</body>
</html>
`;
}

async function saveLead(lead) {
const result = await pool.query(`
INSERT INTO leads (
customer_phone,
tracking_number,
source,
service,
duration,
recording,
lead_score,
call_status,
provider_assigned,
lead_status,
price,
notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
RETURNING *
`, [
lead.customer_phone,
lead.tracking_number,
lead.source,
lead.service,
lead.duration,
lead.recording,
lead.lead_score,
lead.call_status,
lead.provider_assigned,
lead.lead_status,
lead.price,
lead.notes
]);

return result.rows[0];
}

app.get("/health", (req, res) => {
res.json({
success:true,
status:"online"
});
});

app.post("/lead/new", async (req, res) => {
try {
console.log("📞 CALLRAIL WEBHOOK RECEIVED");
console.log(req.body);

const body = req.body;

const lead = {
customer_phone:
body.customer_phone_number ||
body.customer_number ||
body.callernum ||
body.from ||
"Unknown",

tracking_number:
body.tracking_phone_number ||
body.destinationnum ||
body.to ||
"Unknown",

source:
body.source ||
body.callsource ||
"CallRail",

service:
body.tag ||
body.keywords ||
body.lead_explanation ||
"Service Request",

duration:
String(body.duration || body.call_duration || "0"),

recording:
body.recording ||
body.recording_url ||
"",

lead_score:
String(body.lead_score || "N/A"),

call_status:"New",
provider_assigned:"Unassigned",
lead_status:"New",
price:"35",
notes:""
};

const saved = await saveLead(lead);

console.log("✅ LEAD SAVED", saved.id);

res.json({
success:true,
lead:saved
});

} catch (err) {
console.error(err);

res.status(500).json({
success:false,
error:err.message
});
}
});

app.post("/lead/test", async (req, res) => {
try {
const lead = {
customer_phone:"443-555-0100",
tracking_number:"443-578-1686",
source:"Test Lead",
service:"Emergency Lockout",
duration:"45",
recording:"",
lead_score:"92",
call_status:"New",
provider_assigned:"Citywide Lock & Key",
lead_status:"New",
price:"35",
notes:""
};

const saved = await saveLead(lead);

res.json({
success:true,
lead:saved
});

} catch (err) {
console.error(err);

res.status(500).json({
success:false
});
}
});

app.get("/admin/leads", async (req, res) => {
const result = await pool.query(`
SELECT * FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

res.json({
success:true,
leads:result.rows
});
});

app.post("/lead/:id/status", async (req, res) => {
await pool.query(
"UPDATE leads SET lead_status=$1 WHERE id=$2",
[req.body.status, req.params.id]
);

res.json({ success:true });
});

app.post("/lead/:id/provider", async (req, res) => {
await pool.query(
"UPDATE leads SET provider_assigned=$1 WHERE id=$2",
[req.body.provider, req.params.id]
);

res.json({ success:true });
});

app.post("/lead/:id/notes", async (req, res) => {
await pool.query(
"UPDATE leads SET notes=$1 WHERE id=$2",
[req.body.notes, req.params.id]
);

res.json({ success:true });
});

app.post("/lead/:id/archive", async (req, res) => {
await pool.query(
"UPDATE leads SET archived=true WHERE id=$1",
[req.params.id]
);

res.json({ success:true });
});

app.delete("/lead/:id", async (req, res) => {
await pool.query(
"DELETE FROM leads WHERE id=$1",
[req.params.id]
);

res.json({ success:true });
});

app.get("/", (req, res) => {
res.send(page("Dashboard", `
<div class="top">
<h1>NLN Lead Dashboard</h1>
<p>Live CallRail leads and provider routing system.</p>
<button onclick="createLead()">Create Test Lead</button>
<button onclick="loadLeads()">Refresh</button>
</div>

<div class="stats">
<div class="stat"><h2 id="total">0</h2><p>Total Leads</p></div>
<div class="stat"><h2 id="accepted">0</h2><p>Accepted</p></div>
<div class="stat"><h2 id="booked">0</h2><p>Booked</p></div>
<div class="stat"><h2 id="paid">0</h2><p>Paid</p></div>
</div>

<div id="leads"></div>

<script>
let leadsData = [];

async function loadLeads(){
const res = await fetch("/admin/leads");
const data = await res.json();

leadsData = data.leads || [];

document.getElementById("total").innerText =
leadsData.length;

document.getElementById("accepted").innerText =
leadsData.filter(x => x.lead_status === "Accepted").length;

document.getElementById("booked").innerText =
leadsData.filter(x => x.lead_status === "Booked").length;

document.getElementById("paid").innerText =
leadsData.filter(x => x.lead_status === "Paid").length;

renderLeads();
}

function renderLeads(){
const wrap = document.getElementById("leads");

if(leadsData.length === 0){
wrap.innerHTML =
'<div class="card"><h2>No leads yet</h2></div>';
return;
}

wrap.innerHTML = leadsData.map(lead => {
return \`
<div class="card">
<h2>📞 \${lead.customer_phone}</h2>
<p><strong>Service:</strong> \${lead.service}</p>
<p><strong>Source:</strong> \${lead.source}</p>
<p><strong>Status:</strong> \${lead.lead_status}</p>
<p><strong>Provider:</strong> \${lead.provider_assigned}</p>
<p><strong>Lead Score:</strong> \${lead.lead_score}</p>
<p><strong>Created:</strong> \${new Date(lead.created_at).toLocaleString()}</p>

<button class="accept" onclick="updateStatus(\${lead.id},'Accepted')">Accept</button>
<button class="booked" onclick="updateStatus(\${lead.id},'Booked')">Booked</button>
<button class="paid" onclick="updateStatus(\${lead.id},'Paid')">Paid</button>
<button class="archive" onclick="archiveLead(\${lead.id})">Archive</button>
<button class="delete" onclick="deleteLead(\${lead.id})">Delete</button>

<br>

<select onchange="assignProvider(\${lead.id}, this.value)">
<option>Unassigned</option>
<option>Citywide Lock & Key</option>
<option>Provider A</option>
<option>Provider B</option>
</select>

<textarea id="notes-\${lead.id}">\${lead.notes || ""}</textarea>

<button onclick="saveNotes(\${lead.id})">Save Notes</button>
</div>
\`;
}).join("");
}

async function createLead(){
await fetch("/lead/test", { method:"POST" });
loadLeads();
}

async function updateStatus(id,status){
await fetch("/lead/" + id + "/status", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ status:status })
});

loadLeads();
}

async function assignProvider(id,provider){
await fetch("/lead/" + id + "/provider", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ provider:provider })
});

loadLeads();
}

async function saveNotes(id){
const notes =
document.getElementById("notes-" + id).value;

await fetch("/lead/" + id + "/notes", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ notes:notes })
});

loadLeads();
}

async function archiveLead(id){
await fetch("/lead/" + id + "/archive", {
method:"POST"
});

loadLeads();
}

async function deleteLead(id){
await fetch("/lead/" + id, {
method:"DELETE"
});

loadLeads();
}

loadLeads();
setInterval(loadLeads, 5000);
</script>
`));
});

app.get("/calls", (req, res) => {
res.send(page("Calls", `
<div class="top">
<h1>Calls</h1>
<p>Live CallRail calls from PostgreSQL.</p>
</div>

<div id="calls"></div>

<script>
async function loadCalls(){
const res = await fetch("/admin/leads");
const data = await res.json();

const calls = data.leads || [];
const wrap = document.getElementById("calls");

if(calls.length === 0){
wrap.innerHTML =
'<div class="card"><h2>No calls yet</h2></div>';
return;
}

wrap.innerHTML = calls.map(call => {
return \`
<div class="card">
<h2>📞 \${call.customer_phone}</h2>
<p><strong>Source:</strong> \${call.source}</p>
<p><strong>Service:</strong> \${call.service}</p>
<p><strong>Duration:</strong> \${call.duration} sec</p>
<p><strong>Status:</strong> \${call.lead_status}</p>
<p><strong>Provider:</strong> \${call.provider_assigned}</p>
<p><strong>Lead Score:</strong> \${call.lead_score}</p>
<p><strong>Created:</strong> \${new Date(call.created_at).toLocaleString()}</p>
\${call.recording
? '<a href="' + call.recording + '" target="_blank">Listen Recording</a>'
: '<p>No Recording</p>'
}
</div>
\`;
}).join("");
}

loadCalls();
setInterval(loadCalls, 5000);
</script>
`));
});

app.get("/providers", (req, res) => {
res.send(page("Providers", `
<div class="card">
<h1>Providers</h1>
<p>Citywide Lock & Key — Active</p>
<p>Provider A — Pending</p>
<p>Provider B — Active</p>
</div>
`));
});

app.get("/settings", (req, res) => {
res.send(page("Settings", `
<div class="card">
<h1>Settings</h1>
<p><strong>Webhook:</strong></p>
<p>https://citywide-routing.onrender.com/lead/new</p>
<p><strong>Lead Price:</strong> 35 dollars</p>
</div>
`));
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
