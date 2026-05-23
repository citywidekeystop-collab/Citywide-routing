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
notes TEXT,
archived BOOLEAN DEFAULT false,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

console.log("✅ DB ready");
} catch (err) {
console.log("DB ERROR:", err);
}
}

initDB();

async function getLeads() {
const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

return result.rows;
}

async function saveLead(lead) {
const result = await pool.query(
`
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
notes
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
RETURNING *
`,
[
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
lead.notes
]
);

return result.rows[0];
}

function layout(title, content) {
return `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
*{box-sizing:border-box}

body{
margin:0;
font-family:Arial, Helvetica, sans-serif;
background:#f4f8fb;
color:#0f172a;
}

.app{
max-width:1180px;
margin:auto;
padding:18px;
padding-bottom:95px;
}

.hero{
background:white;
border-radius:28px;
padding:24px;
box-shadow:0 12px 35px rgba(15,23,42,.08);
margin-bottom:18px;
}

.top-row{
display:flex;
justify-content:space-between;
align-items:center;
gap:12px;
}

.brand{
display:flex;
align-items:center;
gap:14px;
}

.logo-box{
width:78px;
height:78px;
border-radius:22px;
background:linear-gradient(135deg,#0b2a67,#0ea5e9);
display:flex;
align-items:center;
justify-content:center;
color:white;
font-size:28px;
font-weight:900;
box-shadow:0 10px 22px rgba(14,165,233,.25);
position:relative;
}

.logo-box:after{
content:"✓";
position:absolute;
right:-6px;
bottom:-6px;
background:#2563eb;
color:white;
width:30px;
height:30px;
border-radius:999px;
display:flex;
align-items:center;
justify-content:center;
border:3px solid white;
font-size:15px;
}

.brand h1{
margin:0;
font-size:30px;
}

.brand p{
margin:5px 0 0;
color:#64748b;
font-weight:bold;
}

.bell{
width:48px;
height:48px;
border-radius:999px;
background:#e0f7ff;
display:flex;
align-items:center;
justify-content:center;
font-size:24px;
}

.profile-card{
margin-top:20px;
border:1px solid #e2e8f0;
border-radius:22px;
padding:18px;
display:flex;
justify-content:space-between;
align-items:center;
gap:14px;
}

.profile-card h2{
margin:0;
font-size:24px;
}

.profile-card p{
margin:5px 0 0;
color:#64748b;
font-weight:bold;
}

.circle{
width:84px;
height:84px;
border-radius:999px;
border:9px solid #0891b2;
display:flex;
align-items:center;
justify-content:center;
font-weight:900;
font-size:20px;
}

.quick-actions{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:14px;
margin-top:20px;
}

.quick{text-align:center}

.icon{
width:74px;
height:74px;
margin:auto;
border-radius:999px;
background:#d8f7ff;
display:flex;
align-items:center;
justify-content:center;
font-size:30px;
}

.quick span{
display:block;
margin-top:8px;
font-weight:900;
color:#075985;
}

.stats{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:14px;
margin-bottom:18px;
}

.stat{
background:white;
border-radius:22px;
padding:22px;
box-shadow:0 12px 30px rgba(15,23,42,.06);
}

.stat h2{
margin:0;
font-size:34px;
}

.stat p{
margin:6px 0 0;
color:#64748b;
font-weight:800;
}

.section-title{
font-size:24px;
margin:22px 0 12px;
}

.lead-card{
background:white;
border-radius:24px;
padding:22px;
margin-bottom:16px;
box-shadow:0 12px 35px rgba(15,23,42,.08);
border:1px solid #e2e8f0;
}

.lead-top{
display:flex;
justify-content:space-between;
gap:12px;
align-items:flex-start;
}

.phone{
font-size:26px;
font-weight:900;
}

.badge{
border-radius:999px;
padding:9px 14px;
font-weight:900;
color:white;
background:#2563eb;
}

.badge.accepted{background:#16a34a}
.badge.booked{background:#7c3aed}
.badge.paid{background:#f59e0b;color:#111827}
.badge.declined{background:#64748b}

.info{
margin-top:14px;
line-height:1.8;
color:#334155;
font-weight:600;
}

.btn-row{
display:flex;
flex-wrap:wrap;
gap:8px;
margin-top:14px;
}

button,a.btn{
border:none;
border-radius:13px;
padding:12px 14px;
cursor:pointer;
font-weight:900;
text-decoration:none;
display:inline-block;
}

.accept{background:#22c55e;color:white}
.booked{background:#8b5cf6;color:white}
.paid{background:#f59e0b;color:#111827}
.archive{background:#64748b;color:white}
.delete{background:#ef4444;color:white}
.text{background:#06b6d4;color:white}
.call{background:#16a34a;color:white}
.refresh{background:#ec4899;color:white}
.test{background:#2563eb;color:white}

select,textarea,input{
width:100%;
padding:13px;
border:1px solid #cbd5e1;
border-radius:13px;
margin-top:10px;
font-size:16px;
}

textarea{min-height:85px}

.empty{
background:white;
border-radius:24px;
padding:38px;
text-align:center;
color:#64748b;
font-weight:800;
}

.bottom-nav{
position:fixed;
left:0;
right:0;
bottom:0;
background:#eef7fb;
border-top:1px solid #dbeafe;
display:flex;
justify-content:space-around;
padding:10px 6px 14px;
z-index:999;
}

.bottom-nav a{
text-decoration:none;
color:#475569;
font-weight:900;
text-align:center;
font-size:13px;
}

.bottom-nav .nav-icon{
font-size:25px;
display:block;
margin-bottom:3px;
}

.bottom-nav a.active{color:#075985}

@media(max-width:800px){
.app{
padding:14px;
padding-bottom:90px;
}

.hero{
border-radius:24px;
padding:18px;
}

.logo-box{
width:70px;
height:70px;
font-size:25px;
}

.brand h1{font-size:24px}

.brand p{font-size:14px}

.profile-card h2{font-size:20px}

.circle{
width:72px;
height:72px;
border-width:8px;
font-size:18px;
}

.quick-actions{
grid-template-columns:repeat(4,1fr);
gap:8px;
}

.icon{
width:58px;
height:58px;
font-size:24px;
}

.quick span{font-size:13px}

.stats{
grid-template-columns:repeat(2,1fr);
gap:10px;
}

.stat{padding:16px}

.stat h2{font-size:28px}

.lead-card{padding:18px}

.lead-top{display:block}

.badge{
display:inline-block;
margin-top:10px;
}

.phone{font-size:22px}

button,a.btn{
width:48%;
text-align:center;
padding:13px 10px;
font-size:14px;
}
}
</style>
</head>

<body>
${content}

<div class="bottom-nav">
<a class="active" href="/"><span class="nav-icon">📍</span>Dashboard</a>
<a href="/providers"><span class="nav-icon">👷</span>Providers</a>
<a href="/calls"><span class="nav-icon">☎️</span>Calls</a>
<a href="/settings"><span class="nav-icon">⚙️</span>Settings</a>
<a href="/admin/leads" target="_blank"><span class="nav-icon">📄</span>Raw</a>
</div>

</body>
</html>`;
}

