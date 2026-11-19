# Nationwide Leads Network — mobile app starter

React Native / Expo, iOS and Android. Isolated from the existing static website.

## Run the preview
Install Node.js 20.19+ and run from this folder:
```
npm install
npx expo install --fix
npx expo-doctor
npx expo start
```
SDK 54 is intentionally used for the iOS App Store version of Expo Go. Scan the QR code with your iPhone camera or Android Expo Go (compatible SDK required). Use a current SDK and an EAS development build for production before submitting to stores. Package identifiers are proposals and must be claimed in the developer accounts.

## Included
Native Home, Services, Leads, Orders, Account tabs, customer/provider/admin preview modes, service request drafts with validation, delete drafts, and links to the existing NLN website. Drafts exist only in memory, never send to a server, and disappear when the app closes. Preview roles are not secure authorization.

## Production gates
- Confirm dedicated NLN API and database; implement account creation, login, deletion, and server-enforced roles.
- Add real requests, provider onboarding, lead consent/assignment, order status, notifications and support.
- Verify NLN payment isolation, webhook signatures, idempotency and Apple/Google payment policies before enabling any in-app purchase or payment links.
- Upgrade Expo and validate native builds; create branded icons, privacy policy, permissions, terms, store listings, test on real devices.
- Do not store secrets or personal data in the public repository. Website is currently a static preview; no production NLN API was verified.
- App source only; no native binaries generated or store submissions made.
