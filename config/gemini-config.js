// Gemini runtime config loader. Use a single file `config/api_gemini.js`
// to set `window.__GEMINI_CONFIG__` for Gemini auth.
// Do NOT commit actual API keys or secrets into source.
export function getGeminiRuntimeConfig() {
	return (typeof window !== 'undefined' && window.__GEMINI_CONFIG__) ? window.__GEMINI_CONFIG__ : {};
}

const runtimeGeminiConfig = getGeminiRuntimeConfig();

export const GEMINI_API_KEY = runtimeGeminiConfig.apiKey ? String(runtimeGeminiConfig.apiKey) : '';
export const GEMINI_MODEL = runtimeGeminiConfig.model ? String(runtimeGeminiConfig.model) : 'gemini-3.5-flash-lite';
export const GEMINI_PROVIDER = runtimeGeminiConfig.provider ? String(runtimeGeminiConfig.provider) : '';
export const GEMINI_AUTH_TYPE = runtimeGeminiConfig.authType ? String(runtimeGeminiConfig.authType) : '';

