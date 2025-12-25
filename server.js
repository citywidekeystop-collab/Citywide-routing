
// server.js — Nationwide Leads / Citywide Routing
// Render-friendly Express server + Angi-style Admin API + Twilio SMS
//
// REQUIRED ENV VARS (Render -> Environment):
// ADMIN_TOKEN = (your secret token, e.g. belpre334)
// OPTIONAL (for Twilio SMS):
// TWILIO_ACCOUNT_SID
// TWILIO_AUTH_TOKEN
// TWILIO_NUMBER (your Twilio phone, e.g. +1410xxxxxxx)
//
// Runs on Render PORT automatically.

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// -------------------- __dirname fix (ESM) --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- App --------------------
const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve /public
app.use(express.static(path.join(__dirname, "public")));

// -------------------- In-memory data (works now) --------------------
const nowLabel = () => {
const d = new Date();
const hh = d.getHours();
const mm = String(d.getMinutes()).padStart(2, "0");
const ampm = hh >= 12 ? "p" : "a";
const hr12 = ((hh + 11) % 12) + 1;
return `Today ${hr12}:${mm}${ampm}`;
};

const makeId = (prefix) => `${prefix}${Math.floor(Math.random() * 9000 + 1000)}`;

let leads = [
{
id: "L1001",
created: nowLabel(),
name: "John D.",
phone: "+1410***6818",
service: "Lockout",
zip: "21040",
assigned: "—",
status: "pending",
},
{
id: "L1002",
created: nowLabel(),
name: "Maria S.",
phone: "+1443***1686",
service: "Rekey",
zip: "21224",
assigned: "—",
status: "pending",
},
{
id: "L1003",
created: nowLabel(),
name: "Kevin R.",
phone: "+1301***1230",
service: "Car Key",
zip: "21162",
assigned: "John Provider",
status: "active",
},
];

let providers = [
{ id: "P1", name: "John Provider", phone: "+14102278467", service: "Lockout", zip: "21040", active: true, notes: "" },
{ id: "P2", name: "Towson Tech", phone: "+14435781686", service: "Rekey", zip: "21204", active: true, notes: "" },
{ id: "P3", name: "Keys Mobile", phone: "+13017201230", service: "Car Key", zip: "21162", active: false, notes: "" },
];

// -------------------- Auth middleware --------------------
function requireAdmin(req, res, next) {
const expected = (process.env.ADMIN_TOKEN || "").trim();

// If ADMIN_TOKEN is not set, allow (OPEN) but warn in logs
if (!expected) {
console.warn("⚠️ ADMIN_TOKEN not set — admin routes are OPEN.");
return next();
}

const got = (req.headers["x-admin-token"] || "").toString().trim();
if (!got || got !== expected) {
return res.status(401).json({
ok: false,
error: "Unauthorized",
hint: "Send header x-admin-token matching ADMIN_TOKEN",
});
}
next();
}

// -------------------- Public routes --------------------
// Root -> dashboard (so opening render URL shows dashboard, not Unauthorized)
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/health", (req, res) => {
res.json({
ok: true,
service: "citywide-routing",
time: new Date().toISOString(),
ip: req.ip,
});
});

// -------------------- Admin API --------------------
app.get("/api/admin/stats", requireAdmin, (req, res) => {
const pending = leads.filter((l) => l.status === "pending").length;
const active = leads.filter((l) => l.status === "active").length;
const cancelled = leads.filter((l) => l.status === "cancelled").length;
const processed = leads.length - pending; // simple metric
const activeProviders = providers.filter((p) => p.active).length;

res.json({
processed,
pending,
cancelled,
active,
providers: activeProviders,
totalLeads: leads.length,
});
});

app.get("/api/admin/leads", requireAdmin, (req, res) => {
// newest first
res.json([...leads].reverse());
});

app.post("/api/admin/lead/new", requireAdmin, (req, res) => {
const { name, phone, service, zip } = req.body || {};
if (!name) return res.status(400).json({ ok: false, error: "name required" });

const lead = {
id: makeId("L"),
created: nowLabel(),
name: String(name),
phone: phone ? String(phone) : "",
service: service ? String(service) : "Lockout",
zip: zip ? String(zip) : "",
assigned: "—",
status: "pending",
};
leads.push(lead);
res.json({ ok: true, lead });
});

