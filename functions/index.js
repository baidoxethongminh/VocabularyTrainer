import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { requestGeminiVision } from './gemini-vision-provider.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

export const geminiVision = onRequest(
  {
    region: 'asia-southeast1',
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req, res) => {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
      return;
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY is not configured in Firebase Secret Manager.' });
      return;
    }

    const result = await requestGeminiVision({ ...req.body, apiKey });
    res.status(result.status).json(result.body);
  },
);
