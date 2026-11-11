# ajaia-Gowrisankar backend

A lightweight collaborative document editor with Google sign-in, rich-text formatting, text-file import, and sharing by email.

## Local setup

Requires Node.js 22.13+.

```sh
npm ci
npm run db:local
npm run dev
```

Open http://localhost:8787. Follow `GOOGLE_SETUP.md` to configure a Google web client ID. Without it, sign-in remains unavailable and document APIs stay protected. There are no demo account passwords or account-switching shortcuts.

```sh
npm run build
npm test
```

Tests use isolated local Worker/D1 instances and fixture sessions. They do not require a real Google account or a running dev server. Fixture users exist only inside the tests; there is no production test-login endpoint.

## Main flow

Sign in with Google. Create and rename a document, format its content, save, and reopen it after refreshing. Import `sample.txt` to create another editable document. Supported imports are UTF-8 `.txt` files up to 100,000 bytes; DOCX, Markdown, images, and attachments are out of scope.

To share, the recipient first signs in to ajaia-Gowrisankar with their Google account. The owner then enters that account's email in **Give edit access**. The document appears under **Shared with you** for the recipient. Only the owner can grant access. To demonstrate with two accounts, use separate browser profiles or sign out before signing in to the other account.

## Storage and deployment

A JavaScript Worker serves the UI and API. D1 stores documents, sharing grants, Google user identities, login challenges, and sessions. Local storage lives in `.wrangler/state`; production has a separate persistent database. Migrations are checked into `drizzle/` and applied by Sites during deployment.

Google ID tokens are verified server-side for signature, issuer, audience, expiration, nonce, and verified email. The stable Google subject identifies a user. Sessions use HttpOnly cookies. The old demo login route is disabled, and old demo sessions cannot access documents. Sample records from the previous demo version are not assigned to new Google accounts.

## Limits

Saving is explicit, with Ctrl/Cmd+S support. Conflicting saves are rejected rather than merged. Shared editing is not real-time coediting. The editor uses browser execCommand; replacing it with a maintained library is the next improvement. There is no share revocation, version history, deletion, email invitation delivery, or offline mode. Share recipients must sign in once before they can receive access.

See `GOOGLE_SETUP.md` when configuring a new environment. The deployed app uses the configured Google client; see `../DEPLOYMENT.md` for status.
