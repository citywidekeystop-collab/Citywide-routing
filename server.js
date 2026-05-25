// FULL CLEAN NLN LUXURY DASHBOARD SERVER
// MOBILE FIXED VERSION
// PROVIDER LOGIN VERSION

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
Robyn: "+14435781686",
"Car Key Chris": "+12232630824"
};

async function initDB() {

await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
customer_name TEXT,
customer_phone TEXT,
service TEXT,
source TEXT,
recording TEXT,
provider_assigned TEXT,
lead_status TEXT DEFAULT 'new',
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

}

function providerCode(name) {

const phone =
providers[name] || "";

return phone
.replace(/\D/g, "")
.slice(-4);

}

function requireAdmin(req, res, next) {

const token =
req.query.token ||
req.headers["x-admin-token"];

if (token !== ADMIN_TOKEN) {
return res.status(401).send("Admin Locked");
}

next();

}

function requireProvider(req, res, next) {

const name =
req.params.name;

const code =
req.query.code;

if (!providers[name]) {
return res.send("Provider not found");
}

if (code !== providerCode(name)) {

return res.send(`

<html>

<body style="
background:#050b14;
color:white;
font-family:Arial;
display:flex;
align-items:center;
justify-content:center;
height:100vh;
">

<form
method="GET"
action="/provider/${name}"
style="
background:#08162d;
padding:30px;
border-radius:24px;
width:320px;
">

<h1>NLN Provider Login</h1>

<p>Enter your 4 digit access code.</p>

<input
name="code"
maxlength="4"
placeholder="4 digit code"
style="
width:100%;
padding:16px;
border-radius:16px;
border:none;
margin-top:10px;
font-size:20px;
">

<button
style="
width:100%;
margin-top:16px;
padding:16px;
border:none;
border-radius:16px;
background:#2563eb;
color:white;
font-weight:900;
font-size:18px;
">

Login

</button>

</form>

</body>

</html>

`);

}

next();

}

function safe(v) {

return String(v || "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;");

}

function money(v) {

return "$" +
Number(v || 0).toLocaleString();

}

async function getLeads() {

const result =
await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

return result.rows;

}

app.get("/", (req, res) => {

res.redirect(
`/admin?token=${ADMIN_TOKEN}`
);

});

app.get("/health", (req, res) => {

res.json({
ok:true
});

});

