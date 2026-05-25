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
// HELPERS
// =====================================================

function safe(v) {
return String(v || "");
}

function providerCode(name) {
return providers[name]
.replace(/\D/g, "")
.slice(-4);
}

function money(v) {
return "$" + Number(v || 0).toLocaleString();
}

// =====================================================
// CLEAN CALLRAIL WEBHOOK
// =====================================================

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
b.transcription ||
b.transcript ||
b.note ||
"Incoming CallRail phone lead";

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

customerName,

customerPhone,

serviceType,

"CallRail",

"",

"NEW",

recordingUrl,

cleanNotes,

"0",

"35"

]);

console.log(
"CALLRAIL LEAD INSERTED"
);

res.status(200).json({
success: true
});

} catch (err) {

console.log(
"CALLRAIL ERROR:",
err
);

res.status(500).json({
success: false
});

}

});

// =====================================================
// ASSIGN PROVIDER
// =====================================================

app.post("/admin/assign/:id", async (req, res) => {

if (
req.query.token !== ADMIN_TOKEN
) {
return res.send("LOCKED");
}

await pool.query(`
UPDATE leads
SET provider_assigned=$1,
lead_status='ASSIGNED'
WHERE id=$2
`, [

req.body.provider_assigned,

req.params.id

]);

res.redirect(
`/admin?token=${ADMIN_TOKEN}`
);

});

// =====================================================
// ADMIN DASHBOARD
// =====================================================

app.get("/admin", async (req, res) => {

if (
req.query.token !== ADMIN_TOKEN
) {
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

<title>
NLN Dashboard
background:#ea580c;
}

select,
input,
${money(job.job_amount)}
</div>

<div class="sub">
${safe(job.notes)}
</div>

<div class="buttons">

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

<a
class="btn orange"
href="${safe(job.recording || "#")}">
Recording
</a>

${job.provider_assigned ? `

<a
class="btn green"
href="sms:${providers[job.provider_assigned] || ""}?body=New NLN Job: ${encodeURIComponent(job.service + " | " + job.customer_name + " | " + job.customer_phone)}">
Text Provider
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
}

.blue{
background:#2563eb;
}

.purple{
background:#9333ea;
${money(job.job_amount)}
</div>

<div class="sub">
${safe(job.notes)}
