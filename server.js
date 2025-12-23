import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";
import pg from "pg";
const { Pool } = pg;
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ENV
const DATABASE_URL = process.env.DATABASE_URL; // must exist in Render Env Vars

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // important for hosted Postgres
});
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 10000
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
// ==============================
// STEP A — DATABASE SETUP
// ==============================
async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      phone TEXT,
      raw JSONB
    );
  `;
  await pool.query(sql);
  console.log("Database ready: leads table exists");
}

initDb().catch(err => {
  console.error("Database init failed:", err);
});

// Health check
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// Lead endpoint
app.post("/lead/new", async (req, res) => {
  try {
    console.log("📥 Lead received:", req.body);

    const phone =
      req.body.phone ||
      req.body.Phone ||
      req.body?.fields?.Phone ||
      "UNKNOWN";

    const message = `🚨 New Lead Received\nPhone: ${phone}`;

    await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: "+14108166818", // YOUR test number
      body: message
    });

    console.log("✅ SMS sent");
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