app.get("/health", (req, res) => {
res.json({ success:true, status:"online" });
});

app.post("/lead/new", async (req, res) => {
try {
console.log("📞 CALLRAIL WEBHOOK RECEIVED");
console.log(req.body);

const body = req.body;

const lead = {
customer_phone: body.customer_phone_number || body.customer_number || body.callernum || body.from || "Unknown",
tracking_number: body.tracking_phone_number || body.trackingnum || body.destinationnum || body.to || "Unknown",
source: body.source || body.callsource || body.referrermedium || "CallRail",
service: body.tag || body.keywords || body.lead_explanation || "Service Request",
duration: String(body.duration || body.call_duration || "0"),
recording: body.recording || body.recording_url || "",
lead_score: String(body.lead_score || body.score || "N/A"),
call_status: "New",
provider_assigned: "Unassigned",
lead_status: "New",
notes: ""
};

const saved = await saveLead(lead);

console.log("✅ LEAD SAVED", saved.id);

res.json({ success:true, lead:saved });

} catch (err) {
console.log("LEAD ERROR:", err);
res.status(500).json({ success:false, error:err.message });
}
});

app.post("/lead/test", async (req, res) => {
try {
const saved = await saveLead({
customer_phone:"443-555-0100",
tracking_number:"443-578-1686",
source:"Test Lead",
service:"Emergency Lockout",
duration:"45",
recording:"",
lead_score:"92",
call_status:"New",
provider_assigned:"Robyn",
lead_status:"New",
notes:""
});

res.json({ success:true, lead:saved });
} catch (err) {
res.status(500).json({ success:false, error:err.message });
}
});

