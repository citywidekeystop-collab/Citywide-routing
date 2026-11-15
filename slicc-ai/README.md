# SLICC voice AI pilot (CallRail → OpenAI)

This is a **test-only** OpenAI GPT-Live incoming-SIP webhook backend. It does not perform verified legal research, store private calls, manage memberships, or serve correctional facilities. No actual calls can be accepted until a private OpenAI project is configured and `ENABLE_TEST_CALLS` is set to `true`.

## Render deployment
Create a separate Render Node web service (do not modify any Citywide service):
- Repository: `citywidekeystop-collab/Citywide-routing`
- Branch: `slicc-ai-voice-pilot-2026`
- Build command: `npm install --prefix slicc-ai`
- Start command: `node slicc-ai/server.js`
- Health check: `/health`

Set these environment variables **in Render, not GitHub**:
- `OPENAI_API_KEY` (from a dedicated SLICC OpenAI API project)
- `OPENAI_WEBHOOK_SECRET` (from OpenAI project Webhooks)
- `ENABLE_TEST_CALLS=false` initially
- `MAX_TEST_CALLS=5`
- `MAX_CALL_SECONDS=180`

Under the same OpenAI project, subscribe a webhook for `live.transport.incoming` at `https://YOUR-RENDER-HOST.onrender.com/webhooks/openai`. Then configure your CallRail SLICC-only call flow to route via encrypted TLS+SRTP to `sip:proj_YOUR_PROJECT_ID@sip.api.openai.com;transport=tls`. **Verify CallRail's TLS and SRTP support first; direct compatibility is not confirmed.** If not compatible, use a supported SIP trunk intermediary instead. Test from an ordinary phone, with fictional legal questions only.

Enable test calls only after billing limits, webhook signing secret, SIP connectivity, and privacy settings are verified. Keep recording off and do not link to real inmate accounts or present the bot as a lawyer.

Refs:
- https://developers.openai.com/api/docs/guides/voice-sip
- https://developers.openai.com/api/docs/guides/webhooks
- https://support.callrail.com/hc/en-us/articles/5712076383885-Session-Initiation-Protocol-SIP
