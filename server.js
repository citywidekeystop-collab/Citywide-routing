import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import twilio from "twilio";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;

// ENV
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // ex: belpre334
const ADMIN_PHONE = process.env.ADMIN_PHONE; // ex: +14435781686

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM || process.env.TWILIO_NUMBER; // ex: +18444595551

const pool = new Pool({
connectionString: DATABASE_URL,
ssl: DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
});

const tw = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN)
? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
: null;

function mustStartWithPlus(phone) {
if (!phone) return "";
const digits = String(phone).replace(/\D/g, "");
if (String(phone).trim().startsWith("+")) return "+" + digits;
if (digits.length === 10) return "+1" + digits;
if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
return "+" + digits;
}

async function initDb() {
// Create table if missing
await pool.query(`
CREATE TABLE IF NOT EXISTS leads (
id SERIAL PRIMARY KEY,
name TEXT,
phone TEXT,
zip TEXT,
service TEXT,
details TEXT,
status TEXT DEFAULT 'needs_assignment',
created_at TIMESTAMPTZ DEFAULT NOW()
);
`);

// Add missing columns if the table exists but is old
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS details TEXT;`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'needs_assignment';`);
await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);

console.log("✅ DB ready (leads table checked/updated)");
}

app.get("/health", (req, res) => {
res.json({ ok: true, service: "citywide-routing", time: new Date().toISOString() });
});

app.post("/lead/new", async (req, res) => {
try {
const token = req.query.token || req.headers["x-admin-token"];
if (!token || token !== ADMIN_TOKEN) {
return res.status(401).json({ ok: false, error: "Unauthorized (bad token)" });
}

const name = (req.body.name || "").trim();
const phone = mustStartWithPlus(req.body.phone || "");
const zip = (req.body.zip || "").trim();
const service = (req.body.service || "").trim();
const details = (req.body.details || "").trim();
const status = "needs_assignment";

console.log("✅ LEAD RECEIVED:", { name, phone, zip, service, details, status });

const insert = await pool.query(
`INSERT INTO leads (name, phone, zip, service, details, status)
VALUES ($1,$2,$3,$4,$5,$6)
RETURNING id, created_at`,
[name, phone, zip, service, details, status]
);

// Notify via SMS (optional)
let smsResult = "skipped";
if (tw && ADMIN_PHONE && TWILIO_FROM) {
const msg =
`NEW LEAD #${insert.rows[0].id}\n` +
`Name: ${name || "-"}\n` +
`Phone: ${phone || "-"}\n` +
`Zip: ${zip || "-"}\n` +
`Service: ${service || "-"}\n` +
`Details: ${details || "-"}`;

await tw.messages.create({
from: TWILIO_FROM,
to: mustStartWithPlus(ADMIN_PHONE),
body: msg,
});
smsResult = "sent";
}

console.log("🔔 NOTIFY:", { sms: smsResult });

return res.json({
ok: true,
id: insert.rows[0].id,
createdAt: insert.rows[0].created_at,
notify: { sms: smsResult }
});
} catch (err) {
console.error("❌ ERROR /lead/new:", err.message);
return res.status(500).json({ ok: false, error: err.message });
}
});

initDb()
.then(() => {
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
})
.catch((e) => {
console.error("❌ DB init failed:", e.message);
process.exit(1);
});
