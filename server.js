const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let leads = [];

const providers = [
"Citywide Lock & Key",
"Provider A",
"Provider B",
"Provider C",
"Unassigned"
];

app.get("/health", (req, res) => {
res.json({
status: "ok",
app: "NLN Lead Dashboard",
time: new Date().toISOString()
});
});

function createLead(call = {}) {
return {
id: Date.now().toString(),
type: "CallRail Call",
customer_phone:
call.customer_phone_number ||
call.customer_number ||
call.caller_phone_number ||
call.from ||
"Unknown",

tracking_number:
call.tracking_phone_number ||
call.tracking_number ||
call.to ||
"Unknown",

source:
call.source ||
call.callsource ||
call.campaign ||
call.medium ||
"CallRail",

service:
call.tag ||
call.keywords ||
call.lead_explanation ||
"Service Request",

duration:
call.duration ||
call.call_duration ||
0,

recording:
call.recording ||
call.recording_url ||
"",

lead_score:
call.lead_score || "N/A",

call_status:
call.answered === false ? "Missed" : "New Lead",

provider_assigned: "Unassigned",
lead_status: "New",
price: "$35",
notes: "",
archived: false,
created_at: new Date().toLocaleString(),
raw: call
};
}

// CALLRAIL WEBHOOK
app.post("/lead/new", (req, res) => {
console.log("✅ CALLRAIL WEBHOOK RECEIVED:");
console.log(JSON.stringify(req.body, null, 2));

const lead = createLead(req.body);
leads.unshift(lead);

res.status(200).json({
success: true,
message: "Lead received",
lead
});
});

// TEST LEAD
app.post("/lead/test", (req, res) => {
const lead = createLead({
customer_phone_number: "443-555-0199",
tracking_phone_number: "443-578-1686",
source: "Test Lead",
tag: "Emergency Lockout",
lead_score: 88,
duration: 45
});

leads.unshift(lead);

res.json({
success: true,
lead
});
});

// RAW LEADS
app.get("/admin/leads", (req, res) => {
res.json({
success: true,
total: leads.length,
leads
});
});

// UPDATE STATUS
app.post("/lead/:id/status", (req, res) => {
const lead = leads.find(l => l.id === req.params.id);
if (!lead) return res.status(404).json({ error: "Lead not found" });

lead.lead_status = req.body.status || lead.lead_status;

res.json({
success: true,
lead
});
});

// ASSIGN PROVIDER
app.post("/lead/:id/provider", (req, res) => {
const lead = leads.find(l => l.id === req.params.id);
if (!lead) return res.status(404).json({ error: "Lead not found" });

lead.provider_assigned = req.body.provider || "Unassigned";

res.json({
success: true,
lead
});
});

// ADD NOTES
app.post("/lead/:id/notes", (req, res) => {
const lead = leads.find(l => l.id === req.params.id);
if (!lead) return res.status(404).json({ error: "Lead not found" });

lead.notes = req.body.notes || "";

res.json({
success: true,
lead
});
});

// ARCHIVE
app.post("/lead/:id/archive", (req, res) => {
const lead = leads.find(l => l.id === req.params.id);
if (!lead) return res.status(404).json({ error: "Lead not found" });

lead.archived = true;

res.json({
success: true,
lead
});
});

// DELETE LEAD
app.delete("/lead/:id", (req, res) => {
leads = leads.filter(l => l.id !== req.params.id);

res.json({
success: true
});
});

// DASHBOARD
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>NLN Lead Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
body {
margin:0;
font-family:Arial, sans-serif;
background:#020617;
color:white;
}

