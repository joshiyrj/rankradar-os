import http from 'node:http';
import { getConfig } from './config.js';
import { sendError, sendJson } from './errors.js';
import { rateLimit } from './rateLimit.js';
import { routeRequest } from './router.js';

const config = getConfig();

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

export function createServer(customConfig = config) {
  return http.createServer(async (req, res) => {
    const headers = corsHeaders(req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    try {
      if (!rateLimit(req, customConfig.rateLimitPerMinute)) {
        sendJson(res, 429, { ok: false, error: 'Rate limit exceeded' }, headers);
        return;
      }
      const payload = await routeRequest(req, customConfig);
      sendJson(res, 200, payload, headers);
    } catch (error) {
      sendError(res, error, headers);
    }
  });
}

if (process.argv[1]?.endsWith('server.js')) {
  createServer(config).listen(config.port, () => {
    console.log(`RankRadar API listening on http://localhost:${config.port}`);
    console.log(`Proxying Python service at ${config.pythonServiceUrl}`);
  });
}
