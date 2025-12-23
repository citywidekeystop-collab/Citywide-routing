import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import twilio from "twilio";

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(bodyParser.json());

// ---------- ENV ----------
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 3000
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
  res.send("Citywide routing server running");
});

// ---------- LEAD ENDPOINT ----------
app.post("/lead/new", async (req, res) => {
  try {
    console.log("📥 Lead received:", req.body);

    const phone =
      req.body?.phone ||
      req.body?.Phone ||
      req.body?.fields?.Phone ||
      "UNKNOWN";

    const message = `🚨 New Lead Received\nPhone: ${phone}`;

    await client.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: "+14108166818", // CHANGE to your test number
      body: message
    });

    console.log("✅ SMS sent");

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ Error in /lead/new:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