.header {
background:linear-gradient(135deg,#0f172a,#1d4ed8);
padding:24px;
border-bottom:1px solid #334155;
}

.header h1 {
margin:0;
font-size:28px;
}

.header p {
color:#cbd5e1;
margin:8px 0 0;
}

.topbar {
padding:18px;
display:flex;
gap:10px;
flex-wrap:wrap;
}

.stats {
display:grid;
grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
gap:14px;
padding:0 18px 18px;
}

.stat {
background:#0f172a;
border:1px solid #1e293b;
border-radius:16px;
padding:18px;
}

.stat h2 {
color:#38bdf8;
margin:0;
font-size:28px;
}

.stat span {
color:#94a3b8;
font-size:14px;
}

.section {
padding:18px;
}

.lead-card {
background:#0f172a;
border:1px solid #1e293b;
border-radius:18px;
padding:18px;
margin-bottom:16px;
box-shadow:0 12px 30px rgba(0,0,0,.35);
}

.lead-top {
display:flex;
justify-content:space-between;
gap:10px;
flex-wrap:wrap;
}

.badge {
background:#16a34a;
padding:7px 13px;
border-radius:999px;
font-size:13px;
font-weight:bold;
}

.badge.missed { background:#dc2626; }
.badge.booked { background:#9333ea; }
.badge.paid { background:#f59e0b; color:#111827; }
.badge.declined { background:#64748b; }

.info {
color:#cbd5e1;
line-height:1.8;
margin-top:12px;
}

.controls {
display:flex;
flex-wrap:wrap;
gap:8px;
margin-top:14px;
}

button, select, textarea, a.btn {
border:none;
border-radius:10px;
padding:10px 12px;
font-weight:bold;
}

button {
background:#2563eb;
color:white;
cursor:pointer;
}

.accept { background:#16a34a; }
.decline { background:#dc2626; }
.booked { background:#9333ea; }
.paid { background:#f59e0b; color:#111827; }
.archive { background:#475569; }
.delete { background:#991b1b; }

select {
background:#111827;
color:white;
border:1px solid #334155;
}

textarea {
width:100%;
margin-top:12px;
background:#020617;
color:white;
border:1px solid #334155;
min-height:70px;
}

a.btn {
background:#0ea5e9;
color:white;
text-decoration:none;
}

.empty {
text-align:center;
padding:45px;
color:#94a3b8;
background:#0f172a;
border:1px dashed #334155;
border-radius:16px;
}

.small {
font-size:13px;
color:#94a3b8;
}
</style>
</head>

<body>

<div class="header">
<h1>NLN Lead Dashboard</h1>
<p>Live CallRail leads, provider assignment, status tracking, notes, and lead control.</p>
</div>

<div class="topbar">
<button onclick="createTestLead()">+ Create Test Lead</button>
<button onclick="loadLeads()">Refresh</button>
<a class="btn" href="/admin/leads" target="_blank">View Raw Leads</a>
<a class="btn" href="/health" target="_blank">Health Check</a>
</div>

<div class="stats">
<div class="stat"><h2 id="total">0</h2><span>Total Leads</span></div>
<div class="stat"><h2 id="newLeads">0</h2><span>New Leads</span></div>
<div class="stat"><h2 id="booked">0</h2><span>Booked</span></div>
<div class="stat"><h2 id="paid">0</h2><span>Paid</span></div>
<div class="stat"><h2 id="missed">0</h2><span>Missed Calls</span></div>
<div class="stat"><h2 id="revenue">$0</h2><span>Estimated Lead Value</span></div>
</div>

<div class="section">
<h2>Incoming Leads</h2>
<div id="leads"></div>
</div>

<script>
const providers = ${JSON.stringify(providers)};

async function loadLeads() {
const res = await fetch("/admin/leads");
const data = await res.json();
const leads = (data.leads || []).filter(l => !l.archived);

document.getElementById("total").innerText = leads.length;
document.getElementById("newLeads").innerText = leads.filter(l => l.lead_status === "New").length;
document.getElementById("booked").innerText = leads.filter(l => l.lead_status === "Booked").length;
document.getElementById("paid").innerText = leads.filter(l => l.lead_status === "Paid").length;
document.getElementById("missed").innerText = leads.filter(l => l.call_status === "Missed").length;
document.getElementById("revenue").innerText = "$" + (leads.length * 35);

const box = document.getElementById("leads");

if (leads.length === 0) {
box.innerHTML = '<div class="empty">No active leads yet. Click “Create Test Lead” or make a CallRail test call.</div>';
return;
}

box.innerHTML = leads.map(lead => {
const badgeClass =
lead.lead_status === "Booked" ? "booked" :
lead.lead_status === "Paid" ? "paid" :
lead.lead_status === "Declined" ? "declined" :
lead.call_status === "Missed" ? "missed" : "";

return \`
<div class="lead-card">
<div class="lead-top">
<div>
<h3>📞 \${lead.customer_phone}</h3>
<div class="small">Lead ID: \${lead.id}</div>
</div>
<span class="badge \${badgeClass}">\${lead.lead_status}</span>
</div>

<div class="info">
<strong>Service:</strong> \${lead.service}<br>
<strong>Source:</strong> \${lead.source}<br>
<strong>Tracking Number:</strong> \${lead.tracking_number}<br>
<strong>Duration:</strong> \${lead.duration} seconds<br>
<strong>Lead Score:</strong> \${lead.lead_score}<br>
<strong>Provider:</strong> \${lead.provider_assigned}<br>
<strong>Lead Price:</strong> \${lead.price}<br>
<strong>Created:</strong> \${lead.created_at}
</div>

<div class="controls">
<button class="accept" onclick="updateStatus('\${lead.id}', 'Accepted')">Accept</button>
<button class="booked" onclick="updateStatus('\${lead.id}', 'Booked')">Booked</button>
<button class="paid" onclick="updateStatus('\${lead.id}', 'Paid')">Paid</button>
<button class="decline" onclick="updateStatus('\${lead.id}', 'Declined')">Decline</button>
<button class="archive" onclick="archiveLead('\${lead.id}')">Archive</button>
<button class="delete" onclick="deleteLead('\${lead.id}')">Delete</button>
\${lead.recording ? '<a class="btn" href="' + lead.recording + '" target="_blank">Recording</a>' : ''}
</div>

<div class="controls">
<select onchange="assignProvider('\${lead.id}', this.value)">
\${providers.map(p => \`<option value="\${p}" \${p === lead.provider_assigned ? "selected" : ""}>\${p}</option>\`).join("")}
</select>
</div>

<textarea id="notes-\${lead.id}" placeholder="Add notes about this lead...">\${lead.notes || ""}</textarea>
<div class="controls">
<button onclick="saveNotes('\${lead.id}')">Save Notes</button>
</div>
</div>
\`;
}).join("");
}

async function updateStatus(id, status) {
await fetch("/lead/" + id + "/status", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ status })
});
loadLeads();
}

async function assignProvider(id, provider) {
await fetch("/lead/" + id + "/provider", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ provider })
});
loadLeads();
}

async function saveNotes(id) {
const notes = document.getElementById("notes-" + id).value;
await fetch("/lead/" + id + "/notes", {
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({ notes })
});
loadLeads();
}

async function archiveLead(id) {
await fetch("/lead/" + id + "/archive", { method:"POST" });
loadLeads();
}

async function deleteLead(id) {
if (!confirm("Delete this lead?")) return;
await fetch("/lead/" + id, { method:"DELETE" });
loadLeads();
}

async function createTestLead() {
await fetch("/lead/test", { method:"POST" });
loadLeads();
}

loadLeads();
setInterval(loadLeads, 5000);
</script>

</body>
</html>
`);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
