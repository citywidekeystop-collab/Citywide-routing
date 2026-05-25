// ===============================
// NLN LUXURY DISPATCH DASHBOARD
// FULL NEW SERVER.JS
// EXACT PREMIUM VERSION
// ===============================

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

// ===============================
// DATABASE
// ===============================

async function initDB() {

await pool.query(`
CREATE TABLE IF NOT EXISTS leads(
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

function money(v){
return "$" + Number(v || 0).toLocaleString();
}

function safe(v){
return String(v || "");
}

async function getLeads(){

const r = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

return r.rows;

}

// ===============================
// AUTH
// ===============================

function requireAdmin(req,res,next){

const token =
req.query.token ||
req.headers["x-admin-token"];

if(token !== ADMIN_TOKEN){
return res.send("ADMIN LOCKED");
}

next();

}

// ===============================
// ADD JOB
// ===============================

app.post("/admin/add-job", requireAdmin, async(req,res)=>{

await pool.query(`
INSERT INTO leads(
customer_name,
customer_phone,
service,
source,
provider_assigned,
recording,
notes,
job_amount,
lead_cost
)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
`,[
req.body.customer_name || "Unknown",
req.body.customer_phone || "Unknown",
req.body.service || "Locksmith Service",
req.body.source || "Manual",
req.body.provider_assigned || "",
req.body.recording || "",
req.body.notes || "",
req.body.job_amount || "0",
req.body.lead_cost || "35"
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);

});

// ===============================
// JOB CARD
// ===============================

function jobCard(job){

return `

<div class="job-card">

<div class="job-top">

<div class="badge ${safe(job.lead_status).toLowerCase()}">
${safe(job.lead_status)}
</div>

<div class="price">
${money(job.job_amount)}
</div>

</div>

<div class="job-service">
${safe(job.service)}
</div>

<div class="job-customer">
${safe(job.customer_name)} • ${safe(job.customer_phone)}
</div>

<div class="job-buttons">

<a class="btn blue" href="tel:${safe(job.customer_phone)}">
📞 Call
</a>

<a class="btn purple" href="sms:${safe(job.customer_phone)}">
💬 Text
</a>

${
job.recording
?
`
<a class="btn orange" href="${safe(job.recording)}">
🎧 Recording
</a>
`
:
`
<a class="btn orange" href="#">
🎧 Recording
</a>
`
}

<a class="btn green" href="#">
✅ Complete
</a>

</div>

</div>

`;

}

// ===============================
// DASHBOARD
// ===============================

app.get("/admin", requireAdmin, async(req,res)=>{

const leads = await getLeads();

const revenue =
leads.reduce((s,l)=>
s + Number(l.job_amount || 0),0);

res.send(`

<html>

<head>

<meta
name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
NLN Admin Dashboard
</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
-webkit-tap-highlight-color:transparent;
}

body{
font-family:Inter,Arial;
background:
linear-gradient(
180deg,
#020617,
#03142b
);
color:white;
overflow-x:hidden;
}

.app{
display:flex;
min-height:100vh;
}

/* ===============================
SIDEBAR
=============================== */

.sidebar{
width:250px;
background:
rgba(4,12,25,.98);
border-right:
1px solid rgba(255,255,255,.05);
padding:24px;
position:fixed;
left:0;
top:0;
bottom:0;
overflow:auto;
}

.logo{
font-size:42px;
font-weight:900;
margin-bottom:40px;
}

.logo small{
display:block;
font-size:12px;
opacity:.7;
margin-top:4px;
}

.nav-title{
font-size:12px;
opacity:.5;
margin-top:22px;
margin-bottom:12px;
letter-spacing:1px;
}

.nav a{
display:flex;
align-items:center;
gap:12px;
padding:14px;
margin-bottom:8px;
border-radius:14px;
text-decoration:none;
color:white;
font-weight:700;
}

.nav a.active{
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
}

/* ===============================
MAIN
=============================== */

.main{
margin-left:250px;
width:calc(100% - 250px);
padding:24px;
}

/* ===============================
TOPBAR
=============================== */

.topbar{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:24px;
}

.topbar h1{
font-size:34px;
font-weight:900;
}

.top-icons{
display:flex;
align-items:center;
gap:18px;
}

.avatar{
width:48px;
height:48px;
border-radius:50%;
background:
linear-gradient(
135deg,
#2563eb,
#14b8a6
);
display:flex;
align-items:center;
justify-content:center;
font-weight:900;
}

/* ===============================
STATS
=============================== */

.stats{
display:grid;
grid-template-columns:
repeat(4,1fr);
gap:16px;
margin-bottom:20px;
}

.stat-card{
background:
rgba(6,18,38,.92);
border:
1px solid rgba(255,255,255,.06);
border-radius:22px;
padding:24px;
}

.stat-card h2{
font-size:38px;
margin-bottom:8px;
}

.stat-card p{
opacity:.75;
}

/* ===============================
TOOLS GRID
=============================== */

.tools-grid{
display:grid;
grid-template-columns:
repeat(4,1fr);
gap:16px;
margin-bottom:20px;
}

.tool-card{
background:
rgba(6,18,38,.92);
border-radius:22px;
height:130px;
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
font-weight:800;
font-size:20px;
border:
1px solid rgba(255,255,255,.06);
}

.tool-card span{
font-size:40px;
margin-bottom:10px;
}

/* ===============================
PANELS
=============================== */

.two-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:20px;
margin-bottom:20px;
}

