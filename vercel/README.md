# ajaia-Gowrisankar

This Vercel project hosts the document editor and a server-side API proxy. The persistent document service remains on Cloudflare Workers/D1 through the existing Sites deployment. This avoids moving data into Vercel's temporary filesystem.

The app supports document creation, renaming, formatting, save/reopen, plain-text import, Google sign-in, and sharing by email. For a new deployment, configure GOOGLE_CLIENT_ID on the backend. Once deployed, add the final Vercel origin to that Google web client's authorized JavaScript origins. See `../backend/GOOGLE_SETUP.md`.

## Deploy

From this folder, run `npx vercel --prod`. Select your Vercel account and create the project `ajaia-gowrisankar`. Use the Other framework preset and the included configuration. No environment secret is required for this frontend proxy; Google credentials are configured on the document backend.

Run `npm test` for the proxy security checks. Full editor/backend tests are included in the backend source package.

The proxy accepts only known app routes, checks request origins, forwards only application session/challenge cookies, and preserves secure session cookies. It does not forward Vercel authentication cookies to the backend.
