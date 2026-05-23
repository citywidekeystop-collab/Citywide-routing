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

const providers = {
"Max": "4436792242",
"Dreh": "2024125443",
"Tee": "4104199281",
"Robyn": "4435781686",
"Car Key Chris": "2232630824"
};

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
provider_assigned TEXT,
lead_status TEXT,
notes TEXT,
job_amount TEXT DEFAULT '0',
lead_cost TEXT DEFAULT '35',
provider_earnings TEXT DEFAULT '0',
nln_profit TEXT DEFAULT '35',
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

function page(title, content) {

return `
<!DOCTYPE html>
<html>
<head>

<title>${title}</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
background:#f4f8fb;
font-family:Arial;
color:#0f172a;
}

.wrap{
max-width:1200px;
margin:auto;
padding:18px;
padding-bottom:90px;
}

.top{
background:white;
border-radius:28px;
padding:24px;
box-shadow:0 12px 35px rgba(0,0,0,.08);
margin-bottom:20px;
}

.logo{
display:flex;
align-items:center;
gap:14px;
}

.logo-box{
width:72px;
height:72px;
border-radius:20px;
background:linear-gradient(135deg,#0b2a67,#06b6d4);
display:flex;
align-items:center;
justify-content:center;
color:white;
font-size:28px;
font-weight:bold;
}

.logo h1{
margin:0;
font-size:28px;
}

.logo p{
margin:4px 0 0;
color:#64748b;
font-weight:bold;
}

.stats{
display:grid;
grid-template-columns:repeat(4,1fr);
gap:14px;
margin-bottom:20px;
}

.stat{
background:white;
border-radius:22px;
padding:20px;
box-shadow:0 10px 25px rgba(0,0,0,.06);
}

.stat h2{
margin:0;
font-size:34px;
}

.stat p{
margin:6px 0 0;
color:#64748b;
font-weight:bold;
}

.card{
background:white;
border-radius:24px;
padding:22px;
margin-bottom:16px;
box-shadow:0 12px 30px rgba(0,0,0,.07);
}

.phone{
font-size:24px;
font-weight:bold;
}

.info{
margin-top:12px;
line-height:1.8;
color:#334155;
font-weight:600;
}

.row{
display:flex;
flex-wrap:wrap;
gap:8px;
margin-top:14px;
}

button,a.btn{
border:none;
border-radius:12px;
padding:12px 14px;
font-weight:bold;
cursor:pointer;
text-decoration:none;
display:inline-block;
}

.accept{background:#22c55e;color:white;}
.booked{background:#8b5cf6;color:white;}
.paid{background:#f59e0b;color:black;}
.complete{background:#0ea5e9;color:white;}
.archive{background:#64748b;color:white;}
.delete{background:#ef4444;color:white;}
.text{background:#06b6d4;color:white;}
.call{background:#16a34a;color:white;}
.save{background:#2563eb;color:white;}

select,input,textarea{
width:100%;
padding:12px;
border-radius:12px;
border:1px solid #cbd5e1;
margin-top:10px;
font-size:16px;
}

textarea{
min-height:80px;
}

.bottom{
position:fixed;
left:0;
right:0;
bottom:0;
background:white;
border-top:1px solid #e2e8f0;
display:flex;
justify-content:space-around;
padding:10px;
}

.bottom a{
text-decoration:none;
color:#334155;
font-weight:bold;
text-align:center;
}

@media(max-width:800px){

.stats{
grid-template-columns:repeat(2,1fr);
}

button,a.btn{
width:48%;
text-align:center;
}

}

</style>

</head>

<body>

${content}

<div class="bottom">
<a href="/">🏠<br>Admin</a>
<a href="/providers">👷<br>Providers</a>
<a href="/calls">☎️<br>Calls</a>
<a href="/settings">⚙️<br>Settings</a>
</div>

</body>
</html>
`;

}

