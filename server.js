// server.js (CommonJS)
// If your project has "type":"module" in package.json, REMOVE it or rename this file to server.cjs

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// --- Optional services (only used if env vars exist)
let twilio = null;
try { twilio = require("twilio"); } catch(e) {}
let sgMail = null;
try { sgMail = require("@sendgrid/mail"); } catch(e) {}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ====== CONFIG ======
const PORT = process.env.PORT || 10000;

// Token required by /lead/new?token=...
const INTAKE_TOKEN = process.env.INTAKE_TOKEN || "belpre334";

// Admin token used by dashboard API calls
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "belpre334";

// ---- TWILIO (SMS)
const TWILIO_SID = process.env.TWILIO_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH || "";
const TWILIO_FROM = process.env.TWILIO_FROM || ""; // Twilio phone number
const ALERT_TO = process.env.ALERT_TO || ""; // YOUR phone number for alerts

// ---- SENDGRID (EMAIL)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || ""; // verified sender
const EMAIL_TO = process.env.EMAIL_TO || ""; // your inbox

if (sgMail && SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

// ====== SIMPLE STORAGE (in-memory) ======
// NOTE: free Render instances restart = memory resets.
// Later we can save to Google Sheets, Airtable, or DB.
const leads = [];
let leadId = 1;

// ====== HELPERS ======
function maskPhone(p) {
if (!p) return "";
const s = String(p).replace(/\D/g, "");
if (s.length < 4) return s;
return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function buildLeadMessage(lead) {
return [
`🔥 NEW PRICE REQUEST`,
`Name: ${lead.name || "-"}`,
`Phone: ${lead.phone || "-"}`,
`ZIP: ${lead.zip || "-"}`,
`Service: ${lead.service || "-"}`,
`Details: ${lead.details || "-"}`,
`ID: ${lead.id}`,
`Time: ${lead.createdAt}`,
].join("\n");
}

async function sendSmsAlert(text) {
if (!twilio || !TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !ALERT_TO) return;
const client = twilio(TWILIO_SID, TWILIO_AUTH);
await client.messages.create({
from: TWILIO_FROM,
to: ALERT_TO,
body: text.length > 1500 ? text.slice(0, 1500) : text,
});
}

async function sendEmailAlert(subject, text) {
if (!sgMail || !SENDGRID_API_KEY || !EMAIL_FROM || !EMAIL_TO) return;
await sgMail.send({
to: EMAIL_TO,
from: EMAIL_FROM,
subject,
text,
});
}

async function notifyLead(lead) {
const msg = buildLeadMessage(lead);

// Send both (best effort; one can fail without blocking the lead)
const results = { sms: "skipped", email: "skipped" };

try {
await sendSmsAlert(msg);
results.sms = (TWILIO_SID && TWILIO_AUTH && TWILIO_FROM && ALERT_TO) ? "sent" : "skipped";
} catch (e) {
results.sms = `failed: ${e.message}`;
}

try {
await sendEmailAlert(`New Price Request (#${lead.id})`, msg);
results.email = (SENDGRID_API_KEY && EMAIL_FROM && EMAIL_TO) ? "sent" : "skipped";
} catch (e) {
results.email = `failed: ${e.message}`;
}

return results;
}

function requireAdmin(req, res, next) {
const token = String(req.headers["x-admin-token"] || req.query.token || "");
if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });
next();
}

// ====== ROUTES ======
app.get("/health", (req, res) => {
res.json({ ok: true, service: "citywide-routing", time: new Date().toISOString() });
});

// Wix embed form posts here:
// POST https://citywide-routing.onrender.com/lead/new?token=belpre334
app.post("/lead/new", async (req, res) => {
const token = String(req.query.token || "");
if (token !== INTAKE_TOKEN) {
return res.status(403).json({ ok: false, error: "Bad token" });
}

// Accept a few possible field names (to avoid Wix naming issues)
const name = (req.body.name || req.body.fullName || req.body.full_name || "").toString().trim();
const phone = (req.body.phone || req.body.phoneNumber || req.body.phone_number || "").toString().trim();
const zip = (req.body.zip || req.body.zipCode || req.body.zip_code || "").toString().trim();
const service = (req.body.service || req.body.serviceType || req.body.service_type || "").toString().trim();
const details = (req.body.details || req.body.description || req.body.message || "").toString().trim();

const lead = {
id: leadId++,
name,
phone,
zip,
service,
details,
status: "needs_assignment",
createdAt: new Date().toISOString(),
};

leads.unshift(lead);
console.log("✅ LEAD RECEIVED:", { ...lead, phone: maskPhone(lead.phone) });

// Notifications
const notifyResults = await notifyLead(lead);
console.log("📣 NOTIFY RESULTS:", notifyResults);

// Respond to Wix
res.json({
ok: true,
id: lead.id,
message: "Request received. A provider will contact you soon.",
notify: notifyResults,
});
});

// Dashboard endpoints
app.get("/admin/stats", requireAdmin, (req, res) => {
const total = leads.length;
const pending = leads.filter(l => l.status === "needs_assignment").length;
const sent = leads.filter(l => l.status === "sent").length;
res.json({
ok: true,
stats: {
totalLeadsReceived: total,
needsAssignment: pending,
sentToProviders: sent,
activeProviders: 0,
}
});
});

app.get("/admin/leads", requireAdmin, (req, res) => {
res.json({ ok: true, leads });
});

// ====== START ======
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
