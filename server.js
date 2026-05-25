// =====================================================
// NLN LUXURY DISPATCH SYSTEM
// FULL PREMIUM SERVER.JS
// CITYWIDE ROUTING
// =====================================================

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

// =====================================================
// DATABASE
// =====================================================

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: {
rejectUnauthorized: false
}
});

// =====================================================
// PROVIDERS
// =====================================================

const providers = {
Max: "+14436792242",
Dreh: "+12024125443",
Tee: "+14104199281",
Robyn: "+14435781686"
};

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.send("NLN SERVER RUNNING");
});

// =====================================================
// INIT DATABASE
// =====================================================

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

// =====================================================
// LOGIN
// =====================================================

app.get("/provider-login", (req, res) => {

res.send(`
<html>
<head>
<title>Provider Login</title>

<style>

body{
background:#020617;
color:white;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
margin:0;
}

.box{
width:340px;
background:#071226;
padding:40px;
border-radius:25px;
box-shadow:0 0 40px rgba(0,0,0,.5);
}

input{
width:100%;
padding:16px;
margin-top:15px;
border-radius:14px;
border:none;
background:#0f172a;
color:white;
font-size:18px;
}

button{
width:100%;
padding:16px;
margin-top:20px;
border:none;
border-radius:14px;
background:linear-gradient(90deg,#2563eb,#7c3aed);
color:white;
font-size:18px;
font-weight:bold;
}

</style>
</head>

<body>

<div class="box">

<h1>Provider Login</h1>

<form action="/provider-auth" method="POST">

<input name="provider" placeholder="Provider Name">

<input name="pin" placeholder="4 Digit Code">

<button>Login</button>

</form>

</div>

</body>
</html>
`);

});

// =====================================================
// PROVIDER AUTH
// =====================================================

app.post("/provider-auth", (req, res) => {

const provider = req.body.provider;
const pin = req.body.pin;

const phone = providers[provider];

if(!phone){
return res.send("Provider not found");
}

const last4 = phone.slice(-4);

if(pin !== last4){
return res.send("Wrong code");
}

res.redirect(`/provider/${provider}`);

});

// =====================================================
// ADMIN DASHBOARD
// =====================================================

app.get("/admin", async(req, res) => {

const token = req.query.token;

if(token !== ADMIN_TOKEN){
return res.send("Access denied");
}

const result = await pool.query(`
SELECT * FROM leads
ORDER BY id DESC
`);

const leads = result.rows;

let revenue = 0;

leads.forEach(l => {
revenue += Number(l.job_amount || 0);
});

const cards = leads.map(l => `

<div class="job-card">

<div class="status">${l.lead_status}</div>

<h2>${l.service || "Locksmith Service"}</h2>

<p>${l.customer_name || "Unknown Customer"}</p>

<p>${l.customer_phone || "No Phone"}</p>

<p>$${l.job_amount}</p>

<div class="buttons">

<a href="tel:${l.customer_phone}">
<button class="call">Call</button>
</a>

<a href="sms:${l.customer_phone}">
<button class="text">Text</button>
</a>

<button class="green">Accept</button>

<button class="red">Decline</button>

<button class="purple">Recording</button>

</div>

</div>

`).join("");

res.send(`

<html>

<head>

<title>Admin Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
background:#020617;
color:white;
font-family:Arial;
}

.top{
display:flex;
justify-content:space-between;
align-items:center;
padding:24px;
}

.title{
font-size:42px;
font-weight:bold;
}

.stats{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:20px;
padding:20px;
}

.stat{
background:#071226;
padding:30px;
border-radius:24px;
}

.stat h1{
margin:0;
font-size:44px;
}

.grid{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:24px;
padding:24px;
}

.job-card{
background:#071226;
border-radius:24px;
padding:24px;
border:1px solid rgba(255,255,255,.08);
}

.status{
display:inline-block;
background:#2563eb;
padding:8px 14px;
border-radius:12px;
font-size:12px;
margin-bottom:14px;
}

.buttons{
display:grid;
grid-template-columns:repeat(2,1fr);
gap:12px;
margin-top:20px;
}

button{
border:none;
padding:14px;
border-radius:14px;
color:white;
font-weight:bold;
cursor:pointer;
}

.call{
background:#2563eb;
}

.text{
background:#7c3aed;
}

.green{
background:#16a34a;
}

.red{
background:#dc2626;
}

.purple{
background:#9333ea;
}

.add-job{
background:#071226;
margin:24px;
padding:24px;
border-radius:24px;
}

input,select{
width:100%;
padding:16px;
margin-top:14px;
border:none;
border-radius:14px;
background:#0f172a;
color:white;
}

.submit{
width:100%;
background:linear-gradient(90deg,#2563eb,#7c3aed);
margin-top:20px;
}

@media(max-width:900px){

.stats{
grid-template-columns:repeat(2,1fr);
}

.grid{
grid-template-columns:1fr;
}

.title{
font-size:28px;
}

}

</style>

</head>

<body>

<div class="top">

<div class="title">
Admin Dashboard
</div>

<div>
Online
</div>

</div>

<div class="stats">

<div class="stat">
<h1>${leads.length}</h1>
<p>Total Jobs</p>
</div>

<div class="stat">
<h1>$${revenue}</h1>
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

<div class="add-job">

<h2>Add Job</h2>

<form action="/add-job" method="POST">

<input name="customer_name" placeholder="Customer Name">

<input name="customer_phone" placeholder="Customer Phone">

<input name="service" placeholder="Service">

<input name="job_amount" placeholder="Job Amount">

<select name="provider_assigned">

<option value="">Assign Provider</option>

${Object.keys(providers).map(p => `
<option value="${p}">
${p}
</option>
`).join("")}

</select>

<button class="submit">
Create Job
</button>

</form>

</div>

<div class="grid">

${cards}

</div>

</body>

</html>

`);

});

