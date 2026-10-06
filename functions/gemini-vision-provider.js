const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BASE64_LENGTH = 12 * 1024 * 1024;

export async function requestGeminiVision({
  apiKey,
  imageBase64,
  mimeType,
  prompt,
  model,
}) {
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    return { status: 400, body: { error: 'Missing imageBase64.' } };
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      status: 413,
      body: { error: 'Image is too large. Choose an image smaller than 9 MB.' },
    };
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return {
      status: 503,
      body: { error: 'Gemini API key is not configured on the server.' },
    };
  }

  const safeMimeType = typeof mimeType === 'string' && /^image\/[a-z0-9.+-]+$/i.test(mimeType)
    ? mimeType
    : 'image/png';
  const selectedModel = typeof model === 'string' && /^[a-zA-Z0-9._-]+$/.test(model)
    ? model
    : DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(selectedModel)}:generateContent`;

  try {
    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: typeof prompt === 'string'
                ? prompt
                : 'Read the vocabulary flashcard image and return its visible vocabulary fields as JSON.',
            },
            { inline_data: { mime_type: safeMimeType, data: imageBase64 } },
          ],
        }],
      }),
    });

    const responseText = await providerResponse.text();
    let providerData;
    try {
      providerData = JSON.parse(responseText);
    } catch {
      return { status: 502, body: { error: 'Gemini returned a non-JSON response.' } };
    }

    if (!providerResponse.ok) {
      return {
        status: providerResponse.status,
        body: {
          ok: false,
          status: providerResponse.status,
          provider: 'google',
          errorCode: providerData?.error?.code || '',
          errorStatus: providerData?.error?.status || '',
          error: providerData?.error?.message || 'Gemini Vision request failed.',
          providerResponse: providerData,
        },
      };
    }

    return { status: 200, body: providerData };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: error instanceof Error ? error.message : 'Gemini Vision request failed.',
      },
    };
  }
}
