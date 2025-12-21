/**
 * Citywide Leads — Twilio Routing MVP (Calls + Forms)
 * - New lead triggers provider SMS routing (round-robin / sequential)
 * - Provider replies YES to accept
 * - If timeout -> next provider
 *
 * Deploy anywhere (Render, Railway, VPS) OR run locally via ngrok.
 */

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const twilio = require("twilio");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })); // for Twilio webhooks
app.use(bodyParser.json()); // for your form posts

// --------------------
// ENV VARS (set these)
// --------------------
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER, // your Twilio phone number, e.g. "+1410XXXXXXX"
  ROUTE_TIMEOUT_SECONDS // e.g. "90"
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
  console.error("Missing Twilio env vars. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER");
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const TIMEOUT = parseInt(ROUTE_TIMEOUT_SECONDS || "90", 10);

// --------------------
// Provider list (MVP)
// Replace with Google Sheets later
// Use E.164 format: +1XXXXXXXXXX
// --------------------
const PROVIDERS = [
  { name: "Provider 1", phone: "+14105550111", areas: ["MD"], services: ["lockout", "lock_replacement", "roadside"] },
  { name: "Provider 2", phone: "+14105550222", areas: ["MD"], services: ["lockout", "roadside"] },
  { name: "Provider 3", phone: "+14105550333", areas: ["VA"], services: ["lockout"] }
];

// --------------------
// In-memory lead store (MVP)
// Replace with DB/Sheets later
// --------------------
const leads = new Map(); // leadId -> lead object

function makeId(prefix = "lead") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function normalizeService(s) {
  const x = (s || "").toLowerCase();
  if (x.includes("lock")) return "lockout";
  if (x.includes("road")) return "roadside";
  if (x.includes("replace")) return "lock_replacement";
  return "lockout";
}

function pickProviders({ state, serviceType }) {
  // Filter providers by state + service
  return PROVIDERS.filter(p =>
    (p.areas.includes(state) || p.areas.includes("ALL")) &&
    (p.services.includes(serviceType) || p.services.includes("ALL"))
  );
}

async function sendProviderOfferSMS(provider, lead) {
  const msg =
`🚨 NEW LEAD: ${lead.serviceType.toUpperCase()} (${lead.leadSource})
City/State: ${lead.city}, ${lead.state}
Customer: ${lead.customerName || "N/A"} • ${lead.customerPhone || "N/A"}
Notes: ${lead.notes || "None"}

Reply YES to ACCEPT this lead.
Reply NO to DECLINE.
Lead ID: ${lead.id}`;

  await client.messages.create({
    from: TWILIO_NUMBER,
    to: provider.phone,
    body: msg
  });
}

async function routeLeadToNextProvider(leadId) {
  const lead = leads.get(leadId);
  if (!lead) return;

  // stop if already accepted
  if (lead.status === "accepted") return;

  // if exhausted
  if (lead.providerQueueIndex >= lead.providerQueue.length) {
    lead.status = "unmatched";
    lead.lastUpdate = Date.now();
    leads.set(leadId, lead);
    console.log("Lead unmatched:", leadId);
    return;
  }

  const provider = lead.providerQueue[lead.providerQueueIndex];
  lead.status = "offered";
  lead.offeredTo = provider.phone;
  lead.offerSentAt = Date.now();
  lead.lastUpdate = Date.now();
  leads.set(leadId, lead);

  console.log(`Offering lead ${leadId} to ${provider.name} (${provider.phone})`);
  await sendProviderOfferSMS(provider, lead);

  // schedule escalation if no reply
  setTimeout(() => {
    const current = leads.get(leadId);
    if (!current) return;

    // only escalate if still offered to same provider and not accepted
    const stillWaiting =
      current.status === "offered" &&
      current.offeredTo === provider.phone &&
      (Date.now() - current.offerSentAt) >= TIMEOUT * 1000;

    if (stillWaiting) {
      current.providerQueueIndex += 1;
      current.lastUpdate = Date.now();
      leads.set(leadId, current);
      routeLeadToNextProvider(leadId).catch(console.error);
    }
  }, (TIMEOUT + 2) * 1000);
}

// --------------------
// A) NEW LEAD ENDPOINT (FORMS / YOUR SITE)
// POST /lead/new  (JSON)
// --------------------
app.post("/lead/new", async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      city,
      state,
      serviceType,
      notes,
      leadSource // "FORM" or "CALL" or "CHAT"
    } = req.body;

    if (!city || !state) {
      return res.status(400).json({ error: "Missing city/state" });
    }

    const lead = {
      id: makeId("lead"),
      customerName: customerName || "",
      customerPhone: customerPhone || "",
      city,
      state: state.toUpperCase(),
      serviceType: normalizeService(serviceType),
      notes: notes || "",
      leadSource: (leadSource || "FORM").toUpperCase(),
      status: "requested",
      providerQueue: [],
      providerQueueIndex: 0,
      offeredTo: null,
      offerSentAt: null,
      acceptedBy: null,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };

    // build provider queue
    const queue = pickProviders(lead);
    if (!queue.length) {
      lead.status = "unmatched";
      leads.set(lead.id, lead);
      return res.json({ ok: true, leadId: lead.id, status: lead.status });
    }

    lead.providerQueue = queue;
    leads.set(lead.id, lead);

    // start routing
    lead.status = "searching";
    leads.set(lead.id, lead);
    routeLeadToNextProvider(lead.id).catch(console.error);

    res.json({ ok: true, leadId: lead.id, status: lead.status, offeredCount: queue.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------
// B) TWILIO SMS WEBHOOK (PROVIDERS REPLY YES/NO)
// Set this as your Twilio Messaging webhook URL
// POST /twilio/sms
// --------------------
app.post("/twilio/sms", (req, res) => {
  const from = req.body.From; // provider phone
  const body = (req.body.Body || "").trim().toUpperCase();

  // find the lead currently offered to this provider
  const lead = [...leads.values()].find(l => l.status === "offered" && l.offeredTo === from);

  const twiml = new twilio.twiml.MessagingResponse();

  if (!lead) {
    twiml.message("No active lead offer found for this number.");
    res.type("text/xml").send(twiml.toString());
    return;
  }

  if (body.startsWith("YES")) {
    lead.status = "accepted";
    lead.acceptedBy = from;
    lead.lastUpdate = Date.now();
    leads.set(lead.id, lead);

    twiml.message(`✅ Accepted. Lead locked to you. Lead ID: ${lead.id}`);

    // OPTIONAL: notify owner/dispatch here (your number)
    // client.messages.create({ from: TWILIO_NUMBER, to: "+1YOURNUMBER", body: `Lead ${lead.id} accepted by ${from}` });

    res.type("text/xml").send(twiml.toString());
    return;
  }

  if (body.startsWith("NO")) {
    // provider declined -> move to next
    lead.providerQueueIndex += 1;
    lead.lastUpdate = Date.now();
    leads.set(lead.id, lead);

    twiml.message(`Declined. Sending to next provider. Lead ID: ${lead.id}`);
    res.type("text/xml").send(twiml.toString());

    routeLeadToNextProvider(lead.id).catch(console.error);
    return;
  }

  twiml.message('Reply "YES" to accept or "NO" to decline.');
  res.type("text/xml").send(twiml.toString());
});

// --------------------
// C) (OPTIONAL) STATUS CHECK
// GET /lead/:id
// --------------------
app.get("/lead/:id", (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Not found" });
  res.json({ lead });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Citywide routing server running on :${PORT}`));
