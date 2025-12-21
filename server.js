const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check for Render
app.get("/health", (req, res) => res.status(200).send("OK"));

// Optional root so you don’t see “Cannot GET /”
app.get("/", (req, res) => res.status(200).send("Citywide routing is live"));

// Twilio (only init if env vars exist)
let twilioClient = null;
const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_NUMBER;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.log("Twilio not configured yet. Add env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER");
}

// Lead endpoint (Wix will POST here)
app.post("/lead/new", async (req, res) => {
  try {
    console.log("✅ HIT /lead/new", req.body);

    const lead = req.body || {};

    // Adjust these names if your Wix sends different keys
    const firstName = lead.firstName || lead.first || "";
    const lastName = lead.lastName || lead.last || "";
    const name = `${firstName} ${lastName}`.trim() || lead.name || "New Lead";
    const phone = lead.phone || lead.customerPhone || "";
    const email = lead.email || "";
    const service = lead.service || lead.selectedService || "Service Request";
    const details = lead.details || lead.message || "";

    // Respond to Wix immediately
    res.status(200).json({ ok: true });

    // Send SMS after response
    if (twilioClient) {
      const from = process.env.TWILIO_NUMBER;
      const owner = process.env.OWNER_NUMBER; // <-- YOU MUST ADD THIS ENV VAR in Render

      const msgToOwner =
        `🔔 NEW LEAD\n` +
        `Name: ${name}\n` +
        `Phone: ${phone}\n` +
        `Email: ${email}\n` +
        `Service: ${service}\n` +
        `Details: ${details}`;

      if (owner) {
        await twilioClient.messages.create({
          from,
          to: owner,
          body: msgToOwner,
        });
        console.log("✅ SMS sent to owner");
      } else {
        console.log("⚠️ OWNER_NUMBER not set — no SMS destination");
      }
    } else {
      console.log("⚠️ Twilio not ready — no SMS sent");
    }
  } catch (e) {
    console.log("❌ Error in /lead/new:", e);
    // If Wix is still waiting, respond safely
    try {
      res.status(500).json({ ok: false });
    } catch (_) {}
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
