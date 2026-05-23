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
rejectUnauthorized: false,
},
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
price TEXT,
notes TEXT,
archived BOOLEAN DEFAULT false,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`);

console.log("✅ DB ready");
} catch (err) {
console.error(err);
}
}

initDB();

function page(title, content) {
return `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>

body{
margin:0;
font-family:Arial;
background:#020617;
color:white;
}

.layout{
display:flex;
min-height:100vh;
}

.sidebar{
width:240px;
background:#0f172a;
padding:20px;
border-right:1px solid #1e293b;
}

.logo{
font-size:26px;
font-weight:bold;
margin-bottom:30px;
}

.nav a{
display:block;
padding:12px;
margin-bottom:10px;
border-radius:12px;
text-decoration:none;
color:#cbd5e1;
background:#111827;
}

.nav a:hover{
background:#2563eb;
}

.main{
flex:1;
padding:25px;
}

.top{
background:linear-gradient(135deg,#0f172a,#1d4ed8);
padding:25px;
border-radius:20px;
margin-bottom:20px;
}

.card{
background:#0f172a;
border:1px solid #1e293b;
border-radius:18px;
padding:20px;
margin-bottom:18px;
}

.stats{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
gap:15px;
margin-bottom:20px;
}

.stat{
background:#111827;
padding:20px;
border-radius:18px;
}

.stat h2{
margin:0;
color:#38bdf8;
}

button{
border:none;
padding:10px 14px;
border-radius:10px;
cursor:pointer;
font-weight:bold;
}

.accept{background:#16a34a;color:white;}
.booked{background:#7c3aed;color:white;}
.paid{background:#f59e0b;color:black;}
.archive{background:#475569;color:white;}
.delete{background:#dc2626;color:white;}

textarea{
width:100%;
margin-top:10px;
background:#020617;
color:white;
border:1px solid #334155;
border-radius:10px;
padding:10px;
}

select{
padding:10px;
border-radius:10px;
margin-top:10px;
}

</style>
</head>

<body>

<div class="layout">

<div class="sidebar">

<div class="logo">🔥 NLN</div>

<div class="nav">
<a href="/">Dashboard</a>
<a href="/providers">Providers</a>
<a href="/calls">Calls</a>
<a href="/settings">Settings</a>
<a href="/admin/leads" target="_blank">Raw Leads</a>
</div>

</div>

<div class="main">

${content}

</div>

</div>

</body>
</html>
`;
}

app.get("/", (req, res) => {
res.send(page("NLN Dashboard", `

<div class="top">
<h1>NLN Lead Dashboard</h1>

<button onclick="createLead()">
Create Test Lead
</button>

</div>

<div class="stats">

<div class="stat">
<h2 id="total">0</h2>
<p>Total Leads</p>
</div>

<div class="stat">
<h2 id="accepted">0</h2>
<p>Accepted</p>
</div>

<div class="stat">
<h2 id="booked">0</h2>
<p>Booked</p>
</div>

<div class="stat">
<h2 id="paid">0</h2>
<p>Paid</p>
</div>

</div>

<div id="leads"></div>

<script>

let leadsData = [];

async function loadLeads(){

const res = await fetch("/admin/leads");
const data = await res.json();

leadsData = data.leads;

document.getElementById("total").innerText =
leadsData.length;

document.getElementById("accepted").innerText =
leadsData.filter(x=>x.lead_status==="Accepted").length;

document.getElementById("booked").innerText =
leadsData.filter(x=>x.lead_status==="Booked").length;

document.getElementById("paid").innerText =
leadsData.filter(x=>x.lead_status==="Paid").length;

renderLeads();
}

function renderLeads(){

const wrap = document.getElementById("leads");

wrap.innerHTML = leadsData.map(lead => \`

<div class="card">

<h2>\${lead.customer_phone}</h2>

<p><strong>Service:</strong> \${lead.service}</p>
<p><strong>Status:</strong> \${lead.lead_status}</p>
<p><strong>Provider:</strong> \${lead.provider_assigned}</p>
<p><strong>Lead Score:</strong> \${lead.lead_score}</p>

<div style="margin-top:12px">

<button class="accept"
onclick="updateStatus(\${lead.id},'Accepted')">
Accept
</button>

<button class="booked"
onclick="updateStatus(\${lead.id},'Booked')">
Booked
</button>

<button class="paid"
onclick="updateStatus(\${lead.id},'Paid')">
Paid
</button>

<button class="archive"
onclick="archiveLead(\${lead.id})">
Archive
</button>

<button class="delete"
onclick="deleteLead(\${lead.id})">
Delete
</button>

</div>

<select onchange="assignProvider(\${lead.id},this.value)">

<option>Citywide Lock & Key</option>
<option>Provider A</option>
<option>Provider B</option>

</select>

<textarea id="notes-\${lead.id}">
\${lead.notes || ""}
</textarea>

<button onclick="saveNotes(\${lead.id})">
Save Notes
</button>

</div>

\`).join("");
}

async function createLead(){
await fetch("/lead/test",{method:"POST"});
loadLeads();
}

async function updateStatus(id,status){

await fetch("/lead/"+id+"/status",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({status})
});

loadLeads();
}

async function archiveLead(id){

await fetch("/lead/"+id+"/archive",{
method:"POST"
});

loadLeads();
}

async function deleteLead(id){

await fetch("/lead/"+id,{
method:"DELETE"
});

loadLeads();
}

async function assignProvider(id,provider){

await fetch("/lead/"+id+"/provider",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({provider})
});

loadLeads();
}

async function saveNotes(id){

const notes =
document.getElementById("notes-"+id).value;

await fetch("/lead/"+id+"/notes",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({notes})
});

loadLeads();
}

loadLeads();

</script>

`));
});

app.get("/providers", (req, res) => {
res.send(page("Providers", `
<div class="card">
<h1>Providers</h1>
<p>Provider management area.</p>
</div>
`));
});

app.get("/calls", (req, res) => {
res.send(page("Calls", `
<div class="card">
<h1>Calls</h1>
<p>Incoming calls and recordings will show here.</p>
</div>
`));
});

app.get("/settings", (req, res) => {
res.send(page("Settings", `
<div class="card">
<h1>Settings</h1>
<p>Dashboard settings area.</p>
<p>Webhook URL: /lead/new</p>
</div>
`));
});

app.post("/lead/test", async (req, res) => {

const result = await pool.query(`
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
lead_status,
price,
notes
)
VALUES (
'443-555-0100',
'443-578-1686',
'Test Lead',
'Emergency Lockout',
'55',
'',
'92',
'New',
'Citywide Lock & Key',
'New',
'35',
''
)
RETURNING *
`);

res.json({
success:true,
lead:result.rows[0]
});
});

app.get("/admin/leads", async (req, res) => {

const result = await pool.query(`
SELECT * FROM leads
WHERE archived=false
ORDER BY created_at DESC
`);

res.json({
success:true,
leads:result.rows
});
});

app.post("/lead/:id/status", async (req, res) => {

await pool.query(
"UPDATE leads SET lead_status=$1 WHERE id=$2",
[req.body.status, req.params.id]
);

res.json({success:true});
});

app.post("/lead/:id/provider", async (req, res) => {

await pool.query(
"UPDATE leads SET provider_assigned=$1 WHERE id=$2",
[req.body.provider, req.params.id]
);

res.json({success:true});
});

app.post("/lead/:id/notes", async (req, res) => {

await pool.query(
"UPDATE leads SET notes=$1 WHERE id=$2",
[req.body.notes, req.params.id]
);

res.json({success:true});
});

app.post("/lead/:id/archive", async (req, res) => {

await pool.query(
"UPDATE leads SET archived=true WHERE id=$1",
[req.params.id]
);

res.json({success:true});
});

app.delete("/lead/:id", async (req, res) => {

await pool.query(
"DELETE FROM leads WHERE id=$1",
[req.params.id]
);

res.json({success:true});
});

app.get("/health", (req, res) => {
res.json({
success:true,
status:"online"
});
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
