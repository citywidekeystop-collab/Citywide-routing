// server.js (ESM / Render-safe)
// npm i express cors

import express from "express";
import cors from "cors";

const app = express();

// --------- Config ---------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "changeme";
const PORT = process.env.PORT || 10000;

// If you want to lock CORS down later, replace "*" with your Wix domain.
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// --------- In-memory storage (fast MVP) ---------
const leads = []; // all incoming leads
const providers = []; // provider list

// --------- Helpers ---------
function isAuthed(req) {
const token =
req.query?.token ||
req.headers["x-admin-token"] ||
req.headers["x-admin_token"] ||
req.headers["authorization"]?.replace("Bearer ", "");

return token && token === ADMIN_TOKEN;
}

function safeText(v) {
if (v === null || v === undefined) return "";
if (typeof v === "string") return v.trim();
return String(v);
}

// Wix payloads vary. This tries to find values in common Wix Forms shapes.
function extractWixFields(body) {
// Common patterns:
// body.data.submissions[0].fields (sometimes)
// body.data.submission (sometimes)
// body.data (sometimes includes values)
const out = {
first_name: "",
last_name: "",
name: "",
email: "",
phone: "",
service: "",
zip: "",
details: "",
raw: body
};

// Try to find any object with key/value style fields
const stack = [body];
const seen = new Set();

while (stack.length) {
const cur = stack.pop();
if (!cur || typeof cur !== "object") continue;
if (seen.has(cur)) continue;
seen.add(cur);

// If we find something that looks like field data, map it
// e.g. { first_name: "...", phone: "...", select_a_service: "..." }
for (const [k, v] of Object.entries(cur)) {
const key = String(k).toLowerCase();

// map common names
if (!out.first_name && (key === "first_name" || key === "firstname")) out.first_name = safeText(v);
if (!out.last_name && (key === "last_name" || key === "lastname")) out.last_name = safeText(v);
if (!out.email && key === "email") out.email = safeText(v);
if (!out.phone && (key === "phone" || key === "phonenumber" || key === "mobile")) out.phone = safeText(v);
if (!out.zip && (key === "zip" || key === "zipcode" || key === "postal" || key === "postalcode")) out.zip = safeText(v);
if (!out.service && (key.includes("service") || key.includes("select_a_service"))) out.service = safeText(v);
if (!out.details && (key.includes("details") || key.includes("message") || key.includes("notes"))) out.details = safeText(v);

// traverse deeper
if (v && typeof v === "object") stack.push(v);
}
}

// Build display name
out.name = safeText(`${out.first_name} ${out.last_name}`).trim() || out.name;

return out;
}

function makeLeadRecord(body) {
const f = extractWixFields(body);

return {
id: `L${Date.now()}-${Math.random().toString(16).slice(2)}`,
service: f.service || "Unknown",
customer: f.name || "Unknown",
email: f.email || "",
phone: f.phone || "",
zip: f.zip || "",
details: f.details || "",
status: "pending", // pending | assigned | closed
assignedTo: "", // provider id
created: new Date().toISOString(),
source: "wix",
raw: f.raw // keep for debugging
};
}

// --------- Health ---------
app.get("/", (req, res) => {
res.json({ ok: true, service: "citywide-routing", time: new Date().toISOString() });
});

// --------- Lead intake (Wix webhook) ---------
// IMPORTANT: Wix is sending token in the URL query: /lead/new?token=xxxx
app.post("/lead/new", (req, res) => {
const token = req.query?.token;

if (!token || token !== ADMIN_TOKEN) {
console.log("❌ Unauthorized lead hit. token missing/invalid");
return res.status(401).json({ error: "Unauthorized: bad/missing token" });
}

const lead = makeLeadRecord(req.body);
leads.unshift(lead); // newest first

console.log("✅ AUTHORIZED LEAD RECEIVED", {
id: lead.id,
service: lead.service,
customer: lead.customer,
phone: lead.phone,
zip: lead.zip
});

res.json({ ok: true, id: lead.id });
});

// --------- Admin endpoints (Dashboard uses these) ---------
app.get("/admin/status", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
res.json({ ok: true });
});

app.get("/admin/stats", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

const total = leads.length;
const pending = leads.filter(l => l.status === "pending").length;
const assigned = leads.filter(l => l.status === "assigned").length;
const activeProviders = providers.filter(p => p.active).length;

res.json({
total,
pending,
assigned,
providers: providers.length,
activeProviders
});
});

app.get("/admin/requests", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
res.json(leads);
});

// --------- Providers (optional MVP) ---------
app.get("/admin/providers", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
res.json(providers);
});

app.post("/admin/providers", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

const name = safeText(req.body?.name);
const phone = safeText(req.body?.phone);
const service = safeText(req.body?.service); // e.g. "Locksmith", "Tow", etc.
const zip = safeText(req.body?.zip);

if (!name || !phone) return res.status(400).json({ error: "name and phone required" });

const p = {
id: `P${Date.now()}-${Math.random().toString(16).slice(2)}`,
name,
phone,
service,
zip,
active: true,
created: new Date().toISOString()
};

providers.unshift(p);
res.json({ ok: true, provider: p });
});

app.post("/admin/providers/:id/toggle", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

const p = providers.find(x => x.id === req.params.id);
if (!p) return res.status(404).json({ error: "Provider not found" });

p.active = !p.active;
res.json({ ok: true, provider: p });
});

// --------- Assign lead to provider (for dashboard later) ---------
app.post("/admin/assign", (req, res) => {
if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

const leadId = safeText(req.body?.leadId);
const providerId = safeText(req.body?.providerId);

const lead = leads.find(l => l.id === leadId);
if (!lead) return res.status(404).json({ error: "Lead not found" });

const provider = providers.find(p => p.id === providerId);
if (!provider) return res.status(404).json({ error: "Provider not found" });

lead.status = "assigned";
lead.assignedTo = provider.id;

res.json({ ok: true, lead });
});

// --------- Start ---------
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
