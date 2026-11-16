# SLICC four-specialist AI pilot

This is a **development-only prototype**, not an operational legal service. It has four independent OpenAI specialist prompts and a deterministic dispatcher for: **legal research**, **appeals & court procedures**, **document outlines**, and **family membership support**. The public page displays scripted fictional examples only. No customer, inmate or court records are connected.

## Deployed preview
- Public demo: https://slicc-ai-voice-pilot.onrender.com
- System readiness: https://slicc-ai-voice-pilot.onrender.com/health
- Code: https://github.com/citywidekeystop-collab/Citywide-routing/tree/slicc-ai-voice-pilot-2026/slicc-ai

## Test endpoints
- GET /api/bots – four public specialist descriptions
- GET /api/demo/research (or appeals, documents, membership) – canned demonstrations only
- POST /api/internal/assist – calls a real OpenAI Responses specialist **only after** a private test token and API key are configured. Requires 'Authorization: Bearer <SLICC_TEST_TOKEN>' and JSON { "question": "...", "agentId":"research" }. Keep token private. Do **not** send real legal or inmate data during pilot testing.

## OpenAI and phone setup

Render service is separate from Citywide, on GitHub branch 'slicc-ai-voice-pilot-2026'. Set privately in Render:
- OPENAI_API_KEY – dedicated SLICC OpenAI API project; no account connection yet
- OPENAI_WEBHOOK_SECRET – secret for OpenAI webhook subscribed to 'live.transport.incoming'
- SLICC_TEST_TOKEN – secret random token of at least 20 characters to enable private text-agent testing (do not place in code)
- ENABLE_TEST_CALLS – 'false' until SIP and consent checks complete
- MAX_TEST_CALLS – default 5, capped to 20
- MAX_CALL_SECONDS – default 180, capped to 300
- SLICC_TEXT_MODEL – default 'gpt-5.4-mini', overridable

OpenAI webhook URL: https://slicc-ai-voice-pilot.onrender.com/webhooks/openai

If CallRail supports encrypted SIP signaling using TLS and audio using SRTP, use the SLICC-only number's SIP route 'sip:proj_YOUR_PROJECT_ID@sip.api.openai.com;transport=tls'. Confirm direct compatibility first; otherwise use a supported SIP trunk intermediary. **Do not redirect Citywide phone lines.** This service has not confirmed a successful telephone conversation.

After an inbound call is accepted, the backend attaches a GPT-Live sideband. It captures short-lived transcript fragments in memory and dispatches each client delegation to one of the four text specialists. That entire flow still needs end-to-end testing with a configured project. The AI cannot access a case, docket, prison account or billing system.

## Safety and launch gates
- Only fictional case details in pilot tests; do not record, retain or share real inmate data.
- No actual legal database, citation verifier or attorney-supervised advice connected; no assertions that any case rule or deadline is authoritative.
- Family document disclosure and payment changes need verified consent, authentication, audit logging and secure data storage.
- Use facility-authorized call routing and review telecommunications/privacy rules and correctional-facility contracts before inmate access.
- Do not market as a substitute for a lawyer or as privileged attorney-client calls.

## Local validation
From this directory, run 'npm install', 'npm run check', and 'npm test'. The tests use a fake API client and never make external requests.

Useful OpenAI docs:
https://developers.openai.com/api/docs/guides/voice-sip
https://developers.openai.com/api/docs/guides/live-delegation
https://developers.openai.com/api/docs/guides/function-calling
