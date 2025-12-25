// server.js — Nationwide Leads / Citywide Routing (Render + Wix)
// Works with Wix Automations "Send HTTP request" -> POST /lead/new
// Requires header: x-admin-token: YOUR_ADMIN_TOKEN
// Env vars: ADMIN_TOKEN, OWNER_NUMBER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER

import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const OWNER_NUMBER = process.env.OWNER_NUMBER || ""; // your phone to receive notifications

// Twilio (optional)
let twilioClient = null;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || "";

async function getTwilio() {
if (twilioClient) return twilioClient;
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
const mod = await import("twilio");
twilioClient = mod.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
return twilioClient;
}

function requireAdmin(req, res, next) {
const token = req.headers["x-admin-token"];
if (!ADMIN_TOKEN) {
return res.status(500).json({
ok: false,
error: "ADMIN_TOKEN is not set on the server (Render env var missing).",
});
}
if (!token || token !== ADMIN_TOKEN) {
return res.status(401).json({ ok: false, error: "Unauthorized (bad x-admin-token)" });
}
next();
}

// ---------- In-memory store (fast MVP) ----------
const db = {
leads: [], // { id, createdAt, firstName,lastName,email,phone,service,details,source, raw }
providers: [], // { id, name, phone, services:[], active:true }
};

function id(prefix = "id") {
return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeLead(payload) {
// Supports Wix "Entire payload" and also your custom JSON keys
const p = payload || {};

// Wix sometimes nests fields differently; this keeps it forgiving
const firstName =
p.firstName || p["First name"] || p.firstname || p.contact?.firstName || "";
const lastName =
p.lastName || p["Last name"] || p.lastname || p.contact?.lastName || "";
const email =
p.email || p.Email || p.contact?.email || p.contact?.emailAddress || "";
const phone =
p.phone || p.Phone || p.contact?.phone || p.contact?.phoneNumber || "";
const service =
p.service || p["Select a Service"] || p["Select a service"] || p.category || "";
const details =
p.details || p["Give us more details"] || p.message || p.notes || "";

return {
id: id("lead"),
createdAt: new Date().toISOString(),
firstName: String(firstName || "").trim(),
lastName: String(lastName || "").trim(),
email: String(email || "").trim(),
phone: String(phone || "").trim(),
service: String(service || "").trim(),
details: String(details || "").trim(),
source: String(p.source || "wix").trim(),
raw: p,
};
}

function matchProvider(lead) {
const svc = (lead.service || "").toLowerCase();
const active = db.providers.filter((x) => x.active !== false);

// If no service selected, just return first active provider
if (!svc) return active[0] || null;

// Try match by service keyword
const match = active.find((p) =>
(p.services || []).some((s) => String(s).toLowerCase().includes(svc) || svc.includes(String(s).toLowerCase()))
);

return match || active[0] || null;
}

async function sendSMS(to, body) {
if (!to) return { ok: false, skipped: true, reason: "No to number" };
const client = await getTwilio();
if (!client || !TWILIO_NUMBER) {
return { ok: false, skipped: true, reason: "Twilio not configured" };
}
const msg = await client.messages.create({
from: TWILIO_NUMBER,
to,
body,
});
return { ok: true, sid: msg.sid };
}

// ---------- Routes ----------
app.get("/health", (req, res) => {
res.json({
ok: true,
service: "citywide-routing",
time: new Date().toISOString(),
});
});

// MAIN: Wix hits this
app.post("/lead/new", async (req, res) => {
// 🔥 This is what you look for in Render Logs
console.log("🔥 LEAD HIT /lead/new");
console.log("Headers:", req.headers);
console.log("Body:", JSON.stringify(req.body));

// Security: require token
const token = req.headers["x-admin-token"];
if (!ADMIN_TOKEN) {
return res.status(500).json({ ok: false, error: "Missing ADMIN_TOKEN on server" });
}
if (!token || token !== ADMIN_TOKEN) {
console.log("❌ Unauthorized: bad/missing x-admin-token");
return res.status(401).json({ ok: false, error: "Unauthorized" });
}

try {
const lead = normalizeLead(req.body);
db.leads.unshift(lead);

const provider = matchProvider(lead);

// SMS messages (optional)
const ownerText =
`✅ New Lead (${lead.service || "No service"})\n` +
`Name: ${lead.firstName} ${lead.lastName}\n` +
`Phone: ${lead.phone || "n/a"}\n` +
`Email: ${lead.email || "n/a"}\n` +
`Details: ${lead.details || "n/a"}\n` +
`ID: ${lead.id}`;

const providerText =
`📩 New Lead Assigned\n` +
`Service: ${lead.service || "n/a"}\n` +
`Customer: ${lead.firstName} ${lead.lastName}\n` +
`Phone: ${lead.phone || "n/a"}\n` +
`Details: ${lead.details || "n/a"}\n` +
`Reply YES to accept. (MVP)`; // we can wire replies next

const smsOwner = OWNER_NUMBER ? await sendSMS(OWNER_NUMBER, ownerText) : { ok: false, skipped: true };
const smsProvider =
provider?.phone ? await sendSMS(provider.phone, providerText) : { ok: false, skipped: true };

return res.json({
ok: true,
success: true,
leadId: lead.id,
matchedProvider: provider ? { id: provider.id, name: provider.name, phone: provider.phone } : null,
sms: { owner: smsOwner, provider: smsProvider },
});
} catch (e) {
console.log("❌ Error saving lead:", e);
return res.status(500).json({ ok: false, error: "Server error", details: String(e?.message || e) });
}
});

// Admin: view leads
app.get("/admin/leads", requireAdmin, (req, res) => {
res.json({ ok: true, count: db.leads.length, leads: db.leads });
});

// Admin: add provider
app.post("/admin/providers", requireAdmin, (req, res) => {
const { name, phone, services, active } = req.body || {};
if (!name || !phone) return res.status(400).json({ ok: false, error: "name + phone required" });

const provider = {
id: id("prov"),
name: String(name).trim(),
phone: String(phone).trim(),
services: Array.isArray(services) ? services : (services ? String(services).split(",").map(s => s.trim()) : []),
active: active !== false,
createdAt: new Date().toISOString(),
};

db.providers.unshift(provider);
res.json({ ok: true, provider });
});

// Admin: list providers
app.get("/admin/providers", requireAdmin, (req, res) => {
res.json({ ok: true, count: db.providers.length, providers: db.providers });
});

// Root
app.get("/", (req, res) => {
res.type("text").send("✅ Routing server is running. Try /health");
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