.panel{
background:
rgba(6,18,38,.92);
border-radius:24px;
padding:22px;
border:
1px solid rgba(255,255,255,.06);
}

.panel-title{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:18px;
}

.panel-title h2{
font-size:28px;
}

/* ===============================
GRAPH
=============================== */

.graph{
height:240px;
border-radius:20px;
background:
linear-gradient(
180deg,
rgba(124,58,237,.1),
rgba(37,99,235,.35)
);
position:relative;
overflow:hidden;
}

.graph::after{
content:"";
position:absolute;
left:0;
right:0;
bottom:0;
height:75%;
background:
linear-gradient(
135deg,
#7c3aed,
#2563eb
);
clip-path:
polygon(
0 100%,
0 80%,
12% 65%,
25% 70%,
38% 50%,
52% 55%,
70% 25%,
85% 28%,
100% 0,
100% 100%
);
}

/* ===============================
PAYMENT
=============================== */

.payment{
font-size:54px;
font-weight:900;
color:#22c55e;
margin-top:12px;
}

.progress{
height:14px;
border-radius:999px;
background:#102544;
margin-top:20px;
overflow:hidden;
}

.progress-fill{
height:100%;
width:80%;
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
}

.pay-btn{
margin-top:24px;
width:100%;
height:62px;
border:none;
border-radius:18px;
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
color:white;
font-size:22px;
font-weight:900;
}

/* ===============================
JOBS
=============================== */

.jobs-panel{
background:
rgba(6,18,38,.92);
border-radius:24px;
padding:22px;
border:
1px solid rgba(255,255,255,.06);
}

.job-card{
background:#07111f;
border-radius:20px;
padding:18px;
margin-top:16px;
border:
1px solid rgba(255,255,255,.05);
}

.job-top{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:14px;
}

.badge{
padding:8px 14px;
border-radius:12px;
font-size:12px;
font-weight:900;
}

.badge.new{
background:#2563eb;
}

.badge.assigned{
background:#ea580c;
}

.badge.completed{
background:#16a34a;
}

.price{
font-size:22px;
font-weight:900;
}

.job-service{
font-size:28px;
font-weight:800;
margin-bottom:8px;
}

.job-customer{
opacity:.75;
font-size:17px;
margin-bottom:18px;
}

.job-buttons{
display:grid;
grid-template-columns:1fr 1fr;
gap:12px;
}

.btn{
height:54px;
border-radius:16px;
display:flex;
align-items:center;
justify-content:center;
font-weight:900;
text-decoration:none;
color:white;
font-size:18px;
}

.blue{
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
}

.purple{
background:
linear-gradient(
90deg,
#9333ea,
#c026d3
);
}

.orange{
background:
linear-gradient(
90deg,
#ea580c,
#f97316
);
}

.green{
background:
linear-gradient(
90deg,
#16a34a,
#22c55e
);
}

/* ===============================
BOTTOM NAV MOBILE
=============================== */

.mobile-nav{
display:none;
}

/* ===============================
MOBILE
=============================== */

