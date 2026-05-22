const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let leads = [];

app.get("/health", (req, res) => {
res.json({
status: "ok",
app: "NLN Citywide Routing",
time: new Date().toISOString()
});
});

app.post("/lead/new", (req, res) => {
console.log("✅ CALLRAIL WEBHOOK RECEIVED:");
console.log(JSON.stringify(req.body, null, 2));

const call = req.body;

const lead = {
id: Date.now(),
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
call.campaign ||
call.medium ||
"CallRail",

duration:
call.duration ||
call.call_duration ||
0,

recording:
call.recording ||
call.recording_url ||
"",

call_status: call.answered === false ? "Missed" : "New Lead",
provider_assigned: "Unassigned",
lead_status: "New",
price: "$35",
created_at: new Date().toLocaleString(),
raw: call
};

leads.unshift(lead);

console.log("✅ LEAD SAVED:", lead);

res.status(200).json({
success: true,
message: "Lead received from CallRail",
lead
});
});

app.get("/admin/leads", (req, res) => {
res.json({
success: true,
total: leads.length,
leads
});
});

app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>NLN Lead Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
body {
margin: 0;
font-family: Arial, sans-serif;
background: #020617;
color: white;
}

.header {
background: linear-gradient(135deg, #111827, #1d4ed8);
padding: 25px;
border-bottom: 1px solid #334155;
}

.header h1 {
margin: 0;
font-size: 28px;
}

.header p {
margin: 8px 0 0;
color: #cbd5e1;
}

.stats {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
gap: 15px;
padding: 20px;
}

.stat {
background: #0f172a;
border: 1px solid #1e293b;
border-radius: 14px;
padding: 20px;
}

.stat h2 {
margin: 0;
font-size: 28px;
color: #38bdf8;
}

.stat span {
color: #94a3b8;
font-size: 14px;
}

.section {
padding: 20px;
}

.lead-card {
background: #0f172a;
border: 1px solid #1e293b;
border-radius: 16px;
padding: 20px;
margin-bottom: 15px;
box-shadow: 0 10px 25px rgba(0,0,0,.25);
}

.lead-top {
display: flex;
justify-content: space-between;
gap: 10px;
flex-wrap: wrap;
}

.badge {
background: #16a34a;
padding: 6px 12px;
border-radius: 999px;
font-size: 13px;
font-weight: bold;
}

.missed {
background: #dc2626;
}

.info {
margin-top: 12px;
line-height: 1.7;
color: #cbd5e1;
}

.buttons {
margin-top: 15px;
display: flex;
gap: 10px;
flex-wrap: wrap;
}

button, a.btn {
background: #2563eb;
color: white;
border: none;
padding: 10px 14px;
border-radius: 10px;
text-decoration: none;
font-weight: bold;
cursor: pointer;
}

.accept {
background: #16a34a;
}

.decline {
background: #dc2626;
}

.empty {
text-align: center;
padding: 50px;
color: #94a3b8;
background: #0f172a;
border-radius: 16px;
border: 1px dashed #334155;
}
</style>
</head>

<body>

<div class="header">
<h1>NLN Lead Dashboard</h1>
<p>Live CallRail leads, provider routing, and lead tracking</p>
</div>

<div class="stats">
<div class="stat">
<h2 id="total">0</h2>
<span>Total Leads</span>
</div>

<div class="stat">
<h2 id="newLeads">0</h2>
<span>New Leads</span>
</div>

<div class="stat">
<h2 id="missed">0</h2>
<span>Missed Calls</span>
</div>

<div class="stat">
<h2 id="revenue">$0</h2>
<span>Estimated Lead Value</span>
</div>
</div>

<div class="section">
<h2>Incoming Leads</h2>
<div id="leads"></div>
</div>

<script>
async function loadLeads() {
const res = await fetch("/admin/leads");
const data = await res.json();

const leads = data.leads || [];

document.getElementById("total").innerText = leads.length;
document.getElementById("newLeads").innerText = leads.filter(l => l.lead_status === "New").length;
document.getElementById("missed").innerText = leads.filter(l => l.call_status === "Missed").length;
document.getElementById("revenue").innerText = "$" + (leads.length * 35);

const box = document.getElementById("leads");

if (leads.length === 0) {
box.innerHTML = '<div class="empty">No leads yet. Make a test call from CallRail.</div>';
return;
}

box.innerHTML = leads.map(lead => \`
<div class="lead-card">
<div class="lead-top">
<h3>📞 \${lead.customer_phone}</h3>
<span class="badge \${lead.call_status === "Missed" ? "missed" : ""}">
\${lead.call_status}
</span>
</div>

<div class="info">
<strong>Source:</strong> \${lead.source}<br>
<strong>Tracking Number:</strong> \${lead.tracking_number}<br>
<strong>Duration:</strong> \${lead.duration} seconds<br>
<strong>Provider:</strong> \${lead.provider_assigned}<br>
<strong>Lead Price:</strong> \${lead.price}<br>
<strong>Created:</strong> \${lead.created_at}
</div>

<div class="buttons">
<button class="accept">Accept Lead</button>
<button class="decline">Decline</button>
\${lead.recording ? '<a class="btn" href="' + lead.recording + '" target="_blank">Listen Recording</a>' : ''}
</div>
</div>
\`).join("");
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
