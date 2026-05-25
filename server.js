// NLN LUXURY EXACT MOBILE DASHBOARD
// TOWBOOK STYLE
// FULL IOS VERSION

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

const pool = new Pool({
connectionString:process.env.DATABASE_URL,
ssl:{ rejectUnauthorized:false }
});

const providers = {
"Max":"+14436792242",
"Dreh":"+12024125443",
"Tee":"+14104199281",
"Robyn":"+14435781686"
};

async function initDB(){

await pool.query(`
CREATE TABLE IF NOT EXISTS leads(
id SERIAL PRIMARY KEY,
customer_name TEXT,
customer_phone TEXT,
service TEXT,
source TEXT,
provider_assigned TEXT,
recording TEXT,
lead_status TEXT DEFAULT 'new',
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

}

function safe(v){
return String(v || "");
}

function money(v){
return "$" + Number(v || 0).toLocaleString();
}

async function getLeads(){

const r = await pool.query(`
SELECT *
FROM leads
ORDER BY id DESC
`);

return r.rows;

}

function requireAdmin(req,res,next){

const token =
req.query.token ||
req.headers["x-admin-token"];

if(token !== ADMIN_TOKEN){
return res.send("Admin Locked");
}

next();

}

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

function renderJob(job){

return `

<div class="job-card">

<div class="job-top">

<span class="badge ${job.lead_status}">
${safe(job.lead_status || "NEW")}
</span>

<span class="price">
${money(job.job_amount)}
</span>

</div>

<h3>
${safe(job.service)}
</h3>

<p>
${safe(job.customer_name)}
</p>

<p>
${safe(job.customer_phone)}
</p>

<div class="job-actions">

<a
class="btn blue"
href="tel:${safe(job.customer_phone)}">

Call

</a>

<a
class="btn purple"
href="sms:${safe(job.customer_phone)}">

Text

</a>

${
job.recording
?
`
<a
class="btn orange"
href="${safe(job.recording)}">

Recording

</a>
`
:
""
}

<a
class="btn green"
href="#">

Complete

</a>

</div>

</div>

`;

}

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

<style>

*{
box-sizing:border-box;
-webkit-tap-highlight-color:transparent;
}

body{
margin:0;
font-family:Inter,Arial;
background:
linear-gradient(
180deg,
#020817,
#04152e
);
color:white;
}

.main{
padding:18px;
padding-bottom:120px;
}

.topbar{
display:flex;
align-items:center;
justify-content:space-between;
margin-bottom:18px;
}

.top-left{
display:flex;
align-items:center;
gap:14px;
}

.menu{
font-size:34px;
}

.title{
font-size:34px;
font-weight:900;
}

.top-right{
display:flex;
align-items:center;
gap:14px;
}

.avatar{
width:54px;
height:54px;
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
font-size:24px;
}

.cards{
display:grid;
grid-template-columns:1fr 1fr;
gap:14px;
margin-top:18px;
}

.card{
background:
rgba(7,20,39,.95);
border-radius:26px;
padding:22px;
border:
1px solid rgba(255,255,255,.06);
box-shadow:
0 0 25px rgba(0,0,0,.25);
}

.card h1{
font-size:52px;
margin:0;
}

.card p{
opacity:.75;
font-size:18px;
margin-top:12px;
}

.icon-grid{
display:grid;
grid-template-columns:1fr 1fr;
gap:14px;
margin-top:18px;
}

.icon-card{
height:150px;
background:
rgba(7,20,39,.95);
border-radius:26px;
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
font-size:22px;
font-weight:800;
border:
1px solid rgba(255,255,255,.06);
}

.icon-card span{
font-size:44px;
margin-bottom:12px;
}

.panel{
margin-top:20px;
background:
rgba(7,20,39,.95);
border-radius:28px;
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
margin:0;
font-size:32px;
}

.chart{
height:220px;
border-radius:22px;
background:
linear-gradient(
180deg,
rgba(124,58,237,.15),
rgba(37,99,235,.4)
);
position:relative;
overflow:hidden;
}

.chart::after{
content:"";
position:absolute;
left:0;
right:0;
bottom:0;
height:70%;
background:
linear-gradient(
135deg,
#7c3aed,
#2563eb
);
clip-path:
polygon(
0 100%,
0 70%,
18% 50%,
34% 56%,
48% 34%,
62% 38%,
78% 18%,
100% 0,
100% 100%
);
}

.payment-amount{
font-size:62px;
font-weight:900;
color:#22c55e;
margin-top:10px;
}

.bar{
height:16px;
border-radius:999px;
background:#102544;
overflow:hidden;
margin-top:18px;
}

.fill{
height:100%;
width:82%;
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
}

.payment-btn{
margin-top:24px;
height:68px;
border:none;
border-radius:22px;
background:
linear-gradient(
90deg,
#2563eb,
#3b82f6
);
color:white;
font-size:24px;
font-weight:900;
width:100%;
}

.job-card{
background:#07111f;
border-radius:24px;
padding:18px;
margin-top:18px;
border:
1px solid rgba(255,255,255,.05);
}

.job-top{
display:flex;
justify-content:space-between;
align-items:center;
}

.badge{
padding:10px 18px;
border-radius:14px;
font-size:14px;
font-weight:900;
text-transform:uppercase;
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

.job-card h3{
font-size:34px;
margin-top:16px;
margin-bottom:10px;
}

.job-card p{
opacity:.8;
font-size:18px;
line-height:1.4;
}

.job-actions{
display:grid;
grid-template-columns:1fr 1fr;
gap:12px;
margin-top:18px;
}

.btn{
height:58px;
border-radius:18px;
display:flex;
align-items:center;
justify-content:center;
text-decoration:none;
font-weight:900;
font-size:20px;
color:white;
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

.green{
background:
linear-gradient(
90deg,
#16a34a,
#22c55e
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

.bottom-nav{
position:fixed;
left:14px;
right:14px;
bottom:12px;
height:92px;
background:
rgba(7,20,39,.97);
border-radius:30px;
display:flex;
align-items:center;
justify-content:space-around;
backdrop-filter:blur(18px);
border:
1px solid rgba(255,255,255,.08);
z-index:999;
}

.bottom-nav a{
display:flex;
flex-direction:column;
align-items:center;
justify-content:center;
text-decoration:none;
color:white;
font-size:18px;
font-weight:700;
gap:6px;
}

.bottom-nav span{
font-size:28px;
}

@media(min-width:900px){

.main{
max-width:1600px;
margin:auto;
}

.cards{
grid-template-columns:
repeat(4,1fr);
}

.icon-grid{
grid-template-columns:
repeat(4,1fr);
}

.desktop-two{
display:grid;
grid-template-columns:1fr 1fr;
gap:20px;
}

}

</style>

</head>

<body>

<div class="main">

<div class="topbar">

<div class="top-left">

<div class="menu">
☰
</div>

<div class="title">
Admin Dashboard
</div>

</div>

<div class="top-right">

<div style="font-size:28px">
💬
</div>

<div style="font-size:28px">
🔔
</div>

<div class="avatar">
A
</div>

</div>

</div>

<div class="cards">

<div class="card">
<h1>${leads.length}</h1>
<p>Total Jobs</p>
</div>

<div class="card">
<h1>${money(revenue)}</h1>
<p>Total Revenue</p>
</div>

<div class="card">
<h1>${Object.keys(providers).length}</h1>
<p>Providers</p>
</div>

<div class="card">
<h1>4.9⭐</h1>
<p>Rating</p>
</div>

</div>

<div class="icon-grid">

<div class="icon-card">
<span>➕</span>
Add Job
</div>

<div class="icon-card">
<span>👥</span>
Providers
</div>

<div class="icon-card">
<span>💼</span>
Jobs
</div>

<div class="icon-card">
<span>🤖</span>
AI Dispatcher
</div>

<div class="icon-card">
<span>📊</span>
Reports
</div>

<div class="icon-card">
<span>⚙️</span>
Settings
</div>

<div class="icon-card">
<span>🎧</span>
Support
</div>

<div class="icon-card">
<span>💳</span>
Payments
</div>

</div>

<div class="desktop-two">

<div class="panel">

<div class="panel-title">

<h2>
Jobs Overview
</h2>

<div>
This Week
</div>

</div>

<div class="chart"></div>

</div>

<div class="panel">

<h2>
Payment Threshold
</h2>

<div class="payment-amount">
$0.00
</div>

<p>
No balance due
</p>

<div class="bar">
<div class="fill"></div>
</div>

<p style="margin-top:18px;font-size:18px;line-height:1.5">

Your entire $10,000 payment threshold is available.

</p>

<button class="payment-btn">

MAKE A PAYMENT

</button>

</div>

</div>

<div class="panel">

<div class="panel-title">

<h2>
Recent Jobs
</h2>

<div>
View All
</div>

</div>

${leads.map(renderJob).join("")}

</div>

</div>

<div class="bottom-nav">

<a href="/admin?token=${ADMIN_TOKEN}">
<span>💼</span>
Jobs
</a>

<a href="#tools">
<span>⬜</span>
Tools
</a>

<a href="#payments">
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

initDB().then(()=>{

app.listen(PORT,()=>{

console.log(
"NLN LUXURY DASHBOARD RUNNING"
);

});

});
