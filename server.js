import express from "express";
import cors from "cors";

const app = express();

// ====== CONFIG ======
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "belpre334"; // set on Render for security
const PORT = process.env.PORT || 10000;

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ====== SIMPLE IN-MEMORY STORAGE (fast MVP) ======
const LEADS = []; // newest first

function getToken(req) {
// Accept token from:
// 1) Query: ?token=xxxx
// 2) Header: x-admin-token: xxxx
// 3) Header: Authorization: xxxx (or "Bearer xxxx")
const q = req.query?.token;
const h1 = req.headers["x-admin-token"];
const auth = req.headers["authorization"];

const authToken =
typeof auth === "string"
? auth.startsWith("Bearer ")
? auth.slice(7)
: auth
: null;

return q || h1 || authToken || null;
}

function requireAdmin(req, res, next) {
const token = getToken(req);
if (!token || token !== ADMIN_TOKEN) {
console.log("❌ Unauthorized: bad/missing token", {
tokenPresent: !!token,
got: token,
});
return res.status(401).json({ error: "Unauthorized" });
}
next();
}

// ====== HEALTH CHECK (DASHBOARD CONNECT NEEDS THIS) ======
app.get("/", (req, res) => {
res.json({
ok: true,
service: "citywide-routing",
status: "online",
time: new Date().toISOString(),
});
});

// ====== ADMIN STATUS (USE THIS FOR DASHBOARD CONNECT) ======
app.get("/admin/status", requireAdmin, (req, res) => {
res.json({
ok: true,
status: "connected",
leadsStored: LEADS.length,
time: new Date().toISOString(),
});
});

// ====== WEBHOOK: LEAD INTAKE (WIX AUTOMATION POSTS HERE) ======
app.post("/lead/new", (req, res) => {
const token = getToken(req);

// If token is required, enforce it here:
if (!token || token !== ADMIN_TOKEN) {
console.log("❌ Unauthorized lead POST: bad/missing token");
return res.status(401).json({ error: "Unauthorized: bad/missing token" });
}

// Wix "Send HTTP request" often wraps payload; accept either
const body = req.body || {};
const data = body.data || body; // handle {data:{...}} and raw object

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
