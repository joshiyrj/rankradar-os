import { ApiError } from './errors.js';

export async function proxyToPython(config, path, { method = 'GET', body = undefined } = {}) {
  const url = `${config.pythonServiceUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(502, 'Python service returned a non-JSON response', { status: response.status, text: text.slice(0, 300) });
  }
  if (!response.ok) {
    throw new ApiError(response.status, payload?.detail || payload?.error || 'Python service error', payload);
  }
  return payload;
}
