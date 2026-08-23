/**
 * OpenRouter image generation (chat/completions + modalities: ["image"]).
 * Default model: bytedance-seed/seedream-4.5
 */

export const GT3_DEFAULT_OPENROUTER_IMAGE_MODEL =
  process.env.GT3_OPENROUTER_IMAGE_MODEL || 'bytedance-seed/seedream-4.5';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {unknown} data
 * @returns {string | null} data URL or raw base64-bearing string
 */
export function extractFirstImageFromOpenRouterResponse(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) return null;

  const images = message.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    const url =
      first?.image_url?.url ||
      first?.imageUrl?.url ||
      (typeof first?.url === 'string' ? first.url : null);
    if (url) return url;
  }

  const content = message.content;
  if (typeof content === 'string' && /data:image\//i.test(content)) {
    return content;
  }

  return null;
}

/**
 * Normalize to PNG base64 (no data-URL prefix) for ODD SPA contract.
 * @param {string} imagePayload
 * @returns {string}
 */
export function imagePayloadToPngBase64(imagePayload) {
  const raw = String(imagePayload || '').trim();
  const m = raw.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
  if (m) return m[1].replace(/\s+/g, '');
  return raw.replace(/\s+/g, '');
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.prompt User-facing image prompt (narrative to visualize).
 * @param {string} [opts.system] Optional system-style instructions prepended.
 * @param {string} [opts.model]
 * @param {object} [opts.imageConfig] OpenRouter image_config (aspect_ratio, image_size, …)
 * @returns {Promise<{ imageDataUrl: string, pngBase64: string, model: string, raw: object }>}
 */
export async function openRouterGenerateImage(opts) {
  const apiKey = opts.apiKey;
  if (!apiKey) {
    const err = new Error('OpenRouter API key is required for image generation');
    err.name = 'ConfigError';
    throw err;
  }

  const model = opts.model || GT3_DEFAULT_OPENROUTER_IMAGE_MODEL;
  const system = typeof opts.system === 'string' ? opts.system.trim() : '';
  const prompt = String(opts.prompt || '').trim();
  if (!prompt) {
    throw new Error('Image generation prompt must be non-empty');
  }

  const userContent = system
    ? `${system}\n\n---\n\n${prompt}`
    : prompt;

  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
    modalities: ['image'],
    stream: false
  };

  if (opts.imageConfig && typeof opts.imageConfig === 'object') {
    body.image_config = opts.imageConfig;
  }

  const resp = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(process.env.GT3_HTTP_REFERER
        ? { 'HTTP-Referer': process.env.GT3_HTTP_REFERER }
        : {}),
      'X-Title': 'GT3 ODD Image'
    },
    body: JSON.stringify(body)
  });

  const bodyText = await resp.text();
  if (!resp.ok) {
    const err = new Error(
      `OpenRouter image upstream error (status=${resp.status})`
    );
    err.name = 'LlmUpstreamError';
    err.provider = 'openrouter';
    err.upstreamStatus = resp.status;
    err.upstreamBodyPreview = bodyText.slice(0, 600);
    throw err;
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (_) {
    throw new Error('OpenRouter image response was not valid JSON');
  }

  const imageDataUrl = extractFirstImageFromOpenRouterResponse(data);
  if (!imageDataUrl) {
    throw new Error(
      'OpenRouter image response had no images[] payload: ' +
        bodyText.slice(0, 400)
    );
  }

  const pngBase64 = imagePayloadToPngBase64(imageDataUrl);
  if (!pngBase64) {
    throw new Error('OpenRouter image payload was empty after normalization');
  }

  return {
    imageDataUrl,
    pngBase64,
    model,
    raw: data
  };
}
