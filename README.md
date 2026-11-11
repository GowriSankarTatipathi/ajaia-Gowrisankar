# ajaia-Gowrisankar

A lightweight document editor with Google sign-in, rich-text formatting, persistent saving, text import, and shared editing by email.

Live app: https://ajaia-gowrisankar.vercel.app

## Source

- `vercel/`: deployed frontend, API proxy, configuration and proxy tests.
- `backend/`: Cloudflare Worker, D1 schema and migrations, local frontend, build scripts and backend tests.
- `ARCHITECTURE.md`: implementation decisions and limitations.
- `AI_WORKFLOW.md`: AI assistance and verification details.
- `DEPLOYMENT.md`: hosting and verification status.
- `SUBMISSION.md`: delivery checklist.
- `outputs/ajaia-Gowrisankar-Loom-Script.docx`: recording guide.

## Run locally

Requires Node.js 22.13 or newer. From backend, run:

```sh
npm ci
npm run db:local
npm run dev
```

Configure Google sign-in using `backend/GOOGLE_SETUP.md`, then open http://localhost:8787. See `backend/README.md` for the complete flow and limits.

## Check

From backend, run `npm run build && npm test`. From vercel, run `npm test`.

## Sharing

Both users sign in once with their Google accounts. The owner grants access using the recipient's email. Use separate browser profiles to demonstrate shared editing. Saving is explicit; this version does not merge live edits.
