console.log("✅ HIT /lead", req.body);

// ---- Twilio (only init if env vars exist) ----
let twilioClient = null;
const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_NUMBER;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.log("Twilio not configured yet. Add env vars in Render: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER");
}

// ---- Lead endpoint (Wix will POST here) ----
app.post("/lead/new", async (req, res) => {
  console.log("✅ HIT /lead", req.body);
  const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---- Health check (Render needs this) ----
app.get("/health", (req, res) => res.status(200).send("OK"));

// ---- Twilio (only init if env vars exist) ----
let twilioClient = null;
const hasTwilio =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_NUMBER;

if (hasTwilio) {
  const twilio = require("twilio");
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} else {
  console.log("Twilio not configured yet. Add env vars in Render: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER");
}

// ---- Lead endpoint (Wix will POST here) ----
app.post("/lead/new", async (req, res) => {
  try {
    const lead = req.body || {};

    // IMPORTANT: adjust these fields to match your Wix form IDs
    const firstName = lead.firstName || lead.first || "";
    const lastName = lead.lastName || lead.last || "";
    const name = `${firstName} ${lastName}`.trim() || lead.name || "New Lead";
    const phone = lead.phone || lead.customerPhone || "";
    const email = lead.email || "";
    const service = lead.service || lead.selectedService || "Service Request";
    const details = lead.details || lead.message || "";

    // respond success to Wix immediately
    res.status(200).json({ ok: true });

    // send SMS after response (doesn't block Wix)
    if (twilioClient) {
      const from = process.env.TWILIO_NUMBER;
      const owner = process.env.OWNER_NUMBER;

      const msgToOwner =
        `🔥 NEW LEAD\n` +
        `Name: ${name}\n` +
        `Phone: ${phone}\n` +
        `Email: ${email}\n` +
        `Service: ${service}\n` +
        `Details: ${details}`;

      // notify you
      if (owner) {
        await twilioClient.messages.create({
          from,
          to: owner,
          body: msgToOwner,
        });
      }

      // confirm customer
      if (phone && phone.startsWith("+")) {
        await twilioClient.messages.create({
          from,
          to: phone,
          body: `✅ Citywide Leads: We received your request for "${service}". A provider will contact you shortly.`,
        });
      }
    }
  } catch (err) {
    console.error("Lead error:", err);
    // If something fails after response, it will show in Render logs
  }
});

// ---- Render port ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
  try {
    const lead = req.body || {};

    // IMPORTANT: adjust these fields to match your Wix form IDs
    const firstName = lead.firstName || lead.first || "";
    const lastName = lead.lastName || lead.last || "";
    const name = `${firstName} ${lastName}`.trim() || lead.name || "New Lead";
    const phone = lead.phone || lead.customerPhone || "";
    const email = lead.email || "";
    const service = lead.service || lead.selectedService || "Service Request";
    const details = lead.details || lead.message || "";

    // respond success to Wix immediately
    res.status(200).json({ ok: true });

    // send SMS after response (doesn't block Wix)
    if (twilioClient) {
      const from = process.env.TWILIO_NUMBER;
      const owner = process.env.OWNER_NUMBER;

      const msgToOwner =
        `🔥 NEW LEAD\n` +
        `Name: ${name}\n` +
        `Phone: ${phone}\n` +
        `Email: ${email}\n` +
        `Service: ${service}\n` +
        `Details: ${details}`;

      // notify you
      if (owner) {
        await twilioClient.messages.create({
          from,
          to: owner,
          body: msgToOwner,
        });
      }

      // confirm customer
      if (phone && phone.startsWith("+")) {
        await twilioClient.messages.create({
          from,
          to: phone,
          body: `✅ Citywide Leads: We received your request for "${service}". A provider will contact you shortly.`,
        });
      }
    }
  } catch (err) {
    console.error("Lead error:", err);
    // If something fails after response, it will show in Render logs
  }
});

// ---- Render port ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
