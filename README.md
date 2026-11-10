# Find Me a Locksmith — MVP website

A mobile-first, customer-facing request site exclusively for locksmith jobs. A private dispatch inbox saves requests for your team, with Citywide or partner assignment.

## What's built

- Three-step request form: locksmith job type, urgency, ZIP, location, contact details, consent.
- Locksmith-only job choices with prefilled service buttons (automotive, residential and commercial).
- PostgreSQL lead storage and a private `/admin` dashboard.
- Lead statuses: new, contacted, booked, completed, closed; assignment: Citywide / partner.
- Optional webhook or Resend email alerts on newly saved leads.
- UTM source/campaign tracking on submissions; basic bot honeypot and rate limiting.
- Responsive landing page, privacy/terms drafts, easy-to-configure business contacts.
- Safety gate: won't accept REAL customer submissions until the required setup is complete.

## Quick local preview

1. Use Node.js 20+.
2. Run `npm install`.
3. Run `cp .env.example .env`, then `npm start`.
4. Open `http://localhost:3000` (or `PORT`).

**In preview mode the form does not submit or store real personal information.** It displays a clear demo notice.

## Production setup (GitHub + Render)

1. Create a **new private GitHub repository**, add these project files, and push. Do not commit `.env` or any access tokens.
2. Provision a PostgreSQL database in Render. Use a connection URL in the `DATABASE_URL` environment variable.
3. Deploy the repository as a Render **Node web service** using `npm install` as build command and `npm start` as start command. The included `render.yaml` is an example configuration; inspect it and adapt to the plan/pricing you select.
4. Enter environment values for `SITE_URL`, `CONTACT_PHONE`, `CONTACT_EMAIL`, and `LEGAL_LOCKSMITH_NAME`.
5. **Confirm licensing requirements**. Supply the actual, verified Maryland locksmith license number as `LICENSE_NUMBER`. Never enter a made-up number.
6. Set a strong secret in `ADMIN_PASSWORD` and `ADMIN_USERNAME`. Protect `/admin`; access it only over HTTPS.
7. Set `LEAD_WEBHOOK_URL` for an automation platform (Make, Zapier, or your compatible internal intake API) and/or `RESEND_API_KEY`, `FROM_EMAIL`, `DISPATCH_EMAIL` for email notifications. Webhook request uses POST `application/json`; payload `{event: 'service.lead.created', lead: {...}}`. If `LEAD_WEBHOOK_SECRET` is configured, signature is HMAC-SHA256 of JSON request body, provided as `x-lead-signature`.
8. Test lead submission, database persistence, notification delivery, consent recording, and admin access.
9. Only after setup/testing, set `ENABLE_LIVE_SUBMISSIONS=true`. Real submissions require this flag PLUS `DATABASE_URL`, `LICENSE_NUMBER`, and `ADMIN_PASSWORD` to be present. Make sure the configured provider name and license are correct and visible on the public site.
10. Connect a verified domain in Render and point your DNS. Review the privacy and terms drafts and publish your final legal/business disclosures.

## Routing today vs later

**Today:** all new requests save to *your* dispatch inbox first. Assign manually to `Citywide` or `partner`. A new lead can trigger your configured email or webhook. No lead is automatically sent to another provider unless you configure an external integration.

**Later:** add verified provider accounts, ZIP/service matching, automatic on-call rotation, quotes, payments, customer message threads, and lead resale/billing with customer permission and license checks.

## Important disclosures

- The site does **not** advertise fictional contractors, reviews, response times or competing quotes.
- All customer intake categories and server-side job validation are restricted to locksmith requests; there is no separate door-repair category.
- Customers are told that Citywide may handle the job directly and a partner may receive the job request.
- No Google Ads, LSA, domain, CallRail, Stripe, GitHub or Render accounts have been altered by this package.
- Submission has no upfront payment or commitment; prices and availability must be discussed with the provider before service.
- Privacy policy and terms are starter templates, **not legal advice**. Add real contacts, vendors, effective dates, data retention and any state-specific language before public launch.
- Protect customer data. Use HTTPS, strong passwords, restricted partner access and a retention/deletion policy. For production, review admin authentication/monitoring and notification retries.

## Project files

- `server.js`: HTTP/API, PostgreSQL storage, dispatch notifications, secure admin route.
- `public/index.html`, `public/styles.css`, `public/app.js`: responsive request site.
- `private/admin.html`, `public/admin.js`: dispatch inbox.
- `public/privacy.html`, `public/terms.html`: disclosure drafts.
- `render.yaml`, `.env.example`: hosting/environment starting points.

## Outstanding before a true launch

Verified Maryland license number; domain; company phone/email; production database; secure dispatch admin credentials; webhook/email alert configuration; privacy/terms review; end-to-end test on the actual Render deployment. Consider whether the public company identity is Citywide or a distinct licensed operator and align all marketing accordingly.


## Competitor-style SEO addition (Angi / Thumbtack research)

Keyword strategy uses **publicly visible, generic locksmith search intents** similar to the terms seen on Angi and Thumbtack, not access to their private advertising keyword lists. Brand keywords and competitor names are intentionally **not added** to customer-facing SEO copy.

- Added 8 unique, indexable locksmith service explainers at `/services/...`, with original descriptive titles, meta descriptions, useful FAQs, service-area context and links back to the request form.
- Added a service-link grid on the home page and preserved one-click request cards.
- Service links select the appropriate approved job in the three-step form, without automatically submitting customer information.
- Added 122 keyword targets to `seo-keywords.csv`, organized by intent and landing-page suggestion. These are keyword *ideas*, not validated volume, rankings, ad placements or Google's Keyword Planner data.
- Added `robots.txt` and a dynamically generated `sitemap.xml`. Set `SITE_URL=https://your-real-verified-domain.example` for live sitemap. Never publish this placeholder.
- No fabricated ratings, verified providers, 24-hour dispatch guarantees or live-availability statements.
- Service pages are designed to be substantively different by job intent, rather than thin city doorway pages or keyword stuffing.
- No Google Ads, Local Services Ads, GitHub repository, Render deployment or domain has been changed.

After setting SITE_URL and deploying, submit `https://your-domain/sitemap.xml` to Google Search Console, then confirm crawler access and indexing. An updated website alone does not guarantee ranking or lead volume.
