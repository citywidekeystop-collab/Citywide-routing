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

// CREATE TABLE
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

console.log("✅ DB table checked/updated");
} catch (err) {
console.error(err);
}
}

initDB();

app.get("/health", (req, res) => {
res.json({
success: true,
status: "online"
});
});

// CALLRAIL WEBHOOK
app.post("/lead/new", async (req, res) => {
try {
console.log("📞 CALLRAIL WEBHOOK RECEIVED");

const body = req.body;

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
$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
)
RETURNING *
`, [
body.customer_phone_number ||
body.customer_number ||
body.from ||
"Unknown",

body.tracking_phone_number ||
body.to ||
"Unknown",

body.source ||
body.callsource ||
"CallRail",

body.tag ||
body.lead_explanation ||
"Service Request",

body.duration || "0",

body.recording ||
body.recording_url ||
"",

body.lead_score || "N/A",

body.answered === false ? "Missed" : "New Lead",

"Unassigned",

"New",

"$35",

""
]);

res.json({
success: true,
lead: result.rows[0]
});

} catch (err) {
console.error(err);
res.status(500).json({
success: false,
error: err.message
});
}
});

// TEST LEAD
app.post("/lead/test", async (req, res) => {
try {

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
'New Lead',
'Citywide Lock & Key',
'New',
'$35',
''
)
RETURNING *
`);

res.json({
success: true,
lead: result.rows[0]
});

} catch (err) {
console.error(err);
}
});

// GET LEADS
app.get("/admin/leads", async (req, res) => {
try {

const result = await pool.query(`
SELECT * FROM leads
WHERE archived = false
ORDER BY created_at DESC
`);

res.json({
success: true,
total: result.rows.length,
leads: result.rows
});

} catch (err) {
console.error(err);
}
});

// UPDATE STATUS
app.post("/lead/:id/status", async (req, res) => {
try {

await pool.query(`
UPDATE leads
SET lead_status = $1
WHERE id = $2
`, [
req.body.status,
req.params.id
]);

res.json({
success: true
});

} catch (err) {
console.error(err);
}
});

// UPDATE PROVIDER
app.post("/lead/:id/provider", async (req, res) => {
try {

await pool.query(`
UPDATE leads
SET provider_assigned = $1
WHERE id = $2
`, [
req.body.provider,
req.params.id
]);

res.json({
success: true
});

} catch (err) {
console.error(err);
}
});

// SAVE NOTES
app.post("/lead/:id/notes", async (req, res) => {
try {

await pool.query(`
UPDATE leads
SET notes = $1
WHERE id = $2
`, [
req.body.notes,
req.params.id
]);

res.json({
success: true
});

} catch (err) {
console.error(err);
}
});

// ARCHIVE
app.post("/lead/:id/archive", async (req, res) => {
try {

await pool.query(`
UPDATE leads
SET archived = true
WHERE id = $1
`, [
req.params.id
]);

res.json({
success: true
});

} catch (err) {
console.error(err);
}
});

// DELETE
app.delete("/lead/:id", async (req, res) => {
try {

await pool.query(`
DELETE FROM leads
WHERE id = $1
`, [
req.params.id
]);

res.json({
success: true
});

} catch (err) {
console.error(err);
}
});

// DASHBOARD
app.get("/", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>NLN Dashboard</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
body{
background:#020617;
color:white;
font-family:Arial;
padding:20px;
margin:0;
}

.card{
background:#0f172a;
padding:20px;
margin-bottom:15px;
border-radius:15px;
border:1px solid #1e293b;
}

button{
padding:10px 14px;
border:none;
border-radius:8px;
margin:5px;
cursor:pointer;
font-weight:bold;
}

.accept{background:#16a34a;color:white;}
.booked{background:#7c3aed;color:white;}
.paid{background:#f59e0b;color:black;}
.archive{background:#64748b;color:white;}
.delete{background:#991b1b;color:white;}

textarea{
width:100%;
margin-top:10px;
background:#111827;
color:white;
border:1px solid #334155;
padding:10px;
border-radius:10px;
}

select{
padding:10px;
border-radius:8px;
background:#111827;
color:white;
}
</style>

</head>

<body>

<h1>🔥 NLN Lead Dashboard</h1>

<button onclick="createTestLead()">Create Test Lead</button>

<div id="leads"></div>

<script>

async function loadLeads(){

const res = await fetch('/admin/leads');
const data = await res.json();

const leadsDiv = document.getElementById('leads');

if(data.leads.length === 0){
leadsDiv.innerHTML = '<h2>No Leads Yet</h2>';
return;
}

leadsDiv.innerHTML = data.leads.map(lead => \`

<div class="card">

<h2>\${lead.customer_phone}</h2>

<p><strong>Service:</strong> \${lead.service}</p>
<p><strong>Source:</strong> \${lead.source}</p>
<p><strong>Status:</strong> \${lead.lead_status}</p>
<p><strong>Provider:</strong> \${lead.provider_assigned}</p>
<p><strong>Lead Score:</strong> \${lead.lead_score}</p>
<p><strong>Created:</strong> \${lead.created_at}</p>

<button class="accept" onclick="updateStatus(\${lead.id}, 'Accepted')">Accept</button>

<button class="booked" onclick="updateStatus(\${lead.id}, 'Booked')">Booked</button>

<button class="paid" onclick="updateStatus(\${lead.id}, 'Paid')">Paid</button>

<button class="archive" onclick="archiveLead(\${lead.id})">Archive</button>

<button class="delete" onclick="deleteLead(\${lead.id})">Delete</button>

<br><br>

<select onchange="assignProvider(\${lead.id}, this.value)">
<option>Citywide Lock & Key</option>
<option>Provider A</option>
<option>Provider B</option>
<option>Provider C</option>
</select>

<textarea id="notes-\${lead.id}">\${lead.notes || ''}</textarea>

<button onclick="saveNotes(\${lead.id})">Save Notes</button>

</div>

\`).join('');
}

async function updateStatus(id,status){

await fetch('/lead/' + id + '/status',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({status})
});

loadLeads();
}

async function assignProvider(id,provider){

await fetch('/lead/' + id + '/provider',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({provider})
});

loadLeads();
}

async function saveNotes(id){

const notes = document.getElementById('notes-' + id).value;

await fetch('/lead/' + id + '/notes',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({notes})
});

loadLeads();
}

async function archiveLead(id){

await fetch('/lead/' + id + '/archive',{
method:'POST'
});

loadLeads();
}

async function deleteLead(id){

await fetch('/lead/' + id,{
method:'DELETE'
});

loadLeads();
}

async function createTestLead(){

await fetch('/lead/test',{
method:'POST'
});

loadLeads();
}

loadLeads();

setInterval(loadLeads,5000);

</script>

</body>
</html>
`);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("✅ Server running on port " + PORT);
});
