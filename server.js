const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let leads = [];

// HEALTH CHECK
app.get("/health", (req, res) => {
res.json({
status: "ok",
app: "NLN Citywide Routing",
time: new Date().toISOString()
});
});

// CALLRAIL WEBHOOK
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
"",

tracking_number:
call.tracking_phone_number ||
call.tracking_number ||
call.to ||
"",

source:
call.source ||
call.campaign ||
call.medium ||
"CallRail",

company:
call.company_name ||
"NLN",

duration:
call.duration ||
call.call_duration ||
0,

recording:
call.recording ||
call.recording_url ||
"",

call_status:
call.answered === false ? "Missed" : "New Lead",

provider_assigned: "Unassigned",
lead_status: "New",
created_at: new Date().toISOString(),

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

// VIEW ALL LEADS
app.get("/admin/leads", (req, res) => {
res.json({
success: true,
total: leads.length,
leads
});
});

// SIMPLE DASHBOARD PAGE
app.get("/", (req, res) => {
res.send(`
<html>
<head>
<title>NLN Lead Dashboard</title>
<style>
body { font-family: Arial; background:#0f172a; color:white; padding:30px; }
.card { background:#111827; padding:20px; margin:15px 0; border-radius:12px; }
.new { color:#22c55e; font-weight:bold; }
</style>
</head>
<body>
<h1>NLN Lead Dashboard</h1>
<p class="new">Backend Running ✅</p>
<p>Health: <a href="/health" style="color:#38bdf8;">/health</a></p>
<p>Leads JSON: <a href="/admin/leads" style="color:#38bdf8;">/admin/leads</a></p>
</body>
</html>
`);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
