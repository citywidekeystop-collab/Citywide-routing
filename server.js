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

function safe(v) {
return String(v || "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;");
}

function money(v) {
return "$" + Number(v || 0).toLocaleString();
}

function providerCode(name) {
const phone = providers[name] || "";
return phone.replace(/\D/g, "").slice(-4);
}

function requireAdmin(req, res, next) {
if (req.query.token !== ADMIN_TOKEN) return res.send("ADMIN LOCKED");
next();
}

function cleanStatus(v) {
const s = String(v || "").toUpperCase();
if (["NEW", "ASSIGNED", "ENROUTE", "ARRIVED", "COMPLETED", "PAID", "DECLINED"].includes(s)) return s;
return "NEW";
}

async function getLeads() {
const r = await pool.query("SELECT * FROM leads ORDER BY id DESC");
return r.rows.map(x => ({ ...x, lead_status: cleanStatus(x.lead_status) }));
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.send("SERVER RUNNING");
});

app.get("/callrail/test", async (req, res) => {
await pool.query(`
INSERT INTO leads (
customer_name, customer_phone, service, source,
provider_assigned, lead_status, recording, notes, job_amount, lead_cost
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
});

10)
res.status(500).json({ success: false, error: err.message });
}
});

app.post("/admin/add-job", requireAdmin, async (req, res) => {
await pool.query(`
INSERT INTO leads (
customer_name, customer_phone, service, source,
provider_assigned, lead_status, recording, notes, job_amount, lead_cost
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
});

app.post("/admin/assign/:id", requireAdmin, async (req, res) => {
await pool.query(`
UPDATE leads
SET provider_assigned=$1, lead_status='ASSIGNED'
WHERE id=$2
`, [req.body.provider_assigned || "", req.params.id]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/status/:id", requireAdmin, async (req, res) => {
await pool.query(`
UPDATE leads
SET lead_status=$1
WHERE id=$2
`, [cleanStatus(req.body.status), req.params.id]);

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
await pool.query("DELETE FROM leads WHERE id=$1", [req.params.id]);
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/provider/:name/status/:id", async (req, res) => {
const name = req.params.name;
if (req.query.code !== providerCode(name)) return res.send("LOCKED");

await pool.query(`
UPDATE leads
SET provider_assigned=$1, lead_status=$2
WHERE id=$3
`, [name, cleanStatus(req.body.status), req.params.id]);

res.redirect(`/provider/${encodeURIComponent(name)}?code=${providerCode(name)}`);
});

function css() {
return `
body{margin:0;background:#020817;color:white;font-family:Arial}
.wrap{max-width:1400px;margin:auto;padding:20px}
.title{font-size:40px;font-weight:900;margin-bottom:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px}
.card,.job{background:#071226;border:1px solid #1e293b;border-radius:24px;padding:22px}
.big{font-size:40px;font-weight:900}
.jobs{display:flex;flex-direction:column;gap:18px}
.job-title{font-size:26px;font-weight:900;line-height:1.35;word-break:break-word}
.sub{color:#94a3b8;line-height:1.6;word-break:break-word;margin-top:6px}
.buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.btn{border:none;padding:13px 16px;border-radius:14px;color:white;font-weight:900;text-decoration:none;cursor:pointer;display:inline-block}
.blue{background:#2563eb}.purple{background:#9333ea}.green{background:#16a34a}.orange{background:#ea580c}.red{background:#991b1b}
input,select,textarea{width:100%;padding:15px;margin-top:12px;border:none;border-radius:14px;background:#0f172a;color:white;box-sizing:border-box}
.submit{width:100%;padding:16px;margin-top:15px;border:none;border-radius:14px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:white;font-weight:900;font-size:17px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
form{margin:0}
@media(max-width:700px){
.title{font-size:28px}
.row{grid-template-columns:1fr}
.job-title{font-size:21px}
.buttons{display:grid;grid-template-columns:1fr 1fr}
.btn{text-align:center}
}
`;
}

function renderJob(job, providerMode = false, providerName = "") {
const providerPhone = providers[job.provider_assigned] || "";
const textProviderBody = encodeURIComponent(
`New NLN Job: ${job.service || "Service"} | Customer: ${job.customer_name || "Unknown"} | Phone: ${job.customer_phone || "Unknown"} | Notes: ${job.notes || ""}`
);

return `
<div class="job">
<div class="job-title">${safe(job.service || "Locksmith Service")}</div>
<div class="sub">${safe(job.customer_name || "Unknown")} • ${safe(job.customer_phone || "No Phone")}</div>
<div class="sub">Status: ${safe(job.lead_status)}</div>
<div class="sub">Provider: ${safe(job.provider_assigned || "Not Assigned")}</div>
<div class="sub">Amount: ${money(job.job_amount)}</div>
<div class="sub">${safe(job.notes || "")}</div>

<div class="buttons">
<a class="btn blue" href="tel:${safe(job.customer_phone)}">Call</a>
<a class="btn purple" href="sms:${safe(job.customer_phone)}">Text</a>
<a class="btn orange" href="${safe(job.recording || "#")}">Recording</a>

${
providerPhone
? `<a class="btn green" href="sms:${providerPhone}?body=${textProviderBody}">Text Provider</a>`
: ""
}

${
providerMode
? `
<form method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="ENROUTE">
<button class="btn orange" type="submit">En Route</button>
</form>
<form method="POST" action="/provider/${encodeURIComponent(providerName)}/status/${job.id}?code=${providerCode(providerName)}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn green" type="submit">Complete</button>
</form>
`
: `
<form method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="COMPLETED">
<button class="btn green" type="submit">Complete</button>
</form>
<form method="POST" action="/admin/status/${job.id}?token=${ADMIN_TOKEN}">
<input type="hidden" name="status" value="PAID">
<button class="btn green" type="submit">Paid</button>
</form>
<form method="POST" action="/admin/delete/${job.id}?token=${ADMIN_TOKEN}">
<button class="btn red" type="submit">Delete</button>
</form>
`
}
</div>

${
!providerMode
? `
<form method="POST" action="/admin/assign/${job.id}?token=${ADMIN_TOKEN}" style="margin-top:14px">
<select name="provider_assigned">
<option value="">Send To Provider</option>
${Object.keys(providers).map(p => `<option value="${safe(p)}">${safe(p)}</option>`).join("")}
</select>
<button class="submit" type="submit">Assign Job</button>
</form>
`
: ""
}
</div>
`;
}

app.get("/admin", requireAdmin, async (req, res) => {
const leads = await getLeads();
const revenue = leads.reduce((s, l) => s + Number(l.job_amount || 0), 0);

res.send(`
<html>
<head>
<title>NLN Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>
<div class="wrap">
<div class="title">Admin Dashboard</div>

<div class="stats">
<div class="card"><div class="big">${leads.length}</div><div>Total Jobs</div></div>
<div class="card"><div class="big">${money(revenue)}</div><div>Revenue</div></div>
<div class="card"><div class="big">${Object.keys(providers).length}</div><div>Providers</div></div>
<div class="card"><div class="big">$0</div><div>Payment Threshold</div></div>
</div>

<div class="card">
<h2>Add Job</h2>
<form method="POST" action="/admin/add-job?token=${ADMIN_TOKEN}">
<div class="row">
<input name="customer_name" placeholder="Customer Name">
<input name="customer_phone" placeholder="Customer Phone">
<input name="service" placeholder="Service">
<input name="source" placeholder="Source">
<input name="job_amount" placeholder="Job Amount">
<input name="lead_cost" placeholder="Lead Cost">
<input name="recording" placeholder="Recording URL">
<select name="provider_assigned">
<option value="">Assign Provider</option>
${Object.keys(providers).map(p => `<option value="${safe(p)}">${safe(p)}</option>`).join("")}
</select>
</div>
<textarea name="notes" placeholder="Notes"></textarea>
<button class="submit">Create Job</button>
</form>
</div>

<div style="height:20px"></div>

<div class="jobs">
${leads.map(job => renderJob(job)).join("") || "<div class='card'>No jobs yet.</div>"}
</div>
</div>
</body>
</html>
`);
});

app.get("/provider/:name", async (req, res) => {
const name = req.params.name;

if (!providers[name]) return res.send("Provider not found");

if (req.query.code !== providerCode(name)) {
return res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>
<div class="wrap">
<div class="card">
<h1>${safe(name)}</h1>
<p>Enter 4 digit provider code</p>
<form>
<input name="code" maxlength="4" placeholder="4 digit code">
<button class="submit">Login</button>
</form>
</div>
</div>
</body>
</html>
`);
}

const leads = (await getLeads()).filter(l =>
l.provider_assigned === name || l.lead_status === "NEW"
);

res.send(`
<html>
<head>
<title>${safe(name)} Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css()}</style>
</head>
<body>
<div class="wrap">
<div class="title">${safe(name)} Dashboard</div>
<div class="stats">
<div class="card"><div class="big">${leads.length}</div><div>Visible Jobs</div></div>
<div class="card"><div class="big">Online</div><div>Status</div></div>
</div>
<div class="jobs">
${leads.map(job => renderJob(job, true, name)).join("") || "<div class='card'>No jobs yet.</div>"}
</div>
</div>
</body>
</html>
`);
});
