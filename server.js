// server.js (ESM-safe)
// If your package.json has "type": "module", this will work.

import express from "express";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ====== CONFIG ======
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "belpre334";

// ====== CORS (Wix-safe) ======
// Wix can send preflight OPTIONS requests. This must succeed.
app.use(
cors({
origin: "*", // simplest: allow from anywhere (Wix, Preview, custom domains)
methods: ["GET", "POST", "OPTIONS"],
allowedHeaders: ["Content-Type", "x-admin-token", "Authorization"],
})
);

// Extra safety for preflight
app.options("*", (req, res) => {
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token, Authorization");
return res.sendStatus(204);
});

// ====== IN-MEMORY STORE (simple MVP) ======
const LEADS = []; // each item: { id, createdAt, data }

// ====== AUTH HELPER ======
function readToken(req) {
// Accept token in multiple places (makes Wix easiest)
const headerToken = req.headers["x-admin-token"];
const queryToken = req.query.token;
const bearer = (req.headers.authorization || "").startsWith("Bearer ")
? req.headers.authorization.replace("Bearer ", "").trim()
: null;

return (headerToken || queryToken || bearer || "").toString().trim();
}

function requireAdmin(req, res, next) {
const t = readToken(req);
if (!t || t !== ADMIN_TOKEN) {
return res.status(401).json({
ok: false,
error: "Unauthorized: bad/missing token",
hint: "Send ?token=YOUR_TOKEN or header x-admin-token: YOUR_TOKEN",
});
}
next();
}

// ====== ROUTES ======

// health
app.get("/", (req, res) => res.send("OK"));

// lead intake (from Wix automation)
app.post("/lead/new", (req, res) => {
const id = "L" + Math.random().toString(16).slice(2);
const createdAt = new Date().toISOString();
LEADS.unshift({ id, createdAt, data: req.body });

console.log("✅ LEAD RECEIVED", { id, createdAt });
return res.json({ ok: true, id, createdAt });
});

// admin status (dashboard connect check)
app.get("/admin/status", requireAdmin, (req, res) => {
return res.json({
ok: true,
status: "connected",
leadsStored: LEADS.length,
serverTime: new Date().toISOString(),
});
});

// admin leads list
app.get("/admin/leads", requireAdmin, (req, res) => {
return res.json({
ok: true,
leads: LEADS.slice(0, 50),
});
});

// ====== START ======
const port = process.env.PORT || 10000;
app.listen(port, () => console.log("✅ Server running on", port));

const lead = {
id: `L${Date.now()}`,
receivedAt: new Date().toISOString(),
ip:
req.headers["x-forwarded-for"] ||
req.headers["x-real-ip"] ||
req.socket.remoteAddress,
userAgent: req.headers["user-agent"],
data,
};

LEADS.unshift(lead); // newest first

console.log("✅ AUTHORIZED LEAD RECEIVED", {
id: lead.id,
fields: Object.keys(data || {}),
});

return res.json({ ok: true, leadId: lead.id });
});

// ====== ADMIN: GET LEADS FOR DASHBOARD TABLE ======
app.get("/admin/leads", requireAdmin, (req, res) => {
const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
res.json({
ok: true,
total: LEADS.length,
leads: LEADS.slice(0, limit),
});
});

// ====== ADMIN: BASIC STATS ======
app.get("/admin/stats", requireAdmin, (req, res) => {
res.json({
ok: true,
totalLeads: LEADS.length,
pending: LEADS.length, // MVP: treat all as pending until you add assignment logic
assigned: 0,
providersOnline: 0,
});
});

// ====== START SERVER ======
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
console.log(`✅ ADMIN_TOKEN set? ${!!process.env.ADMIN_TOKEN}`);
});