app.post("/api/admin/lead/status", requireAdmin, (req, res) => {
const { id, status } = req.body || {};
if (!id || !status) return res.status(400).json({ ok: false, error: "id + status required" });

const lead = leads.find((l) => l.id === id);
if (!lead) return res.status(404).json({ ok: false, error: "lead not found" });

lead.status = String(status);
res.json({ ok: true, lead });
});

app.post("/api/admin/lead/assign", requireAdmin, (req, res) => {
const { id, assigned } = req.body || {};
if (!id || !assigned) return res.status(400).json({ ok: false, error: "id + assigned required" });

const lead = leads.find((l) => l.id === id);
if (!lead) return res.status(404).json({ ok: false, error: "lead not found" });

lead.assigned = String(assigned);
lead.status = "active";
res.json({ ok: true, lead });
});

// Providers
app.get("/api/admin/providers", requireAdmin, (req, res) => {
res.json([...providers]);
});

app.post("/api/admin/provider/new", requireAdmin, (req, res) => {
const { name, phone, service, zip, notes, active } = req.body || {};
if (!name || !phone) return res.status(400).json({ ok: false, error: "name + phone required" });

const p = {
id: makeId("P"),
name: String(name),
phone: String(phone),
service: service ? String(service) : "",
zip: zip ? String(zip) : "",
notes: notes ? String(notes) : "",
active: active === false ? false : true,
};
providers.push(p);
res.json({ ok: true, provider: p });
});

app.post("/api/admin/provider/toggle", requireAdmin, (req, res) => {
const { id } = req.body || {};
if (!id) return res.status(400).json({ ok: false, error: "id required" });

const p = providers.find((x) => x.id === id);
if (!p) return res.status(404).json({ ok: false, error: "provider not found" });

p.active = !p.active;
res.json({ ok: true, provider: p });
});

// -------------------- Twilio SMS --------------------
async function sendTwilioSMS(to, body) {
const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
const from = (process.env.TWILIO_NUMBER || "").trim();

if (!sid || !token || !from) {
const missing = [
!sid ? "TWILIO_ACCOUNT_SID" : null,
!token ? "TWILIO_AUTH_TOKEN" : null,
!from ? "TWILIO_NUMBER" : null,
].filter(Boolean);
throw new Error("Twilio not configured. Missing: " + missing.join(", "));
}

// Dynamic import so server still runs even if twilio package isn't installed (but SMS won't work)
let twilio;
try {
twilio = (await import("twilio")).default;
} catch (e) {
throw new Error('Twilio package not installed. Add "twilio" to package.json dependencies.');
}

const client = twilio(sid, token);
const msg = await client.messages.create({ from, to, body });
return msg.sid;
}

app.post("/api/admin/sms", requireAdmin, async (req, res) => {
const { to, body } = req.body || {};
if (!to || !body) return res.status(400).json({ ok: false, error: "to + body required" });

try {
const sid = await sendTwilioSMS(String(to), String(body));
res.json({ ok: true, sid });
} catch (e) {
res.status(400).json({ ok: false, error: e.message || "SMS failed" });
}
});

// OPTIONAL: public lead intake (if you want Wix forms to post leads without admin token)
app.post("/lead/new", (req, res) => {
const { name, phone, service, zip } = req.body || {};
if (!name) return res.status(400).json({ ok: false, error: "name required" });

const lead = {
id: makeId("L"),
created: nowLabel(),
name: String(name),
phone: phone ? String(phone) : "",
service: service ? String(service) : "Lockout",
zip: zip ? String(zip) : "",
assigned: "—",
status: "pending",
};
leads.push(lead);
res.json({ ok: true, lead });
});

// -------------------- 404 --------------------
app.use((req, res) => {
res.status(404).json({ ok: false, error: "Not Found", path: req.path });
});

// -------------------- Start --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
