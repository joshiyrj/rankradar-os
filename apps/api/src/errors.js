export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

export function sendError(res, error, headers = {}) {
  const status = error?.status || 500;
  sendJson(res, status, {
    ok: false,
    error: error?.message || 'Internal server error',
    details: error?.details,
  }, headers);
}