app.get("/admin/leads", async (req, res) => {
const leads = await getLeads();
res.json({ success:true, leads });
});

app.post("/lead/:id/status", async (req, res) => {
await pool.query("UPDATE leads SET lead_status=$1 WHERE id=$2", [req.body.status, req.params.id]);
res.json({ success:true });
});

app.post("/lead/:id/provider", async (req, res) => {
await pool.query("UPDATE leads SET provider_assigned=$1 WHERE id=$2", [req.body.provider, req.params.id]);
res.json({ success:true });
});

app.post("/lead/:id/notes", async (req, res) => {
await pool.query("UPDATE leads SET notes=$1 WHERE id=$2", [req.body.notes, req.params.id]);
res.json({ success:true });
});

app.post("/lead/:id/archive", async (req, res) => {
await pool.query("UPDATE leads SET archived=true WHERE id=$1", [req.params.id]);
res.json({ success:true });
});

app.delete("/lead/:id", async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.json({ success:true });
});

app.post("/send-provider-text", async (req, res) => {
try {
const { phone, lead } = req.body;

const smsBody = `
NEW LEAD

Customer: ${lead.customer_phone || "Unknown"}

Service: ${lead.service || "Locksmith Service"}

Source: ${lead.source || "CallRail"}

Lead Score: ${lead.lead_score || "N/A"}

Call customer ASAP.
`;

const smsLink = "sms:" + phone + "?body=" + encodeURIComponent(smsBody);

res.json({ success:true, smsLink });

} catch (err) {
res.status(500).json({ success:false, error:err.message });
}
});

