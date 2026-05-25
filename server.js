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
Robyn: "+14435781686"
};

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

function providerCode(name) {
return providers[name].replace(/\D/g, "").slice(-4);
}

function safe(v) {
return String(v || "");
}

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

// =====================================================
// HEALTH
// =====================================================

app.get("/health", (req, res) => {
res.send("SERVER RUNNING");
});

// =====================================================
// CALLRAIL TEST
// =====================================================

app.get("/callrail/test", async (req, res) => {

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
"Test Phone Call",
"CallRail Test",
"",
"NEW",
"",
"Manual test lead",
"0",
"35"
]);

res.send("CallRail test lead added");
});

// =====================================================
// CALLRAIL WEBHOOK
// =====================================================

app.post("/callrail/webhook", async (req, res) => {

try {

const b = req.body || {};

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
b.customer_name ||
b.name ||
"CallRail Lead",

b.customer_phone ||
b.customer_number ||
b.caller_number ||
b.from ||
"Unknown",

b.service ||
b.call_type ||
"Phone Call Lead",

"CallRail",

"",

"NEW",

b.recording ||
b.recording_url ||
"",

JSON.stringify(b).slice(0, 2000),

"0",

"35"
]);

res.status(200).json({
success: true
});

} catch (err) {

console.log(err);

res.status(500).json({
success: false
});

}

});

// =====================================================
// ADMIN DASHBOARD
// =====================================================

app.get("/admin", async (req, res) => {

if (req.query.token !== ADMIN_TOKEN) {
return res.send("ADMIN LOCKED");
}

const r = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

const leads = r.rows;

res.send(`
<html>
<head>
<title>NLN Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
margin:0;
background:#020817;
color:white;
font-family:Arial;
}

.wrap{
max-width:1400px;
margin:auto;
padding:20px;
}

.top{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:20px;
}

.title{
font-size:40px;
font-weight:900;
}

.grid{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:18px;
margin-bottom:20px;
}

.card{
background:#071226;
border-radius:24px;
padding:25px;
border:1px solid #1e293b;
}

.big{
font-size:42px;
font-weight:900;
}

.jobs{
display:flex;
flex-direction:column;
gap:18px;
}

.job{
background:#071226;
border-radius:24px;
border:1px solid #1e293b;
padding:20px;
}

.job-title{
font-size:28px;
font-weight:900;
line-height:1.4;
margin-bottom:10px;
word-break:break-word;
}

.sub{
color:#94a3b8;
line-height:1.6;
font-size:16px;
word-break:break-word;
}

.buttons{
display:flex;
gap:10px;
flex-wrap:wrap;
margin-top:18px;
}

.btn{
border:none;
padding:14px 18px;
border-radius:14px;
color:white;
font-weight:900;
text-decoration:none;
cursor:pointer;
}

.blue{background:#2563eb}
.purple{background:#9333ea}
.green{background:#16a34a}
.orange{background:#ea580c}
.red{background:#991b1b}

form{
margin-top:20px;
}

input,select,textarea{
width:100%;
padding:16px;
margin-top:12px;
border:none;
border-radius:14px;
background:#0f172a;
color:white;
box-sizing:border-box;
}

.submit{
width:100%;
padding:18px;
margin-top:18px;
border:none;
border-radius:14px;
background:linear-gradient(90deg,#2563eb,#7c3aed);
color:white;
font-weight:900;
font-size:18px;
}

@media(max-width:700px){

.title{
font-size:28px;
}

.job-title{
font-size:22px;
}

.buttons{
display:grid;
grid-template-columns:1fr 1fr;
}

.btn{
text-align:center;
}

}

</style>

</head>

<body>

<div class="wrap">

<div class="top">
<div>
<div class="title">Admin Dashboard</div>
<div style="color:#94a3b8">Luxury Dispatch Center</div>
</div>
</div>

<div class="grid">

<div class="card">
<div class="big">${leads.length}</div>
<div>Total Jobs</div>
</div>

<div class="card">
<div class="big">${Object.keys(providers).length}</div>
<div>Providers</div>
</div>

<div class="card">
<div class="big">$0</div>
<div>Payment Threshold</div>
</div>

</div>

<div class="card">

<h2>Add Job</h2>

<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">

<input name="customer_name" placeholder="Customer Name">

<input name="customer_phone" placeholder="Customer Phone">

<input name="service" placeholder="Service">

<input name="source" placeholder="Source">

<input name="job_amount" placeholder="Job Amount">

<input name="recording" placeholder="Recording URL">

<textarea name="notes" placeholder="Notes"></textarea>

<select name="provider_assigned">

<option value="">Assign Provider</option>

${Object.keys(providers).map(p => `
<option value="${p}">${p}</option>
`).join("")}

</select>

<button class="submit">
Create Job
</button>

</form>

</div>

<div style="height:20px"></div>

<div class="jobs">

${leads.map(job => `

<div class="job">

<div class="job-title">
${safe(job.service)}
</div>

<div class="sub">
${safe(job.customer_name)} • ${safe(job.customer_phone)}
</div>

<div class="sub">
Status: ${safe(job.lead_status)}
</div>

<div class="sub">
Provider: ${safe(job.provider_assigned || "Not Assigned")}
</div>

<div class="sub">
Amount: $${safe(job.job_amount)}
</div>

<div class="buttons">

<a class="btn blue"
href="tel:${safe(job.customer_phone)}">
Call
</a>

<a class="btn purple"
href="sms:${safe(job.customer_phone)}">
Text
</a>

<a class="btn orange"
href="${safe(job.recording || "#")}">
Recording
</a>

</div>

</div>

`).join("")}

</div>

</div>

</body>
</html>
`);

});

