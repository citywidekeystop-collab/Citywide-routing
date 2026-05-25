const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: {
rejectUnauthorized: false
}
});

const providers = {
Max: "+14436792242",
Dreh: "+12024125443",
Tee: "+14104199281",
Robyn: "+14435781686"
};

function safe(v) {
return String(v || "");
}

function money(v) {
return "$" + Number(v || 0).toLocaleString();
}

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];

if (token !== ADMIN_TOKEN) {
return res.status(403).send("ACCESS DENIED");
}

next();
}

async function initDB() {
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer_name TEXT,
customer_phone TEXT,
service TEXT,
source TEXT,
provider_assigned TEXT,
lead_status TEXT DEFAULT 'NEW',
recording TEXT,
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);
}

initDB();

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.send("SERVER RUNNING");
});

app.get("/callrail/test", async (req, res) => {
try {

await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
source,
provider_assigned,
lead_status,
recording,
notes,
job_amount,
lead_cost
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [
"CallRail Test Lead",
"+14430000000",
"Incoming Phone Call",
"CallRail Test",
"",
"NEW",
"",
"Manual test lead",
"0",
"35"
]);

res.send("CallRail test lead added");

} catch (err) {

res.status(500).json({
success: false,
error: err.message
});

}
});

app.post("/callrail/webhook", async (req, res) => {

try {

const b = req.body || {};

const customerName =
b.customer_name ||
b.name ||
b.company ||
"Phone Lead";

const customerPhone =
b.customer_phone ||
b.customer_number ||
b.caller_number ||
b.from ||
b.phone ||
"Unknown";

const serviceType =
b.service ||
b.call_type ||
"Incoming Phone Call";

const recordingUrl =
b.recording ||
b.recording_url ||
b.call_recording ||
"";

const cleanNotes =
b.call_summary ||
b.summary ||
b.transcript ||
b.note ||
"Incoming call from CallRail";

await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
source,
provider_assigned,
lead_status,
recording,
notes,
job_amount,
lead_cost
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [
safe(customerName),
safe(customerPhone),
safe(serviceType),
"CallRail",
"",
"NEW",
safe(recordingUrl),
safe(cleanNotes),
"0",
"35"
]);

res.json({
success: true
});

} catch (err) {

res.status(500).json({
success: false,
error: err.message
});

}

});

app.post("/admin/add-job", requireAdmin, async (req, res) => {

try {

await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
source,
provider_assigned,
lead_status,
recording,
notes,
job_amount,
lead_cost
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [
req.body.customer_name || "Unknown",
req.body.customer_phone || "Unknown",
req.body.service || "Locksmith Service",
req.body.source || "Manual",
req.body.provider_assigned || "",
req.body.provider_assigned ? "ASSIGNED" : "NEW",
req.body.recording || "",
req.body.notes || "",
req.body.job_amount || "0",
req.body.lead_cost || "35"
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);

} catch (err) {

res.send(err.message);

}

});

app.get("/api/leads", async (req, res) => {

try {

const leads = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

res.json(leads.rows);

} catch (err) {

res.status(500).json({
error: err.message
});

}

});

app.get("/provider/:name", async (req, res) => {

const name = req.params.name;

const leads = await pool.query(`
SELECT *
FROM leads
WHERE provider_assigned = $1
ORDER BY id DESC
`, [name]);

let jobs = "";

leads.rows.forEach(job => {

jobs += `
<div style="
background:#071427;
border:1px solid #18314f;
padding:16px;
margin-bottom:15px;
border-radius:18px;
">

<div style="
display:flex;
justify-content:space-between;
margin-bottom:10px;
">
<strong>${safe(job.service)}</strong>
<span>${money(job.job_amount)}</span>
</div>

<div style="color:#9db5d3;font-size:14px;">
${safe(job.customer_name)}
</div>

<div style="margin-top:10px;">
<a href="tel:${safe(job.customer_phone)}"
style="
background:#2563eb;
padding:10px 18px;
border-radius:10px;
color:white;
text-decoration:none;
margin-right:10px;
">
Call
</a>

<a href="sms:${safe(job.customer_phone)}"
style="
background:#9333ea;
padding:10px 18px;
border-radius:10px;
color:white;
text-decoration:none;
">
Text
</a>
</div>

</div>
`;

});

res.send(`
<html>
<head>
<title>${name} Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>

body{
background:#020817;
color:white;
font-family:Arial;
padding:20px;
}

.top{
background:#071427;
padding:20px;
border-radius:20px;
margin-bottom:20px;
}

</style>

</head>

<body>

<div class="top">
<h1>${name} Provider Dashboard</h1>
<p>Assigned Jobs: ${leads.rows.length}</p>
</div>

${jobs}

</body>
</html>
`);

});

app.get("/admin", requireAdmin, async (req, res) => {

const leads = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

let cards = "";

leads.rows.forEach(job => {

cards += `
<div style="
background:#071427;
border:1px solid #18314f;
padding:18px;
border-radius:20px;
margin-bottom:16px;
">

<div style="
display:flex;
justify-content:space-between;
margin-bottom:12px;
">
<strong>${safe(job.service)}</strong>
<span>${job.lead_status}</span>
</div>

<div style="font-size:15px;">
${safe(job.customer_name)}
</div>

<div style="
color:#9fb3c8;
margin-top:5px;
margin-bottom:10px;
">
${safe(job.customer_phone)}
</div>

<div style="
background:#020817;
padding:12px;
border-radius:12px;
font-size:14px;
line-height:1.5;
color:#d6e2f0;
margin-bottom:14px;
white-space:pre-wrap;
">
${safe(job.notes)}
</div>

<div style="
display:flex;
gap:10px;
flex-wrap:wrap;
">

<a href="tel:${safe(job.customer_phone)}"
style="
background:#2563eb;
padding:10px 16px;
border-radius:10px;
color:white;
text-decoration:none;
">
Call
</a>

<a href="sms:${safe(job.customer_phone)}"
style="
background:#9333ea;
padding:10px 16px;
border-radius:10px;
color:white;
text-decoration:none;
">
Text
</a>

</div>

</div>
`;

});

res.send(`
<html>

<head>

<title>NLN Admin Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>

body{
background:#020817;
color:white;
font-family:Arial;
padding:20px;
}

input, select{
width:100%;
padding:14px;
margin-bottom:10px;
border:none;
border-radius:12px;
background:#071427;
color:white;
}

button{
background:#2563eb;
border:none;
color:white;
padding:14px;
width:100%;
border-radius:12px;
font-size:16px;
cursor:pointer;
}

.box{
background:#071427;
padding:20px;
border-radius:20px;
margin-bottom:20px;
}

</style>

</head>

<body>

<div class="box">

<h1>NLN Admin Dashboard</h1>

<p>Total Leads: ${leads.rows.length}</p>

</div>

<div class="box">

<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">

<input
name="customer_name"
placeholder="Customer Name"
>

<input
name="customer_phone"
placeholder="Customer Phone"
>

<input
name="service"
placeholder="Service"
>

<input
name="job_amount"
placeholder="Job Amount"
>

<select name="provider_assigned">

<option value="">Unassigned</option>
<option value="Max">Max</option>
<option value="Dreh">Dreh</option>
<option value="Tee">Tee</option>
<option value="Robyn">Robyn</option>

</select>

<button type="submit">
Add Job
</button>

</form>

</div>

${cards}

</body>

</html>
`);

});

app.listen(PORT, () => {
console.log("SERVER RUNNING");
});