// =====================================================
// ADD JOB
// =====================================================

app.post("/add-job", async(req, res) => {

await pool.query(`
INSERT INTO leads (
customer_name,
customer_phone,
service,
provider_assigned,
job_amount
)
VALUES ($1,$2,$3,$4,$5)
`,[
req.body.customer_name,
req.body.customer_phone,
req.body.service,
req.body.provider_assigned,
req.body.job_amount
]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);

});

// =====================================================
// PROVIDER DASHBOARD
// =====================================================

app.get("/provider/:name", async(req, res) => {

const provider = req.params.name;

const result = await pool.query(`
SELECT * FROM leads
WHERE provider_assigned=$1
ORDER BY id DESC
`,[provider]);

const leads = result.rows;

let earnings = 0;

leads.forEach(l => {
earnings += Number(l.job_amount || 0);
});

const cards = leads.map(l => `

<div class="job">

<div class="status">${l.lead_status}</div>

<h2>${l.service}</h2>

<p>${l.customer_name}</p>

<p>${l.customer_phone}</p>

<p>$${l.job_amount}</p>

<div class="actions">

<a href="tel:${l.customer_phone}">
<button class="blue">Call</button>
</a>

<a href="sms:${l.customer_phone}">
<button class="purple">Text</button>
</a>

<button class="green">Navigate</button>

<button class="orange">Complete</button>

</div>

</div>

`).join("");

res.send(`

<html>

<head>

<title>Provider Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<style>

body{
margin:0;
background:#020617;
color:white;
font-family:Arial;
}

.hero{
padding:30px;
}

.hero h1{
font-size:44px;
}

.stats{
display:grid;
grid-template-columns:repeat(3,1fr);
gap:20px;
padding:20px;
}

.card{
background:#071226;
padding:24px;
border-radius:24px;
}

.card h1{
font-size:40px;
}

.jobs{
display:grid;
grid-template-columns:repeat(2,1fr);
gap:20px;
padding:20px;
}

.job{
background:#071226;
padding:24px;
border-radius:24px;
}

.status{
display:inline-block;
background:#2563eb;
padding:8px 12px;
border-radius:12px;
margin-bottom:10px;
}

.actions{
display:grid;
grid-template-columns:repeat(2,1fr);
gap:12px;
margin-top:20px;
}

button{
border:none;
padding:14px;
border-radius:14px;
color:white;
font-weight:bold;
}

.blue{
background:#2563eb;
}

.purple{
background:#7c3aed;
}

.green{
background:#16a34a;
}

.orange{
background:#ea580c;
}

@media(max-width:900px){

.stats{
grid-template-columns:1fr;
}

.jobs{
grid-template-columns:1fr;
}

}

</style>

</head>

<body>

<div class="hero">

<h1>
Welcome back, ${provider}
</h1>

<p>
Provider Dashboard
</p>

</div>

<div class="stats">

<div class="card">
<h1>${leads.length}</h1>
<p>Total Jobs</p>
</div>

<div class="card">
<h1>$${earnings}</h1>
<p>Earnings</p>
</div>

<div class="card">
<h1>4.9⭐</h1>
<p>Rating</p>
</div>

</div>

<div class="jobs">

${cards}

</div>

</body>

</html>

`);

});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
console.log("NLN SERVER RUNNING");
});