async function getLeads() {

const result = await pool.query(`
SELECT *
FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

return result.rows;

}

app.get("/health",(req,res)=>{

res.json({
success:true,
status:"online"
});

});

app.post("/lead/new", async (req,res)=>{

try{

const body = req.body;

await pool.query(`
INSERT INTO leads (
customer_phone,
tracking_number,
source,
service,
duration,
recording,
lead_score,
provider_assigned,
lead_status
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
`,[
body.customer_phone_number ||
body.callernum ||
"Unknown",

body.trackingnum ||
"",

body.source ||
"CallRail",

body.tag ||
body.keyword ||
"Locksmith Service",

body.duration ||
"0",

body.recording ||
"",

body.score ||
"92",

"Unassigned",

"New"
]);

console.log("✅ LEAD SAVED");

res.json({
success:true
});

}catch(err){

console.log(err);

res.status(500).json({
success:false
});

}

});

app.post("/lead/test", async (req,res)=>{

await pool.query(`
INSERT INTO leads (
customer_phone,
source,
service,
lead_score,
provider_assigned,
lead_status,
job_amount,
provider_earnings
)
VALUES (
'443-555-0100',
'Test Lead',
'Emergency Lockout',
'92',
'Robyn',
'New',
'250',
'215'
)
`);

res.json({
success:true
});

});

app.get("/admin/leads", async (req,res)=>{

const leads = await getLeads();

res.json({
success:true,
leads
});

});

app.post("/lead/:id/status", async (req,res)=>{

await pool.query(
`
UPDATE leads
SET lead_status=$1
WHERE id=$2
`,
[
req.body.status,
req.params.id
]
);

res.json({
success:true
});

});

app.post("/lead/:id/provider", async (req,res)=>{

await pool.query(
`
UPDATE leads
SET provider_assigned=$1
WHERE id=$2
`,
[
req.body.provider,
req.params.id
]
);

res.json({
success:true
});

});

app.post("/lead/:id/pricing", async (req,res)=>{

const jobAmount =
Number(req.body.job_amount || 0);

const leadCost =
Number(req.body.lead_cost || 0);

const providerEarnings =
jobAmount - leadCost;

await pool.query(
`
UPDATE leads
SET
job_amount=$1,
lead_cost=$2,
provider_earnings=$3,
nln_profit=$2
WHERE id=$4
`,
[
jobAmount,
leadCost,
providerEarnings,
req.params.id
]
);

res.json({
success:true
});

});

app.post("/lead/:id/archive", async (req,res)=>{

await pool.query(
`
UPDATE leads
SET archived=true
WHERE id=$1
`,
[req.params.id]
);

res.json({
success:true
});

});

app.delete("/lead/:id", async (req,res)=>{

await pool.query(
`
DELETE FROM leads
WHERE id=$1
`,
[req.params.id]
);

res.json({
success:true
});

});

app.get("/", async (req,res)=>{

const leads = await getLeads();

const totalRevenue =
leads.reduce((a,b)=>
a + Number(b.nln_profit || 0),0
);

res.send(page("Admin Dashboard",`

<div class="wrap">

<div class="top">

<div class="logo">
<div class="logo-box">NL</div>

<div>
<h1>Nationwide Leads Network</h1>
<p>Admin Dispatch Dashboard</p>
</div>
</div>

</div>

<div class="stats">

<div class="stat">
<h2>${leads.length}</h2>
<p>Total Leads</p>
</div>

<div class="stat">
<h2>$${totalRevenue}</h2>
<p>NLN Profit</p>
</div>

<div class="stat">
<h2>${leads.filter(x=>x.lead_status==="Completed").length}</h2>
<p>Completed</p>
</div>

<div class="stat">
<h2>${Object.keys(providers).length}</h2>
<p>Providers</p>
</div>

</div>

<button class="save" onclick="createTestLead()">
Create Test Lead
</button>

<br><br>

${leads.map(lead=>{

const customer =
String(lead.customer_phone || "")
.replace(/[^0-9]/g,'');

const assigned =
lead.provider_assigned || "Unassigned";

const providerPhone =
providers[assigned] || "";

const sms =
"sms:" + providerPhone +
"?body=" +
encodeURIComponent(
"NEW LOCKSMITH JOB\\n\\n" +
"Customer: " + lead.customer_phone +
"\\n\\nService: " + lead.service +
"\\n\\nJob Amount: $" + lead.job_amount +
"\\n\\nCall customer ASAP."
);

return `
<div class="card">

<div class="phone">
📞 ${lead.customer_phone}
</div>

<div class="info">

<strong>Service:</strong>
${lead.service}<br>

<strong>Provider:</strong>
${assigned}<br>

<strong>Status:</strong>
${lead.lead_status}<br>

<strong>Lead Score:</strong>
${lead.lead_score}<br>

<strong>Job Amount:</strong>
$${lead.job_amount}<br>

<strong>Lead Cost:</strong>
$${lead.lead_cost}<br>

<strong>Provider Earnings:</strong>
$${lead.provider_earnings}<br>

<strong>NLN Profit:</strong>
$${lead.nln_profit}

</div>

<select onchange="assignProvider(${lead.id},this.value)">

<option>
Unassigned
</option>

${Object.keys(providers).map(p=>`
<option
${assigned===p?'selected':''}
>
${p}
</option>
`).join('')}

</select>

<input
id="job-${lead.id}"
value="${lead.job_amount}"
placeholder="Job Amount"
>

<input
id="cost-${lead.id}"
value="${lead.lead_cost}"
placeholder="Lead Cost"
>

<button
class="save"
onclick="savePricing(${lead.id})"
>
Save Pricing
</button>

<div class="row">

<a
class="btn call"
href="tel:${customer}"
>
Call Customer
</a>

<a
class="btn text"
href="${sms}"
>
Send Job
</a>

</div>

<div class="row">

<button
class="accept"
onclick="updateStatus(${lead.id},'Accepted')"
>
Accept
</button>

<button
class="booked"
onclick="updateStatus(${lead.id},'On The Way')"
>
On The Way
</button>

<button
class="complete"
onclick="updateStatus(${lead.id},'Completed')"
>
Complete
</button>

<button
class="paid"
onclick="updateStatus(${lead.id},'Paid')"
>
Paid
</button>

</div>

</div>
`;

}).join('')}

</div>

<script>

async function createTestLead(){

await fetch('/lead/test',{
method:'POST'
});

location.reload();

}

async function updateStatus(id,status){

await fetch('/lead/' + id + '/status',{

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

async function assignProvider(id,provider){

await fetch('/lead/' + id + '/provider',{

method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({
provider
})

});

}

async function savePricing(id){

const job_amount =
document.getElementById(
'job-' + id
).value;

const lead_cost =
document.getElementById(
'cost-' + id
).value;

await fetch('/lead/' + id + '/pricing',{

method:'POST',

headers:{
'Content-Type':'application/json'
},

body:JSON.stringify({
job_amount,
lead_cost
})

});

location.reload();

}

</script>

`));

});

app.get("/provider/:name", async (req,res)=>{

const provider =
req.params.name;

const result = await pool.query(
`
SELECT *
FROM leads
WHERE provider_assigned=$1
ORDER BY created_at DESC
`,
[provider]
);

const leads = result.rows;

const total =
leads.reduce((a,b)=>
a + Number(
b.provider_earnings || 0
),0
);

res.send(page(provider + " Dashboard",`

<div class="wrap">

<div class="top">

<div class="logo">

<div class="logo-box">
${provider[0]}
</div>

<div>
<h1>${provider}</h1>
<p>Provider Dashboard</p>
</div>

</div>

</div>

<div class="stats">

<div class="stat">
<h2>${leads.length}</h2>
<p>Total Jobs</p>
</div>

<div class="stat">
<h2>$${total}</h2>
<p>Total Earnings</p>
</div>

<div class="stat">
<h2>${leads.filter(x=>x.lead_status==="Completed").length}</h2>
<p>Completed</p>
</div>

<div class="stat">
<h2>${leads.filter(x=>x.lead_status==="Paid").length}</h2>
<p>Paid</p>
</div>

</div>

${leads.map(lead=>{

const customer =
String(lead.customer_phone || "")
.replace(/[^0-9]/g,'');

return `
<div class="card">

<div class="phone">
📞 ${lead.customer_phone}
</div>

<div class="info">

<strong>Service:</strong>
${lead.service}<br>

<strong>Status:</strong>
${lead.lead_status}<br>

<strong>Job Amount:</strong>
$${lead.job_amount}<br>

<strong>Your Earnings:</strong>
$${lead.provider_earnings}

</div>

<div class="row">

<a
class="btn call"
href="tel:${customer}"
>
Call Customer
</a>

<button
class="accept"
onclick="updateStatus(${lead.id},'Accepted')"
>
Accept
</button>

<button
class="booked"
onclick="updateStatus(${lead.id},'On The Way')"
>
On The Way
</button>

<button
class="complete"
onclick="updateStatus(${lead.id},'Completed')"
>
Complete
</button>

<button
class="paid"
onclick="updateStatus(${lead.id},'Paid')"
>
Paid
</button>

</div>

</div>
`;

}).join('')}

</div>

<script>

async function updateStatus(id,status){

await fetch('/lead/' + id + '/status',{

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

</script>

`));

});

app.get("/providers",(req,res)=>{

res.send(page("Providers",`

<div class="wrap">

<div class="top">

<h1>Providers</h1>

<p>
Driver dashboards
</p>

</div>

${Object.keys(providers).map(name=>`

<div class="card">

<h2>${name}</h2>

<p>
${providers[name]}
</p>

<a
class="btn save"
href="/provider/${encodeURIComponent(name)}"
>
Open Dashboard
</a>

</div>

`).join('')}

</div>

`));

});

app.get("/calls",(req,res)=>{

res.redirect("/");

});

app.get("/settings",(req,res)=>{

res.send(page("Settings",`

<div class="wrap">

<div class="card">

<h2>Webhook</h2>

<p>
https://citywide-routing.onrender.com/lead/new
</p>

</div>

</div>

`));

});

const PORT =
process.env.PORT || 10000;

app.listen(PORT,()=>{

console.log(
"✅ Server running on port",
PORT
);

});
