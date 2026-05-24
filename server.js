const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "nln-admin-2026";

let providers = [
{ id: 1, name: "Max", phone: "+14436792242" },
{ id: 2, name: "Dreh", phone: "+12024125443" },
{ id: 3, name: "Tee", phone: "+14104199281" },
{ id: 4, name: "Robyn", phone: "+14434199281" }
];

let leads = [
{
id: 43,
customer: "Unknown",
phone: "Unknown",
trackingNumber: "+14437819117",
source: "Google My Business",
service: "Car Key Replacement",
location: "Edgewood Area",
details: "Customer called to inquire about key cutting services for a 2006 Hyundai Tucson in the Edgewood area.",
providerId: "",
status: "new",
jobAmount: 0,
leadCost: 35,
notes: "",
createdAt: new Date().toLocaleString()
}
];

function requireAdmin(req, res, next) {
const token = req.query.token || req.headers["x-admin-token"];
if (token !== ADMIN_TOKEN) {
return res.status(401).send(`
<h2>NLN Admin Locked</h2>
<p>Use your admin link:</p>
<b>/admin?token=${ADMIN_TOKEN}</b>
`);
}
next();
}

function money(n) {
return "$" + Number(n || 0).toLocaleString();
}

function getProvider(id) {
return providers.find(p => String(p.id) === String(id));
}

function leadProfit(l) {
return Number(l.jobAmount || 0) - Number(l.leadCost || 0);
}

function safeCallNumber(l) {
if (l.phone && l.phone !== "Unknown") return l.phone;
if (l.trackingNumber) return l.trackingNumber;
return "";
}

app.get("/", (req, res) => {
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/health", (req, res) => {
res.json({ ok: true, app: "NLN Dispatch Dashboard" });
});

app.post("/lead/new", (req, res) => {
const b = req.body;

leads.unshift({
id: Date.now(),
customer: b.customer || "Unknown",
phone: b.phone || "Unknown",
trackingNumber: b.trackingNumber || "",
source: b.source || "Manual / LSA",
service: b.service || "Locksmith Service",
location: b.location || "",
details: b.details || "",
providerId: "",
status: "new",
jobAmount: Number(b.jobAmount || 0),
leadCost: Number(b.leadCost || 35),
notes: "",
createdAt: new Date().toLocaleString()
});

res.json({ success: true });
});

app.post("/admin/add-job", requireAdmin, (req, res) => {
const b = req.body;

leads.unshift({
id: Date.now(),
customer: b.customer || "Unknown",
phone: b.phone || "Unknown",
trackingNumber: b.trackingNumber || "",
source: b.source || "Manual",
service: b.service || "Locksmith Service",
location: b.location || "",
details: b.details || "",
providerId: b.providerId || "",
status: b.providerId ? "assigned" : "new",
jobAmount: Number(b.jobAmount || 0),
leadCost: Number(b.leadCost || 35),
notes: "",
createdAt: new Date().toLocaleString()
});

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/update/:id", requireAdmin, (req, res) => {
const lead = leads.find(l => String(l.id) === String(req.params.id));
if (!lead) return res.redirect(`/admin?token=${ADMIN_TOKEN}`);

lead.providerId = req.body.providerId || "";
lead.status = req.body.quickStatus || req.body.status || lead.status;
lead.jobAmount = Number(req.body.jobAmount || 0);
lead.leadCost = Number(req.body.leadCost || 0);
lead.notes = req.body.notes || "";

if (lead.providerId && lead.status === "new") lead.status = "assigned";

res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.post("/admin/delete/:id", requireAdmin, (req, res) => {
leads = leads.filter(l => String(l.id) !== String(req.params.id));
res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

app.get("/admin", requireAdmin, (req, res) => {
const totalLeads = leads.length;
const revenue = leads.reduce((s, l) => s + Number(l.jobAmount || 0), 0);
const leadCosts = leads.reduce((s, l) => s + Number(l.leadCost || 0), 0);
const profit = revenue - leadCosts;
const completed = leads.filter(l => l.status === "completed" || l.status === "paid").length;

const columns = [
{ key: "new", title: "New Leads" },
{ key: "assigned", title: "Assigned" },
{ key: "enroute", title: "En Route" },
{ key: "completed", title: "Completed" },
{ key: "paid", title: "Paid / Closed" }
];

function card(l) {
const provider = getProvider(l.providerId);
const callNum = safeCallNumber(l);

return `
<div class="job-card">
<div class="job-head">
<b>Job #${l.id}</b>
<span class="pill ${l.status}">${l.status.toUpperCase()}</span>
</div>

<p><b>Service:</b> ${l.service}</p>
<p><b>Location:</b> ${l.location || "Not set"}</p>
<p><b>Customer:</b> ${l.customer}</p>
<p><b>Phone:</b> ${l.phone}</p>
<p><b>Provider:</b> ${provider ? provider.name : "Not Assigned"}</p>
<p><b>Job Amount:</b> ${money(l.jobAmount)}</p>
<p><b>Lead Cost:</b> ${money(l.leadCost)}</p>
<p><b>Profit:</b> <span class="${leadProfit(l) >= 0 ? "good" : "bad"}">${money(leadProfit(l))}</span></p>

<details>
<summary>Lead Details</summary>
<div class="details">${l.details || "No details"}</div>
</details>

<form method="POST" action="/admin/update/${l.id}?token=${ADMIN_TOKEN}">
<select name="providerId">
<option value="">Assign Provider</option>
${providers.map(p => `
<option value="${p.id}" ${String(p.id) === String(l.providerId) ? "selected" : ""}>${p.name}</option>
`).join("")}
</select>

<select name="status">
${["new","assigned","enroute","completed","paid"].map(s => `
<option value="${s}" ${l.status === s ? "selected" : ""}>${s}</option>
`).join("")}
</select>

<input name="jobAmount" type="number" value="${l.jobAmount}" placeholder="Job amount">
<input name="leadCost" type="number" value="${l.leadCost}" placeholder="Lead cost">
<textarea name="notes" placeholder="Admin notes">${l.notes || ""}</textarea>

<div class="btn-grid">
<button class="btn blue" type="submit">Save</button>
<a class="btn green" href="tel:${callNum}">Call</a>
<a class="btn purple" href="${provider ? `sms:${provider.phone}` : "#"}">Text Provider</a>
<button class="btn dark" type="submit" name="quickStatus" value="completed">Complete</button>
<button class="btn orange" type="submit" name="quickStatus" value="enroute">En Route</button>
<button class="btn paid" type="submit" name="quickStatus" value="paid">Paid</button>
</div>
</form>

<form method="POST" action="/
