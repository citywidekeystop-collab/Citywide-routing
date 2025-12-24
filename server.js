// ===============================
// Citywide / Nationwide Routing Server
// FULL WORKING server.js
// ===============================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const app = express();

// ===============================
// FIX __dirname FOR RENDER (ESM)
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(bodyParser.json());

// ===============================
// ENV
// ===============================
const {
  DATABASE_URL,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 10000,
  ADMIN_TOKEN = "changeme123"
} = process.env;

// ===============================
// DATABASE
// ===============================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ===============================
// TWILIO
// ===============================
const sms = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ===============================
// INIT DB TABLE
// ===============================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      phone TEXT,
      raw JSONB
    );
  `);
  console.log("✅ Database ready");
}
initDB().catch(console.error);

// ===============================
// SERVE DASHBOARD FILES
// ===============================
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DASHBOARD ROUTE (IMPORTANT)
// ===============================
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// ===============================
// NEW LEAD ENDPOINT
// ===============================
app.post("/lead/new", async (req, res) => {
  try {
    const phone =
      req.body.phone ||
      req.body.Phone ||
      req.body?.fields?.Phone ||
      "UNKNOWN";

    await pool.query(
      "INSERT INTO leads (phone, raw) VALUES ($1, $2)",
      [phone, req.body]
    );

    if (TWILIO_FROM_NUMBER) {
      await sms.messages.create({
        from: TWILIO_FROM_NUMBER,
        to: phone,
        body: "📥 New lead received. We will contact you shortly."
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lead failed" });
  }
});

// ===============================
// ADMIN AUTH
// ===============================
function adminAuth(req, res, next) {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ===============================
// ADMIN LEADS (THIS FIXES WIX EMBED)
// ===============================
app.get("/admin/leads", adminAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM leads ORDER BY created_at DESC LIMIT 100"
  );
  res.json(rows);
});

// ===============================
// ASSIGN PROVIDER (PLACEHOLDER)
// ===============================
app.post("/admin/assign", adminAuth, async (req, res) => {
  res.json({ ok: true, message: "Assigned (demo)" });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
