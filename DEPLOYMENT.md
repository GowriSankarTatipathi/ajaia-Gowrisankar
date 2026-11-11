# Deployment

Live app: https://ajaia-gowrisankar.vercel.app

Vercel serves the frontend and API proxy. The existing Cloudflare Worker and D1 deployment provides the persistent backend. Google sign-in is configured. The user confirmed the application was working on November 10, 2026; this is user-reported verification, separate from automated tests.

To configure another environment, follow backend/GOOGLE_SETUP.md and vercel/README.md. Keep backend/.openai/hosting.json: the backend build copies this required hosting configuration.

Automated checks can be rerun with `npm run build && npm test` from backend and `npm test` from vercel. Backend tests use isolated Worker/D1 instances and test credentials; they do not perform live Google login.

Before submission, record the walkthrough, add its URL to backend/walkthrough-url.txt, and check reviewer access to the app and Google Drive folder.

Cleanup verification: the backend build, all three backend tests, and both proxy tests passed after reorganizing the source.