@media(max-width:900px){

.sidebar{
display:none;
}

.main{
margin-left:0;
width:100%;
padding:14px;
padding-bottom:120px;
}

.topbar h1{
font-size:22px;
}

.stats{
grid-template-columns:1fr 1fr;
gap:12px;
}

.stat-card{
padding:18px;
border-radius:18px;
}

.stat-card h2{
font-size:32px;
}

.tools-grid{
grid-template-columns:1fr 1fr;
gap:12px;
}

.tool-card{
height:110px;
font-size:16px;
border-radius:18px;
}

.tool-card span{
font-size:30px;
}

.two-grid{
grid-template-columns:1fr;
gap:14px;
}

.panel{
border-radius:18px;
padding:18px;
}

.panel-title h2{
font-size:22px;
}

.graph{
height:180px;
}

.payment{
font-size:42px;
}

.jobs-panel{
padding:16px;
border-radius:18px;
}

.job-service{
font-size:22px;
}

.job-buttons{
grid-template-columns:1fr 1fr;
}

.btn{
height:48px;
font-size:15px;
}

.mobile-nav{
position:fixed;
left:12px;
right:12px;
bottom:12px;
height:82px;
background:
rgba(6,18,38,.96);
border-radius:26px;
display:flex;
align-items:center;
justify-content:space-around;
backdrop-filter:blur(18px);
border:
1px solid rgba(255,255,255,.06);
z-index:999;
}

.mobile-nav a{
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-decoration:none;
color:white;
font-size:13px;
font-weight:700;
gap:6px;
}

.mobile-nav span{
font-size:24px;
}

}

</style>

</head>

<body>

<div class="app">

<!-- SIDEBAR -->

<div class="sidebar">

<div class="logo">

NLN

<small>
CITYWIDE ROUTING
</small>

</div>

<div class="nav-title">
DASHBOARD
</div>

<div class="nav">

<a class="active" href="#">
📊 Overview
</a>

<a href="#">
💼 All Jobs
</a>

<a href="#">
👥 Providers
</a>

<a href="#">
📍 Route Map
</a>

<a href="#">
🔔 Notifications
</a>

</div>

<div class="nav-title">
SYSTEM
</div>

<div class="nav">

<a href="#">
⚙️ Settings
</a>

<a href="#">
📈 Reports
</a>

<a href="#">
🤖 AI Dispatcher
</a>

</div>

</div>

<!-- MAIN -->

<div class="main">

<div class="topbar">

<h1>
Welcome back, Admin!
</h1>

<div class="top-icons">

<div>
💬
</div>

<div>
🔔
</div>

<div class="avatar">
A
</div>

</div>

</div>

<!-- STATS -->

<div class="stats">

<div class="stat-card">
<h2>${leads.length}</h2>
<p>Total Jobs</p>
</div>

<div class="stat-card">
<h2>${money(revenue)}</h2>
<p>Total Revenue</p>
</div>

<div class="stat-card">
<h2>${Object.keys(providers).length}</h2>
<p>Providers</p>
</div>

<div class="stat-card">
<h2>4.9⭐</h2>
<p>Rating</p>
</div>

</div>

<!-- TOOLS -->

<div class="tools-grid">

<div class="tool-card">
<span>➕</span>
Add Job
</div>

<div class="tool-card">
<span>👥</span>
Providers
</div>

<div class="tool-card">
<span>💼</span>
Jobs
</div>

<div class="tool-card">
<span>🤖</span>
AI Dispatcher
</div>

<div class="tool-card">
<span>📈</span>
Reports
</div>

<div class="tool-card">
<span>⚙️</span>
Settings
</div>

<div class="tool-card">
<span>🎧</span>
Support
</div>

<div class="tool-card">
<span>💳</span>
Payments
</div>

</div>

<!-- GRAPH + PAYMENT -->

<div class="two-grid">

<div class="panel">

<div class="panel-title">

<h2>
Jobs Overview
</h2>

<div>
This Week
</div>

</div>

<div class="graph"></div>

</div>

<div class="panel">

<h2>
Payment Threshold
</h2>

<div class="payment">
$0.00
</div>

<p style="margin-top:8px">
No balance due
</p>

<div class="progress">
<div class="progress-fill"></div>
</div>

<p style="margin-top:20px;line-height:1.5">
Your entire $10,000 payment threshold is available.
</p>

<button class="pay-btn">
MAKE A PAYMENT
</button>

</div>

</div>

<!-- JOBS -->

<div class="jobs-panel">

<div class="panel-title">

<h2>
Recent Jobs
</h2>

<div>
View All
</div>

</div>

${leads.map(jobCard).join("")}

</div>

</div>

</div>

<!-- MOBILE NAV -->

<div class="mobile-nav">

<a href="#">
<span>💼</span>
Jobs
</a>

<a href="#">
<span>⬜</span>
Tools
</a>

<a href="#">
<span>💲</span>
Pay
</a>

<a href="javascript:location.reload()">
<span>🔄</span>
Refresh
</a>

</div>

</body>

</html>

`);

});

// ===============================
// START
// ===============================

initDB().then(()=>{

app.listen(PORT,()=>{

console.log(
"NLN LUXURY DASHBOARD RUNNING"
);

});

});
