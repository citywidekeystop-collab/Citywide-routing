const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check (Render uses this)
app.get("/health", (req, res) => res.status(200).send("OK"));

// Optional root route so you don’t see “Cannot GET /”
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
  console.log("Twilio not configured. Missing env vars.");
}

// Lead endpoint (Wix will POST here)
app.post("/lead/new", async (req, res) => {
  try {
    console.log("✅ HIT /lead/new", req.body);

    const lead = req.body || {};
    const firstName = lead.firstName || "";
    const lastName = lead.lastName || "";
    const name = `${firstName} ${lastName}`.trim() || lead.name || "New Lead";
    const phone = lead.phone || lead.customerPhone || "";
    const email = lead.email || "";
    const service = lead.service || lead.selectedService || "Service Request";
    const details = lead.details || lead.message || "";

    // Respond to Wix immediately
    res.status(200).json({ ok: true });

    // Send SMS after response
   const owner = process.env.OWNER_NUMBER; // MUST be +14435781686

console.log("OWNER_NUMBER env =", owner);

await twilioClient.messages.create({
  from,
  to: owner,
  body: msgToOwner
});

console.log("✅ SMS sent to", owner);
