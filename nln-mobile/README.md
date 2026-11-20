# Nationwide Leads Network — Unified Marketplace & Business Solutions

React Native / Expo (iOS and Android) alongside a responsive browser demonstration in `../nln-preview/app.html`.

## Run the mobile preview
Install Node.js 20.19+ and run:

```bash
cd nln-mobile
npm install
npx expo install --fix
npx expo-doctor
npx expo start
```

Expo SDK 54 is used. Use a compatible Expo Go or development build. No App Store or Google Play builds have been published.

## Included in the app source
- A clear homepage with two distinct options: **NLN Marketplace** (hire a professional) and **NLN Business Solutions** (done-for-you websites and marketing).
- Marketplace: service categories, sample job request form with basic validation and request list.
- Provider view: sample lead opportunities filtered by category, quote entry, sample quote selection.
- Business Solutions: $199 / $399 / $699 / $999 / $1,999 / $3,995.50 setup packages and $99 / $299 / $499 per-month management packages.
- Business project inquiry drafts and an owner demo overview with counts for requests, inquiries and quotes.
- Customer / Provider / Admin **preview role switching** and editable demo profile fields.
- Payments are intentionally disabled. Advertising spend and third-party fees are separate.

## Important limits
The Expo app currently saves form entries **in app memory** only. They disappear when the app closes. No account authentication, actual registration, production permissions, real leads, provider matching, notification delivery, messaging or payments are connected. Preview role selection is **not a security boundary**.

The browser preview uses browser-local storage only, not a server. Anyone using that browser can switch to the Owner demo view. Do not enter real customer information during preview testing.

## Requirements before public launch
1. Implement a separately secured NLN API and database, real email verification and server-enforced customer / provider / owner roles. Never expose customer records in a public demo.
2. Connect matching, provider onboarding and verification, consent-based notifications, quote acceptance and job lifecycle, moderation, support and abuse protections.
3. Add privacy policy, terms, account deletion, analytics and monitoring; test all forms on mobile and desktop.
4. Connect payments **only when authorized later**, with appropriate verification, disclosures and platform-policy review.
5. Confirm hosting workspace, publish the website and app, run smoke tests, and verify real builds before store submission.
