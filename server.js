// server.js (ESM) — Citywide / Nationwide Routing API for Wix + Render
// ✅ Fixes: "require is not defined" by using import (ES Modules)
// ✅ Fixes: Wix embed "Sending request..." forever by handling CORS + OPTIONS
// ✅ Accepts JSON + x-www-form-urlencoded

import express from "express";
import cors from "cors";

const app = express();

/** =========================
* CONFIG
* ========================= */
const PORT = process.env.PORT || 3000;

// Your token (you can also move this into ENV later)
const LEAD_TOKEN = process.env.LEAD_TOKEN || "belpre334";

// Optional admin token for /admin endpoints
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || LEAD_TOKEN;

/** =========================
* MIDDLEWARE
* ========================= */

// CORS: allow Wix iframe + browsers
app.use(
cors({
origin: "*",
methods: ["GET", "POST", "OPTIONS"],
allowedHeaders: ["Content-Type", "Authorization"],
})
);

// Preflight (IMPORTANT for Wix embeds)
app.options("*", (req, res) => res.sendStatus(204));

// Body parsing (JSON + urlencoded)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/** =========================
* IN-MEMORY STORAGE (MVP)
* Later you can swap to DB/Sheets
* ========================= */
const store = {
leads: [], // { id, createdAt, name, phone, zip, service, details, source, page }
};

/** =========================
* HELPERS
* ========================= */
function newId() {
return (
"L" +
Math.random().toString(16).slice(2) +
"-" +
Date.now().toString(16)
);
}

function normalizeLead(body = {}) {
const name = (body.name || body.fullName || "").toString().trim();
const phone = (body.phone || body.phoneNumber || "").toString().trim();
const zip = (body.zip || body.zipcode || body.postal || "").toString().trim();
const service = (body.service || body.jobType || "").toString().trim();
const details = (body.details || body.description || body.notes || "")
.toString()
.trim();

const source = (body.source || "unknown").toString().trim();
const page = (body.page || "").toString().trim();

return { name, phone, zip, service, details, source, page };
}

/** =========================
* ROUTES
* ========================= */

// Health check
app.get("/", (req, res) => {
res.status(200).send("OK - Citywide/Nationwide routing API is running");
});

app.get("/health", (req, res) => {
res.json({ ok: true, service: "citywide-routing", ts: Date.now() });
});

// TEST endpoint for your Wix dashboard "connect"
app.get("/admin/ping", (req, res) => {
const token = (req.query.token || "").toString().trim();
if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });

res.json({
ok: true,
message: "Connected",
counts: {
totalLeads: store.leads.length,
needsAssignment: store.leads.filter((l) => !l.assigned).length,
},
});
});

// Admin read leads (for dashboard)
app.get("/admin/leads", (req, res) => {
const token = (req.query.token || "").toString().trim();
if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "Unauthorized" });

// newest first
const leads = [...store.leads].sort((a, b) => b.createdAt - a.createdAt);

res.json({ ok: true, leads });
});

// Main lead intake endpoint (Wix automation + embed form)
app.post("/lead/new", (req, res) => {
const token = (req.query.token || "").toString().trim();
if (token !== LEAD_TOKEN) {
return res.status(401).json({ ok: false, error: "Bad token" });
}

const lead = normalizeLead(req.body);

// Basic validation
if (!lead.name || !lead.phone || !lead.zip || !lead.service) {
return res.status(400).json({
ok: false,
error: "Missing required fields",
required: ["name", "phone", "zip", "service"],
received: lead,
});
}

const entry = {
id: newId(),
createdAt: Date.now(),
...lead,
assigned: false,
status: "new",
};

store.leads.push(entry);

console.log("✅ AUTHORIZED LEAD RECEIVED:", entry);

return res.status(200).json({
ok: true,
message: "Lead received",
leadId: entry.id,
});
});

/** =========================
* START
* ========================= */
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