app.get("/", async (req, res) => {
res.send(layout("NLN Dashboard", `
<div class="app">

<div class="hero">
<div class="top-row">
<div class="brand">
<div class="logo-box">NL</div>
<div>
<h1>Nationwide Leads Network</h1>
<p>Locksmith lead dispatch dashboard</p>
</div>
</div>
<div class="bell">🔔</div>
</div>

<div class="profile-card">
<div>
<h2>Provider dispatch system</h2>
<p>5 locksmith drivers connected</p>
</div>
<div class="circle">91%</div>
</div>

<div class="quick-actions">
<div class="quick"><div class="icon">✏️</div><span>Edit</span></div>
<div class="quick"><div class="icon">📈</div><span>Ads</span></div>
<div class="quick"><div class="icon">☎️</div><span>Calls</span></div>
<div class="quick"><div class="icon">⏰</div><span>Hours</span></div>
</div>
</div>

<div class="stats">
<div class="stat"><h2 id="total">0</h2><p>Total Leads</p></div>
<div class="stat"><h2 id="accepted">0</h2><p>Accepted</p></div>
<div class="stat"><h2 id="booked">0</h2><p>Booked</p></div>
<div class="stat"><h2 id="paid">0</h2><p>Paid</p></div>
</div>

<div class="btn-row">
<button class="test" onclick="createLead()">Create Test Lead</button>
<button class="refresh" onclick="loadLeads()">Refresh</button>
</div>

<h2 class="section-title">Incoming Locksmith Leads</h2>
<div id="leads"></div>

</div>

<script>
const providers = {
"Max": "4436792242",
"Dreh": "2024125443",
"Tee": "4104199281",
"Robyn": "4435781688",
"Car Key Chris": "2232630824"
};

let leadsData = [];

function cleanPhone(phone){
return String(phone || "").replace(/[^0-9]/g, "");
}

function makeSmsLink(phone, lead){
const text =
"NEW LOCKSMITH LEAD\\n\\n" +
"Customer: " + (lead.customer_phone || "Unknown") + "\\n\\n" +
"Service: " + (lead.service || "Locksmith Service") + "\\n\\n" +
"Source: " + (lead.source || "CallRail") + "\\n\\n" +
"Lead Score: " + (lead.lead_score || "N/A") + "\\n\\n" +
"Call customer ASAP.";

return "sms:" + phone + "?body=" + encodeURIComponent(text);
}

async function loadLeads(){
const res = await fetch("/admin/leads");
const data = await res.json();

leadsData = data.leads || [];

document.getElementById("total").innerText = leadsData.length;
document.getElementById("accepted").innerText = leadsData.filter(x => String(x.lead_status).toLowerCase() === "accepted").length;
document.getElementById("booked").innerText = leadsData.filter(x => String(x.lead_status).toLowerCase() === "booked").length;
document.getElementById("paid").innerText = leadsData.filter(x => String(x.lead_status).toLowerCase() === "paid").length;

renderLeads();
}

function renderLeads(){
const wrap = document.getElementById("leads");

if(leadsData.length === 0){
wrap.innerHTML = '<div class="empty">No leads yet. Make a CallRail test call or click Create Test Lead.</div>';
return;
}

wrap.innerHTML = leadsData.map(lead => {
const customerPhone = cleanPhone(lead.customer_phone);
const assignedProvider = lead.provider_assigned || "Unassigned";
const providerPhone = providers[assignedProvider] || providers["Robyn"];
const statusClass = String(lead.lead_status || "New").toLowerCase();
const smsAssigned = makeSmsLink(providerPhone, lead);

return \`
<div class="lead-card">
<div class="lead-top">
<div>
<div class="phone">📞 \${lead.customer_phone || "Unknown"}</div>
<div style="color:#64748b;font-weight:bold;">Lead #\${lead.id}</div>
</div>
<div class="badge \${statusClass}">\${lead.lead_status || "New"}</div>
</div>

<div class="info">
<strong>Service:</strong> \${lead.service || "Service Request"}<br>
<strong>Source:</strong> \${lead.source || "CallRail"}<br>
<strong>Provider:</strong> \${assignedProvider}<br>
<strong>Lead Score:</strong> \${lead.lead_score || "N/A"}<br>
<strong>Created:</strong> \${new Date(lead.created_at).toLocaleString()}
</div>

<select onchange="assignProvider(\${lead.id}, this.value)">
<option \${assignedProvider === "Unassigned" ? "selected" : ""}>Unassigned</option>
<option \${assignedProvider === "Max" ? "selected" : ""}>Max</option>
<option \${assignedProvider === "Dreh" ? "selected" : ""}>Dreh</option>
<option \${assignedProvider === "Tee" ? "selected" : ""}>Tee</option>
<option \${assignedProvider === "Robyn" ? "selected" : ""}>Robyn</option>
<option \${assignedProvider === "Car Key Chris" ? "selected" : ""}>Car Key Chris</option>
</select>

<div class="btn-row">
<a class="btn call" href="tel:\${customerPhone}">Call Customer</a>
<a class="btn text" href="\${smsAssigned}">Send To Selected</a>
</div>

<div class="btn-row">
<a class="btn text" href="\${makeSmsLink(providers["Max"], lead)}">Text Max</a>
<a class="btn text" href="\${makeSmsLink(providers["Dreh"], lead)}">Text Dreh</a>
<a class="btn text" href="\${makeSmsLink(providers["Tee"], lead)}">Text Tee</a>
<a class="btn text" href="\${makeSmsLink(providers["Robyn"], lead)}">Text Robyn</a>
<a class="btn text" href="\${makeSmsLink(providers["Car Key Chris"], lead)}">Text Chris</a>
</div>

<div class="btn-row">
<button class="accept" onclick="updateStatus(\${lead.id}, 'Accepted')">Accept</button>
<button class="booked" onclick="updateStatus(\${lead.id}, 'Booked')">Booked</button>
<button class="paid" onclick="updateStatus(\${lead.id}, 'Paid')">Paid</button>
<button class="archive" onclick="archiveLead(\${lead.id})">Archive</button>
<button class="delete" onclick="deleteLead(\${lead.id})">Delete</button>
</div>

<textarea id="notes-\${lead.id}" placeholder="Add notes...">\${lead.notes || ""}</textarea>
<button class="test" onclick="saveNotes(\${lead.id})">Save Notes</button>
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
body:JSON.stringify({ status })
});
loadLeads();
}

async function assignProvider(id,provider){
await fetch("/lead/" + id + "/provider", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ provider })
});
loadLeads();
}

async function saveNotes(id){
const notes = document.getElementById("notes-" + id).value;
await fetch("/lead/" + id + "/notes", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ notes })
});
loadLeads();
}

async function archiveLead(id){
await fetch("/lead/" + id + "/archive", { method:"POST" });
loadLeads();
}

async function deleteLead(id){
if(!confirm("Delete this lead?")) return;
await fetch("/lead/" + id, { method:"DELETE" });
loadLeads();
}

loadLeads();
setInterval(loadLeads, 5000);
</script>
`));
});

