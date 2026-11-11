# Enable Google sign-in

Create or choose a project in Google Cloud Console, then open Google Auth Platform.

1. Configure branding with the app name **ajaia-Gowrisankar** and your support email.
2. Choose the appropriate audience. For an external app in testing, add both Google accounts you will use for the sharing demo as test users.
3. Open **Clients → Create client → Web application**.
4. Add this exact authorized JavaScript origin:

   `https://ajaia-gowrisankar.vercel.app`

5. For local testing, also add `http://localhost` and `http://localhost:8787`.
6. Copy the client ID ending in `.apps.googleusercontent.com`. Set it as the Sites runtime environment variable `GOOGLE_CLIENT_ID`, then redeploy the saved version. For local development, put `GOOGLE_CLIENT_ID=your-client-id` in an untracked `.dev.vars` file.

This integration uses Google's button with a JavaScript callback. It does not need a client secret or an authorized redirect URI. Do not paste your Google password or client secret into chat. Google may require additional branding or domain verification depending on your project and publishing status; follow the console's requirements rather than bypassing them.

The app requests basic sign-in identity only. It does not request Drive, Gmail, or Calendar access.

Official guide: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

Until the client ID is configured, the app shows a setup-pending message and does not allow document access. A real Google sign-in must still be verified after configuration.
