# Architecture

ajaia-Gowrisankar uses a plain JavaScript frontend served by Vercel, a Vercel API proxy, a Cloudflare Worker API, and D1 SQL storage. One build embeds the frontend assets into the Worker. Drizzle defines the schema and generates deployment migrations.

Google Identity Services returns an ID token to the browser. The browser posts it to the API, which verifies its signature against Google's keys and validates its audience, issuer, expiration, nonce, and verified email. A short-lived, single-use challenge binds sign-in to the initiating browser. A stable Google subject identifies each user. The server then issues an HttpOnly session cookie; the Google token is not stored.

Documents store sanitized HTML, owner, title, timestamp, and version. Each document read or save checks ownership or an explicit sharing grant. Owners grant editing access by the email of a previously registered user. The API enforces permissions independently of the UI. It does not expose a global user directory.

Every save supplies the version that was opened. A conditional SQL update rejects stale versions with HTTP 409. Local content remains visible for recovery. This deliberately avoids the complexity of live merging.

The frontend escapes text imports; sanitize-html strips unsupported HTML and attributes on the server. Requests have size limits and mutations reject foreign origins. Controls lock during requests to prevent navigation races.

The original seeded-account model was replaced with Google accounts at the user's request. Demo login is disabled; old sample records are preserved but not reassigned to real users. The public hosting audience exposes the login page while the application protects document APIs.

Next priorities: add share revocation and conflict recovery, replace execCommand, then add rate limits and operational monitoring. Real-time coediting, comments, history, and richer imports remain deliberate scope cuts.
