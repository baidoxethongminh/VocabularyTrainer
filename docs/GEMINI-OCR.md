# Gemini OCR

Image OCR sends the selected image to the app's `/api/gemini/vision` endpoint.
The endpoint calls Gemini on the server, so users do not enter or expose an API
key in the browser. OCR requires an internet connection.

For local development, run the existing proxy server on port 3002 and configure
its local Gemini settings in `config/api_gemini.js`.

For Firebase Hosting, the Hosting rewrite routes `/api/gemini/vision` to the
`geminiVision` Cloud Function. Firebase Functions and Secret Manager require
the Blaze plan. From the project root, configure the server-side secret once
with `firebase functions:secrets:set GEMINI_API_KEY` and paste the key into the
interactive prompt. Then deploy the function and Hosting rewrite with
`firebase deploy --only functions:geminiVision,hosting`. Never put the key in
browser code or commit it.

The OCR model is `gemini-3.5-flash-lite`. Other vocabulary practice and locally
cached data remain available offline. AI Expansion is a separate feature and
continues to use its existing API route.
