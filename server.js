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
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Health check (Render)
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/", (req, res) => res.status(200).send("Citywide routing is live"));

// ---- Twilio init ----
let twilioClient = null;
const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_NUMBER;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.log("Twilio not configured. Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_NUMBER");
}

// ---- Wix automation will POST here ----
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

    const owner = process.env.OWNER_NUMBER;      // MUST be like +14435781686
    const from = process.env.TWILIO_NUMBER;      // MUST be your Twilio number like +1844...

    if (!twilioClient || !owner || !from) {
      console.log("SMS skipped. Missing:", { hasTwilioClient: !!twilioClient, owner, from });
      return;
    }

    console.log("OWNER_NUMBER =", owner);
    console.log("TWILIO_NUMBER =", from);

    const msg =
      "📩 NEW LEAD\n" +
      `Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Email: ${email}\n` +
      `Service: ${service}\n` +
      `Details: ${details}`;

    try {
      const result = await twilioClient.messages.create({
        from,
        to: owner,
        body: msg,
      });

      console.log("✅ SMS sent to", owner, "SID:", result.sid);
    } catch (err) {
      console.log("❌ Twilio SMS error:", err?.message || err);
      console.log("❌ Twilio error code:", err?.code);
      console.log("❌ Twilio more info:", err?.moreInfo);
    }
  } catch (e) {
    console.log("❌ /lead/new fatal error:", e);
    // If response wasn't sent yet
    try { res.status(500).json({ ok: false }); } catch {}
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
