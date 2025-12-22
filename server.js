/**
 * Citywide-routing — Wix Forms → Render → Twilio SMS
 * Endpoints:
 *   GET  /health   -> "OK"
 *   GET  /         -> "Citywide routing is live"
 *   POST /lead/new -> Wix Automation "Send HTTP request" posts here
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // Wix sends JSON

// --------------------
// Health / root routes
// --------------------
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/", (req, res) => res.status(200).send("Citywide routing is live"));

// --------------------
// Twilio init (MUST be ABOVE /lead/new)
// --------------------
let twilioClient = null;

const hasTwilio =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_NUMBER;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log("✅ Twilio initialized. From number:", process.env.TWILIO_NUMBER);
} else {
  console.log("⚠️ Twilio not configured. Missing env vars (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_NUMBER)");
}

// --------------------
// Lead endpoint (Wix will POST here)
// --------------------
app.post("/lead/new", async (req, res) => {
  try {
    console.log("✅ HIT /lead/new", req.body);

    // Wix Automations "Entire payload" can be nested — try common shapes
    const raw = req.body || {};
    const data =
      raw.data ||
      raw.payload ||
      raw.submission ||
      raw ||
      {};

    // Try to extract fields from different possible Wix payload formats
    const firstName =
      data.firstName ||
      data.first_name ||
      (data.contact && data.contact.name && data.contact.name.first) ||
      "";

    const lastName =
      data.lastName ||
      data.last_name ||
      (data.contact && data.contact.name && data.contact.name.last) ||
      "";

    const name = `${firstName} ${lastName}`.trim() || data.name || "New Lead";

    const email =
      data.email ||
      (data.contact && data.contact.email) ||
      "";

    const phone =
      data.phone ||
      data.customerPhone ||
      (data.contact && (data.contact.phone || (Array.isArray(data.contact.phones) ? data.contact.phones[0] : ""))) ||
      "";

    const service =
      data.service ||
      data.selectedService ||
      data.select_a_service ||
      "Service Request";

    const details =
      data.details ||
      data.message ||
      data.give_us_more_details ||
      "";

    // Respond to Wix immediately (so automation doesn’t fail)
    res.status(200).json({ ok: true });

    // Send SMS
    const owner = process.env.OWNER_NUMBER; // MUST be like +14435781686

    // Log the REAL number value so you can confirm it changed
    consoleconsole.log("📲 SMS sent to", owner, "| SID:", result.sid);

    if (!twilioClient || !owner) {
      console.log("❌ SMS skipped (missing twilioClient or OWNER_NUMBER)");
      return;
    }

    const msg =
      `🚨 NEW LEAD\n` +
      `Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Email: ${email}\n` +
      `Service: ${service}\n` +
      `Details: ${details}`;

    const result = await twilioClient.messages.create({
      from: process.env.TWILIO_NUMBER,
      to: owner,
      body: msg,
    });

    console.log("📲 SMS sent to", owner, "| SID:", result.sid);
  } catch (e) {
    console.log("❌ /lead/new error", e);
  }
});

// --------------------
// Start server (Render uses PORT)
// --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