// =====================================================
// ADD JOB
// =====================================================

app.post("/admin/add-job", async (req, res) => {

if (req.query.token !== ADMIN_TOKEN) {
return res.send("LOCKED");
}

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

req.body.provider_assigned
? "ASSIGNED"
: "NEW",

req.body.recording || "",

req.body.notes || "",

req.body.job_amount || "0",

"35"

]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);

});

// =====================================================
// PROVIDER DASHBOARD
// =====================================================

app.get("/provider/:name", async (req, res) => {

const name = req.params.name;

if (!providers[name]) {
return res.send("Provider not found");
}

if (req.query.code !== providerCode(name)) {

return res.send(`

<html>

<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
margin:0;
background:#020817;
color:white;
font-family:Arial;
display:flex;
align-items:center;
justify-content:center;
min-height:100vh;
padding:20px;
}

.box{
width:100%;
max-width:360px;
background:#071226;
border-radius:24px;
padding:28px;
border:1px solid #1e293b;
}

input{
width:100%;
padding:16px;
margin-top:14px;
border:none;
border-radius:14px;
background:#0f172a;
color:white;
box-sizing:border-box;
}

button{
width:100%;
padding:18px;
margin-top:18px;
border:none;
border-radius:14px;
background:linear-gradient(90deg,#2563eb,#7c3aed);
color:white;
font-weight:900;
font-size:18px;
}

</style>

</head>

<body>

<form class="box">

<h1>${name}</h1>

<p>Enter your 4 digit provider code</p>

<input
name="code"
maxlength="4"
placeholder="4 digit code">

<button>
Login
</button>

</form>

</body>

</html>

`);

}

const r = await pool.query(`
SELECT *
FROM leads
WHERE provider_assigned=$1
OR lead_status='NEW'
ORDER BY id DESC
`,[name]);

const leads = r.rows;

res.send(`
<html>
<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
margin:0;
background:#020817;
color:white;
font-family:Arial;
}

.wrap{
max-width:1200px;
margin:auto;
padding:20px;
}

.title{
font-size:36px;
font-weight:900;
}

.jobs{
display:flex;
flex-direction:column;
gap:18px;
margin-top:20px;
}

.job{
background:#071226;
border-radius:24px;
border:1px solid #1e293b;
padding:20px;
}

.job-title{
font-size:28px;
font-weight:900;
line-height:1.4;
word-break:break-word;
}

.sub{
color:#94a3b8;
line-height:1.6;
font-size:16px;
word-break:break-word;
}

.buttons{
display:flex;
flex-wrap:wrap;
gap:10px;
margin-top:18px;
}

.btn{
border:none;
padding:14px 18px;
border-radius:14px;
color:white;
font-weight:900;
text-decoration:none;
cursor:pointer;
}

.blue{background:#2563eb}
.purple{background:#9333ea}
.green{background:#16a34a}
.orange{background:#ea580c}

@media(max-width:700px){

.job-title{
font-size:22px;
}

.buttons{
display:grid;
grid-template-columns:1fr 1fr;
}

.btn{
text-align:center;
}

}

</style>

</head>

<body>

<div class="wrap">

<div class="title">
Welcome ${name}
</div>

<div style="color:#94a3b8">
Provider Dashboard
</div>

<div class="jobs">

${leads.map(job => `

<div class="job">

<div class="job-title">
${safe(job.service)}
</div>

<div class="sub">
${safe(job.customer_name)} • ${safe(job.customer_phone)}
</div>

<div class="sub">
Status: ${safe(job.lead_status)}
</div>

<div class="sub">
Amount: $${safe(job.job_amount)}
</div>

<div class="buttons">

<a class="btn blue"
href="tel:${safe(job.customer_phone)}">
Call
</a>

<a class="btn purple"
href="sms:${safe(job.customer_phone)}">
Text
</a>

<a class="btn orange"
href="${safe(job.recording || "#")}">
Recording
</a>

</div>

</div>

`).join("")}

</div>

</div>

</body>
</html>
`);

});

// =====================================================
// START
// =====================================================

initDB().then(() => {

app.listen(PORT, () => {

console.log("SERVER RUNNING");

});

});