app.get("/calls", async (req, res) => {
res.send(layout("Calls", `
<div class="app">
<div class="hero">
<h1>Calls</h1>
<p>Live CallRail call leads from PostgreSQL.</p>
</div>
<div id="calls"></div>
</div>

<script>
async function loadCalls(){
const res = await fetch("/admin/leads");
const data = await res.json();
const calls = data.leads || [];
const wrap = document.getElementById("calls");

if(calls.length === 0){
wrap.innerHTML = '<div class="empty">No calls yet.</div>';
return;
}

wrap.innerHTML = calls.map(call => \`
<div class="lead-card">
<div class="phone">📞 \${call.customer_phone || "Unknown"}</div>
<div class="info">
<strong>Source:</strong> \${call.source || "CallRail"}<br>
<strong>Service:</strong> \${call.service || "Service Request"}<br>
<strong>Duration:</strong> \${call.duration || "0"} seconds<br>
<strong>Status:</strong> \${call.lead_status || "New"}<br>
<strong>Provider:</strong> \${call.provider_assigned || "Unassigned"}<br>
<strong>Lead Score:</strong> \${call.lead_score || "N/A"}<br>
<strong>Created:</strong> \${new Date(call.created_at).toLocaleString()}
</div>
\${call.recording ? '<a class="btn text" href="' + call.recording + '" target="_blank">Listen Recording</a>' : '<p>No Recording</p>'}
</div>
\`).join("");
}

loadCalls();
setInterval(loadCalls, 5000);
</script>
`));
});

app.get("/providers", (req, res) => {
res.send(layout("Providers", `
<div class="app">
<div class="hero">
<h1>Locksmith Providers</h1>
<p>5 drivers ready for job dispatch.</p>
</div>

<div class="lead-card"><h2>Max</h2><p><strong>Phone:</strong> +1 443-679-2242</p><p><strong>Status:</strong> Active</p></div>
<div class="lead-card"><h2>Dreh</h2><p><strong>Phone:</strong> +1 202-412-5443</p><p><strong>Status:</strong> Active</p></div>
<div class="lead-card"><h2>Tee</h2><p><strong>Phone:</strong> +1 410-419-9281</p><p><strong>Status:</strong> Active</p></div>
<div class="lead-card"><h2>Robyn</h2><p><strong>Phone:</strong> +1 443-578-1686</p><p><strong>Status:</strong> Active</p></div>
<div class="lead-card"><h2>Car Key Chris</h2><p><strong>Phone:</strong> +1 223-263-0824</p><p><strong>Status:</strong> Automotive Keys</p></div>
</div>
`));
});

app.get("/settings", (req, res) => {
res.send(layout("Settings", `
<div class="app">
<div class="hero">
<h1>Settings</h1>
<p>NLN system setup.</p>
</div>

<div class="lead-card">
<p><strong>Webhook:</strong></p>
<p>https://citywide-routing.onrender.com/lead/new</p>
<p><strong>Lead Price:</strong> 35 dollars</p>
<p><strong>Texting:</strong> iPhone SMS send button enabled</p>
<p><strong>Providers:</strong> Max, Dreh, Tee, Robyn, Car Key Chris</p>
</div>
</div>
`));
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
