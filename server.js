const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: {
rejectUnauthorized: false
}
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

console.log(err);

}
}

initDB();

app.get("/health", (req, res) => {
res.json({
success: true,
status: "online"
});
});

app.post("/lead/new", async (req, res) => {

try {

console.log(req.body);

const lead = {
customer_phone:
req.body.callernum ||
req.body.customer_phone ||
"Unknown",

tracking_number:
req.body.trackingnum ||
"",

source:
req.body.callsource ||
"CallRail",

service:
req.body.keyword ||
"Emergency Locksmith",

duration:
req.body.duration ||
"0",

recording:
req.body.recording ||
"",

lead_score:
req.body.score ||
"92",

call_status:
"new",

provider_assigned:
"Unassigned",

lead_status:
"new"
};

await pool.query(
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
lead_status
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
lead.lead_status
]
);

console.log("✅ LEAD SAVED");

res.json({
success: true
});

} catch (err) {

console.log(err);

res.status(500).json({
success: false
});

}
});

app.get("/api/leads", async (req, res) => {

try {

const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

res.json(result.rows);

} catch (err) {

console.log(err);

res.status(500).json([]);
}
});

app.post("/api/leads/:id/status", async (req, res) => {

try {

const { status } = req.body;

await pool.query(
`
UPDATE leads
SET lead_status = $1
WHERE id = $2
`,
[status, req.params.id]
);

res.json({
success: true
});

} catch (err) {

console.log(err);

res.status(500).json({
success: false
});

}
});

app.post("/api/leads/:id/provider", async (req, res) => {

try {

const { provider } = req.body;

await pool.query(
`
UPDATE leads
SET provider_assigned = $1
WHERE id = $2
`,
[provider, req.params.id]
);

res.json({
success: true
});

} catch (err) {

console.log(err);

res.status(500).json({
success: false
});

}
});

app.post("/api/leads/:id/archive", async (req, res) => {

try {

await pool.query(
`
UPDATE leads
SET archived = true
WHERE id = $1
`,
[req.params.id]
);

res.json({
success: true
});

} catch (err) {

console.log(err);

res.status(500).json({
success: false
});

}
});

app.post("/send-provider-text", async (req, res) => {

try {

const { phone, lead } = req.body;

const smsBody = `
NEW LEAD

Customer: ${lead.customer_phone || "Unknown"}

Service: ${lead.service || "Locksmith Service"}

Source: ${lead.source || "CallRail"}

Lead Score: ${lead.lead_score || 0}

Call customer ASAP.
`;

const smsLink =
`sms:${phone}?body=${encodeURIComponent(smsBody)}`;

res.json({
success: true,
smsLink
});

} catch (err) {

console.log("TEXT ERROR:", err);

res.status(500).json({
success: false
});

}
});

app.get("/", async (req, res) => {

const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

const leads = result.rows;

const cards = leads.map((lead) => {

return `
<div class="card">

<h2>${lead.customer_phone}</h2>

<p><strong>Service:</strong> ${lead.service}</p>

<p><strong>Source:</strong> ${lead.source}</p>

<p><strong>Status:</strong> ${lead.lead_status}</p>

<p><strong>Provider:</strong> ${lead.provider_assigned}</p>

<p><strong>Lead Score:</strong> ${lead.lead_score}</p>

<p><strong>Created:</strong> ${lead.created_at}</p>

<div class="buttons">

<button onclick="updateStatus(${lead.id},'accepted')">
Accept
</button>

<button onclick="updateStatus(${lead.id},'booked')">
Booked
</button>

<button onclick="updateStatus(${lead.id},'paid')">
Paid
</button>

<button onclick="archiveLead(${lead.id})">
Archive
</button>

<button onclick="sendProviderText('${lead.customer_phone}','${lead.service}','${lead.source}','${lead.lead_score}')">
Text Provider
</button>

</div>

</div>
`;
}).join("");

res.send(`
<html>

<head>

<title>NLN Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
margin:0;
background:#0b1020;
color:white;
font-family:Arial;
}

.layout{
display:flex;
min-height:100vh;
}

.sidebar{
width:220px;
background:#111827;
padding:20px;
}

.sidebar h1{
font-size:24px;
}

.sidebar a{
display:block;
color:white;
text-decoration:none;
margin:18px 0;
}

.content{
flex:1;
padding:20px;
}

.card{
background:#172036;
padding:20px;
border-radius:14px;
margin-bottom:20px;
}

.buttons{
display:flex;
flex-wrap:wrap;
gap:10px;
margin-top:15px;
}

button{
border:none;
border-radius:8px;
padding:10px 14px;
cursor:pointer;
}

@media(max-width:768px){

.layout{
flex-direction:column;
}

.sidebar{
width:100%;
display:flex;
overflow:auto;
gap:20px;
}

.sidebar a{
white-space:nowrap;
}

}

</style>

</head>

<body>

<div class="layout">

<div class="sidebar">

<h1>🔥 NLN</h1>

<a href="/">Dashboard</a>
<a href="/">Providers</a>
<a href="/">Calls</a>
<a href="/">Settings</a>
<a href="/">Raw Leads</a>
<a href="/health">Health</a>

</div>

<div class="content">

<h1>NLN Lead Dashboard</h1>

<button onclick="createTestLead()">
Create Test Lead
</button>

<br><br>

${cards}

</div>

</div>

<script>

async function updateStatus(id,status){

await fetch('/api/leads/' + id + '/status',{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
status
})
});

location.reload();
}

async function archiveLead(id){

await fetch('/api/leads/' + id + '/archive',{
method:'POST'
});

location.reload();
}

async function createTestLead(){

await fetch('/lead/new',{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
customer_phone:'443-555-0100',
source:'Test Lead',
service:'Emergency Lockout',
score:'92'
})
});

location.reload();
}

async function sendProviderText(
customer_phone,
service,
source,
lead_score
){

const providerPhone =
prompt("Provider phone number:");

if(!providerPhone) return;

const response = await fetch(
'/send-provider-text',
{
method:'POST',
headers:{
'Content-Type':'application/json'
},
body:JSON.stringify({
phone:providerPhone,
lead:{
customer_phone,
service,
source,
lead_score
}
})
}
);

const data = await response.json();

if(data.smsLink){

window.location.href =
data.smsLink;

}

}

</script>

</body>

</html>
`);

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

console.log("✅ Server running on port", PORT);

});
