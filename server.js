const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Health routes (Render uses this) ----------
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/", (req, res) => res.status(200).send("Citywide routing is live"));

// ---------- Twilio init (MUST be ABOVE /lead/new) ----------
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
  console.log("⚠️ Twilio NOT configured. Missing env vars.");
}

// ---------- Lead endpoint (Wix will POST here) ----------
app.post("/lead/new", async (req, res) => {
  try {
    console.log("✅ HIT /lead/new", req.body);

    const lead = req.body || {};

    // Try multiple possible field names from Wix payload
    const firstName = lead.firstName || lead.first_name || "";
    const lastName = lead.lastName || lead.last_name || "";
    const name = `${firstName} ${lastName}`.trim() || lead.name || "New Lead";

    const phone = lead.phone || lead.customerPhone || lead.contactPhone || "";
    const email = lead.email || lead.customerEmail || "";
    const service = lead.service || lead.selectedService || lead.select_a_service || "Service Request";
    const details = lead.details || lead.message || lead.give_us_more_details || "";

    // Respond to Wix immediately (important so Wix doesn't time out)
    res.status(200).json({ ok: true });

    // ----- SMS after response -----
    const owner = (process.env.OWNER_NUMBER || "").trim(); // MUST be like +14435781686

    console.log("OWNER_NUMBER env value =", owner);

    if (!twilioClient) {
      console.log("❌ SMS skipped (Twilio not initialized)");
      return;
    }

    if (!owner.startsWith("+")) {
      console.log("❌ OWNER_NUMBER must start with + (E.164). Current:", owner);
      return;
    }

    const msg =
      `🚨 NEW LEAD\n` +
      `Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Email: ${email}\n` +
      `Service: ${service}\n` +
      `Details: ${details}`;

    const providerNumbers = [
  "+1410XXXXXXX", // Provider 1
  "+1443XXXXXXX", // Provider 2
  "+1301XXXXXXX"  // Provider 3
];

for (const provider of providerNumbers) {
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM,
    to: provider
  });
}

    });

    console.log(`📲 SMS sent to ${owner} | SID: ${message.sid}`);
  } catch (e) {
    console.log("❌ /lead/new error:", e);
    // NOTE: response already sent above; this is just logging
  }
});

// ---------- Start server ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
