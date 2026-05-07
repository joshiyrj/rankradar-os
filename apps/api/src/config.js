export function getConfig(env = process.env) {
  return {
    port: Number(env.API_PORT || 4000),
    pythonServiceUrl: env.PYTHON_SERVICE_URL || 'http://localhost:8001',
    allowedOrigins: (env.API_ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((item) => item.trim()).filter(Boolean),
    rateLimitPerMinute: Number(env.API_RATE_LIMIT_PER_MINUTE || 240),
  };
}