app.post("/admin/add-job", requireAdmin, async (req, res) => {

await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
source,
recording,
provider_assigned,
lead_status,
notes,
job_amount,
lead_cost
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
`, [

req.body.customer_name || "Customer",
req.body.customer_phone || "Unknown",
req.body.service || "Locksmith Service",
req.body.source || "Manual",
req.body.recording || "",
req.body.provider_assigned || "",
req.body.provider_assigned
? "assigned"
: "new",
req.body.notes || "",
req.body.job_amount || "0",
req.body.lead_cost || "35"

]);

res.redirect(
`/admin?token=${ADMIN_TOKEN}`
);

});

function mobileCSS() {

return `

*{
box-sizing:border-box;
}

body{
margin:0;
background:#061122;
font-family:Arial;
color:white;
}

.sidebar{
position:fixed;
left:0;
top:0;
bottom:0;
width:230px;
background:#08162d;
padding:24px;
overflow:auto;
}

.logo{
font-size:42px;
font-weight:900;
}

.sub{
opacity:.6;
font-size:12px;
font-weight:700;
}

.sidebar a{
display:block;
margin-top:12px;
padding:14px;
border-radius:18px;
background:#0d1d37;
text-decoration:none;
color:white;
font-weight:700;
}

.main{
margin-left:230px;
padding:24px;
}

.hero{
background:#08162d;
padding:28px;
border-radius:28px;
margin-bottom:22px;
}

.stats{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:16px;
margin-bottom:24px;
}

.stat{
background:#08162d;
padding:22px;
border-radius:24px;
}

.stat h1{
margin:0;
font-size:36px;
}

.actions{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:16px;
margin-bottom:24px;
}

.action{
background:#08162d;
border-radius:24px;
padding:28px;
text-align:center;
text-decoration:none;
color:white;
font-weight:800;
font-size:18px;
}

.columns{
display:grid;
grid-template-columns:1fr 1fr;
gap:20px;
}

.panel{
background:#08162d;
padding:24px;
border-radius:24px;
}

.job{
background:#07111f;
padding:18px;
border-radius:22px;
margin-top:16px;
}

.job-buttons{
display:grid;
grid-template-columns:1fr 1fr;
gap:10px;
margin-top:14px;
}

.job-buttons a{
padding:14px;
border-radius:16px;
text-align:center;
text-decoration:none;
color:white;
font-weight:800;
}

.blue{
background:#2563eb;
}

.green{
background:#16a34a;
}

.purple{
background:#9333ea;
}

.orange{
background:#ea580c;
}

.red{
background:#7f1d1d;
}

.payment{
background:#08162d;
padding:24px;
border-radius:24px;
margin-top:22px;
}

.threshold{
height:14px;
border-radius:999px;
background:#12233f;
overflow:hidden;
margin-top:18px;
}

.threshold-fill{
height:100%;
width:82%;
background:#2563eb;
}

.add-form{
margin-top:26px;
background:#08162d;
padding:24px;
border-radius:24px;
}

.add-form input,
.add-form textarea,
.add-form select{
width:100%;
padding:16px;
margin-top:12px;
background:#07111f;
border:none;
border-radius:16px;
color:white;
}

.add-form button{
width:100%;
padding:16px;
margin-top:16px;
border:none;
border-radius:16px;
background:#2563eb;
color:white;
font-size:18px;
font-weight:900;
}

@media(max-width:900px){

.sidebar{
position:fixed;
bottom:0;
top:auto;
width:100%;
height:84px;
display:flex;
padding:10px;
z-index:999;
}

.logo,
.sub{
display:none;
}

.sidebar a{
flex:1;
margin:0 4px;
padding:12px 6px;
text-align:center;
font-size:14px;
}

.main{
margin-left:0;
padding:16px;
padding-bottom:120px;
}

.stats{
grid-template-columns:1fr 1fr;
}

.actions{
grid-template-columns:1fr 1fr;
}

.columns{
grid-template-columns:1fr;
}

.job-buttons{
grid-template-columns:1fr 1fr;
}

}

`;

}

function renderJob(job) {

const providerPhone =
providers[job.provider_assigned] || "";

return `

<div class="job">

<h3>
${safe(job.service)}
</h3>

<p>
${safe(job.customer_name)}
</p>

<p>
${safe(job.customer_phone)}
</p>

<div class="job-buttons">

<a
class="blue"
href="tel:${safe(job.customer_phone)}">

Call

</a>

<a
class="purple"
href="sms:${safe(job.customer_phone)}">

Text

</a>

${
providerPhone
? `
<a
class="green"
href="tel:${providerPhone}">
Provider
</a>
`
: ""
}

${
job.recording
? `
<a
class="orange"
href="${safe(job.recording)}">
Recording
</a>
`
: ""
}

</div>

</div>

`;

}

app.get("/admin", requireAdmin, async (req, res) => {

const leads =
await getLeads();

const revenue =
leads.reduce((s,l)=>
s + Number(l.job_amount || 0),0);

res.send(`

<html>

<head>

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<style>

${mobileCSS()}

</style>

</head>

<body>

<div class="sidebar">

<div class="logo">
NLN
</div>

<div class="sub">
CITYWIDE ROUTING
</div>

<a href="/admin?token=${ADMIN_TOKEN}">
Jobs
</a>

<a href="#tools">
Tools
</a>

<a href="#payments">
Pay
</a>

<a href="javascript:location.reload()">
Refresh
</a>

</div>

<div class="main">

<div class="hero">

<h1>
Admin Dashboard
</h1>

<p>
Luxury Dispatch Command Center
</p>

</div>

<div class="stats">

<div class="stat">
<h1>${leads.length}</h1>
<p>Total Jobs</p>
</div>

<div class="stat">
<h1>${money(revenue)}</h1>
<p>Revenue</p>
</div>

<div class="stat">
<h1>${Object.keys(providers).length}</h1>
<p>Providers</p>
</div>

<div class="stat">
<h1>4.9⭐</h1>
<p>Rating</p>
</div>

</div>

<div class="actions">

<a class="action" href="#add">
➕ Add Job
</a>

<a class="action" href="#providers">
👥 Providers
</a>

<a class="action" href="#payments">
💳 Payments
</a>

<a class="action" href="#tools">
🧰 Tools
</a>

</div>

<div class="columns">

<div class="panel">

<h2>
Recent Jobs
</h2>

${leads.map(renderJob).join("")}

</div>

<div>

<div
class="payment"
id="payments">

<h2>
Payment Threshold
</h2>

<h1>
$0
</h1>

<div class="threshold">
<div class="threshold-fill"></div>
</div>

<p>
Google-style threshold system
</p>

</div>

<div
class="panel"
id="providers"
style="margin-top:20px">

<h2>
Providers
</h2>

${Object.entries(providers).map(([name,phone]) => `

<div class="job">

<h3>
${name}
</h3>

<p>
${phone}
</p>

<p>
Code:
${providerCode(name)}
</p>

<div class="job-buttons">

<a
class="green"
href="tel:${phone}">
Call
</a>

<a
class="purple"
href="sms:${phone}">
Text
</a>

<a
class="blue"
href="/provider/${encodeURIComponent(name)}?code=${providerCode(name)}">
Dashboard
</a>

</div>

</div>

`).join("")}

</div>

</div>

</div>

<div
class="add-form"
id="add">

<h2>
Add Job
</h2>

<form
method="POST"
action="/admin/add-job?token=${ADMIN_TOKEN}">

<input
name="customer_name"
placeholder="Customer Name">

<input
name="customer_phone"
placeholder="Customer Phone">

<input
name="service"
placeholder="Service">

<input
name="source"
placeholder="Source">

<input
name="recording"
placeholder="Recording URL">

<input
name="job_amount"
placeholder="Job Amount">

<input
name="lead_cost"
placeholder="Lead Cost">

<select name="provider_assigned">

<option value="">
Assign Provider
</option>

${Object.keys(providers).map(p => `
<option value="${p}">
${p}
</option>
`).join("")}

</select>

<textarea
name="notes"
placeholder="Notes"></textarea>

<button>
Create Job
</button>

</form>

</div>

</div>

</body>

</html>

`);

});

app.get("/provider/:name", requireProvider, async (req, res) => {

const name =
req.params.name;

const leads =
(await getLeads())
.filter(l =>
l.provider_assigned === name ||
!l.provider_assigned
);

res.send(`

<html>

<head>

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<style>

${mobileCSS()}

</style>

</head>

<body>

<div class="sidebar">

<div class="logo">
NLN
</div>

<div class="sub">
PROVIDER PANEL
</div>

<a href="#jobs">
Jobs
</a>

<a href="#payments">
Pay
</a>

<a href="#tools">
Tools
</a>

<a href="javascript:location.reload()">
Refresh
</a>

</div>

<div class="main">

<div class="hero">

<h1>
Welcome ${safe(name)}
</h1>

<p>
Provider Dashboard
</p>

</div>

<div class="stats">

<div class="stat">
<h1>${leads.length}</h1>
<p>Jobs</p>
</div>

<div class="stat">
<h1>$0</h1>
<p>Balance</p>
</div>

<div class="stat">
<h1>4.9⭐</h1>
<p>Rating</p>
</div>

<div class="stat">
<h1>Online</h1>
<p>Status</p>
</div>

</div>

<div class="actions">

<a class="action" href="tel:+14435781686">
📞 Dispatch
</a>

<a class="action" href="sms:+14435781686">
💬 Text
</a>

<a class="action" href="#jobs">
💼 Jobs
</a>

<a class="action" href="#tools">
🧰 Tools
</a>

</div>

<div class="columns">

<div
class="panel"
id="jobs">

<h2>
Active Jobs
</h2>

${leads.map(renderJob).join("")}

</div>

<div>

<div
class="payment"
id="payments">

<h2>
Payment Threshold
</h2>

<h1>
$0
</h1>

<div class="threshold">
<div class="threshold-fill"></div>
</div>

<p>
Threshold available
</p>

</div>

<div
class="panel"
id="tools"
style="margin-top:20px">

<h2>
Provider Tools
</h2>

<div class="job-buttons">

<a
class="blue"
href="#">
Directions
</a>

<a
class="green"
href="#">
Complete
</a>

<a
class="purple"
href="#">
Reviews
</a>

<a
class="orange"
href="#">
Earnings
</a>

</div>

</div>

</div>

</div>

</div>

</body>

</html>

`);

});

initDB().then(() => {

app.listen(PORT, () => {

console.log(
"NLN Luxury Dashboard Running"
);

});

});
