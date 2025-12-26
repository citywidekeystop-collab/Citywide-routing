/**
* Citywide Routing — Lead Intake API (Render)
* Accepts Wix Automations POST and logs/validates token from:
* 1) Query: ?token=...
* 2) Header: x-admin-token: ...
* 3) Body: { token: "..." }
*
* ENV needed on Render:
* ADMIN_TOKEN=belpre334 (or whatever you choose)
* PORT=10000 (Render sets this automatically, but fine to leave)
*/

const express = require("express");
const cors = require("cors");

const app = express();

// ----- Middleware -----
app.use(cors({ origin: "*" })); // simple for testing
app.use(express.json({ limit: "2mb" })); // Wix sends JSON
app.use(express.urlencoded({ extended: true }));

// Log every request (helps you verify Wix is hitting Render)
app.use((req, res, next) => {
console.log("\n--- REQUEST ---");
console.log("Time:", new Date().toISOString());
console.log("Method:", req.method);
console.log("Path:", req.path);
console.log("Query:", req.query);
console.log("Headers.x-admin-token:", req.headers["x-admin-token"] ? "[present]" : "[missing]");
next();
});

// ----- Helpers -----
function getIncomingToken(req) {
// Wix reliably sends query params; headers are hit-or-miss; body depends on your setup
return (
(req.query && req.query.token) ||
req.headers["x-admin-token"] ||
(req.body && req.body.token) ||
null
);
}

function maskToken(t) {
if (!t) return null;
if (t.length <= 4) return "***";
return `${t.slice(0, 2)}***${t.slice(-2)}`;
}

function requireAdminToken(req, res, next) {
const incoming = getIncomingToken(req);
const expected = process.env.ADMIN_TOKEN;

console.log("Token (incoming):", maskToken(incoming));
console.log("Token (expected):", expected ? "[set]" : "[MISSING ENV ADMIN_TOKEN]");

if (!expected) {
return res.status(500).json({
ok: false,
error: "Server misconfigured: ADMIN_TOKEN env var not set on Render",
});
}

if (!incoming) {
return res.status(401).json({ ok: false, error: "Unauthorized: token missing" });
}

if (incoming !== expected) {
return res.status(401).json({ ok: false, error: "Unauthorized: token invalid" });
}

next();
}

// ----- Routes -----
app.get("/", (req, res) => {
res.json({ ok: true, service: "citywide-routing", status: "running" });
});

app.get("/health", (req, res) => {
res.json({ ok: true, status: "healthy" });
});

// This is what Wix should POST to:
// https://citywide-routing.onrender.com/lead/new?token=belpre334
app.post("/lead/new", requireAdminToken, (req, res) => {
console.log("✅ LEAD HIT /lead/new (AUTHORIZED)");
console.log("Body:", JSON.stringify(req.body, null, 2));

// Wix Forms Automations often send data inside req.body.data
const payload = req.body?.data || req.body;

// Normalize fields (so you always see something consistent)
const lead = {
firstName: payload?.firstName || payload?.["First name"] || payload?.first_name || "",
lastName: payload?.lastName || payload?.["Last name"] || payload?.last_name || "",
email: payload?.email || payload?.Email || "",
phone: payload?.phone || payload?.Phone || "",
service: payload?.service || payload?.["Select a Service"] || payload?.serviceType || "",
details: payload?.details || payload?.["Give us more details"] || payload?.message || "",
source: payload?.source || "wix",
receivedAt: new Date().toISOString(),
};

console.log("Normalized Lead:", JSON.stringify(lead, null, 2));

// TODO later: save to DB / Google Sheet / SMS dispatch etc.

return res.status(200).json({
ok: true,
message: "Lead received",
lead,
});
});

// Debug endpoint to confirm token reading without submitting a form
// Open in browser:
// https://citywide-routing.onrender.com/debug/token?token=belpre334
app.get("/debug/token", (req, res) => {
const incoming = getIncomingToken(req);
res.json({
ok: true,
incomingToken: incoming ? "[present]" : "[missing]",
incomingTokenMasked: maskToken(incoming),
query: req.query,
hasHeaderToken: !!req.headers["x-admin-token"],
hasBodyToken: !!req.body?.token,
});
});

// ----- Start -----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
