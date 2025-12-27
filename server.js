// =======================
// Citywide Routing Server
// =======================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const twilio = require("twilio");

const app = express();
const PORT = process.env.PORT || 10000;

// -----------------------
// Middleware
// -----------------------
app.use(cors());
app.use(bodyParser.json());

// -----------------------
// Home Route (FIXES Cannot GET /)
// -----------------------
app.get("/", (req, res) => {
res.send("Citywide Routing API is LIVE 🚀");
});

// -----------------------
// Health Check
// -----------------------
app.get("/health", (req, res) => {
res.json({ status: "ok" });
});

// -----------------------
// Database
// -----------------------
const db = new sqlite3.Database("./leads.db");

db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS leads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT,
phone TEXT,
zip TEXT,
service TEXT,
details TEXT,
status TEXT DEFAULT 'needs_assignment',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);
});

console.log("✅ DB ready (leads table checked/updated)");

// -----------------------
// Twilio Setup
// -----------------------
let twilioClient = null;

if (
process.env.TWILIO_ACCOUNT_SID &&
process.env.TWILIO_AUTH_TOKEN
) {
twilioClient = twilio(
process.env.TWILIO_ACCOUNT_SID,
process.env.TWILIO_AUTH_TOKEN
);
console.log("✅ Twilio configured: YES");
} else {
console.log("❌ Twilio configured: NO");
}

// -----------------------
// Create Lead (FROM WIX)
// -----------------------
app.post("/lead", (req, res) => {
const { name, phone, zip, service, details } = req.body;

if (!phone || !service) {
return res.status(400).json({ error: "Missing fields" });
}

db.run(
`
INSERT INTO leads (name, phone, zip, service, details)
VALUES (?, ?, ?, ?, ?)
`,
[name, phone, zip, service, details],
function (err) {
if (err) {
console.error(err);
return res.status(500).json({ error: "DB error" });
}

notifyAdmin(name, phone, service);

res.json({
success: true,
lead_id: this.lastID,
});
}
);
});

// -----------------------
// Dashboard: Get All Leads
// -----------------------
app.get("/dashboard/leads", (req, res) => {
db.all(
"SELECT * FROM leads ORDER BY created_at DESC",
[],
(err, rows) => {
if (err) {
return res.status(500).json({ error: "DB error" });
}
res.json(rows);
}
);
});

// -----------------------
// Update Lead Status
// -----------------------
app.post("/dashboard/update-status", (req, res) => {
const { id, status } = req.body;

db.run(
"UPDATE leads SET status = ? WHERE id = ?",
[status, id],
function (err) {
if (err) {
return res.status(500).json({ error: "Update failed" });
}
res.json({ success: true });
}
);
});

// -----------------------
// Notify Admin via SMS
// -----------------------
function notifyAdmin(name, phone, service) {
if (!twilioClient) return;

twilioClient.messages
.create({
from: process.env.TWILIO_FROM,
to: process.env.ADMIN_PHONE,
body: `🚨 New Lead\n${service}\n${name || "Unknown"}\n${phone}`,
})
.then(() => {
console.log("📩 SMS sent");
})
.catch((err) => {
console.error("❌ SMS failed", err.message);
});
}

// -----------------------
// Start Server
// -----------------------
app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
console.log("🚀 Your service is live");
});
