import { ApiError } from './errors.js';
import { proxyToPython } from './proxy.js';

function assertMethod(req, expected) {
  if (req.method !== expected) throw new ApiError(405, `Method ${req.method} not allowed. Use ${expected}.`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new ApiError(413, 'Request body too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new ApiError(400, 'Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function qs(url) {
  return url.search || '';
}

export async function routeRequest(req, config) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path === '/api/health') {
    assertMethod(req, 'GET');
    const worker = await proxyToPython(config, '/health');
    return { ok: true, service: 'rankradar-api', worker };
  }

  if (path === '/api/datadive/status') {
    assertMethod(req, 'GET');
    return proxyToPython(config, '/datadive/status');
  }

  if (path === '/api/datadive/test-connection') {
    assertMethod(req, 'POST');
    return proxyToPython(config, '/datadive/test-connection', { method: 'POST' });
  }

  const rankRadarMap = [
    ['/api/rank-radar/brands', '/rank-radar/brands'],
    ['/api/rank-radar/marketplaces', '/rank-radar/marketplaces'],
    ['/api/rank-radar/products', '/rank-radar/products'],
    ['/api/rank-radar/alerts', '/rank-radar/alerts'],
    ['/api/rank-radar/alert-rules', '/rank-radar/alert-rules'],
    ['/api/rank-radar/sync-runs', '/rank-radar/sync-runs'],
  ];

  for (const [apiPath, workerPath] of rankRadarMap) {
    if (path === apiPath) {
      if (req.method === 'GET') return proxyToPython(config, `${workerPath}${qs(url)}`);
      if (req.method === 'POST') return proxyToPython(config, `${workerPath}${qs(url)}`, { method: 'POST', body: await readBody(req) });
    }
  }

  if (path === '/api/rank-radar/sync') {
    assertMethod(req, 'POST');
    return proxyToPython(config, `/rank-radar/sync${qs(url)}`, { method: 'POST' });
  }

  const productMatch = path.match(/^\/api\/rank-radar\/products\/([^/]+)$/);
  if (productMatch) {
    assertMethod(req, 'GET');
    return proxyToPython(config, `/rank-radar/products/${productMatch[1]}${qs(url)}`);
  }

  const summaryMatch = path.match(/^\/api\/rank-radar\/products\/([^/]+)\/summary$/);
  if (summaryMatch) {
    assertMethod(req, 'GET');
    return proxyToPython(config, `/rank-radar/products/${summaryMatch[1]}/summary${qs(url)}`);
  }

  const keywordsMatch = path.match(/^\/api\/rank-radar\/products\/([^/]+)\/keywords$/);
  if (keywordsMatch) {
    assertMethod(req, 'GET');
    return proxyToPython(config, `/rank-radar/products/${keywordsMatch[1]}/keywords${qs(url)}`);
  }

  const trendMatch = path.match(/^\/api\/rank-radar\/products\/([^/]+)\/keywords\/([^/]+)\/trend$/);
  if (trendMatch) {
    assertMethod(req, 'GET');
    return proxyToPython(config, `/rank-radar/products/${trendMatch[1]}/keywords/${trendMatch[2]}/trend${qs(url)}`);
  }

  const variationsMatch = path.match(/^\/api\/rank-radar\/products\/([^/]+)\/keywords\/([^/]+)\/variations$/);
  if (variationsMatch) {
    assertMethod(req, 'GET');
    return proxyToPython(config, `/rank-radar/products/${variationsMatch[1]}/keywords/${variationsMatch[2]}/variations${qs(url)}`);
  }

  const alertActionMatch = path.match(/^\/api\/rank-radar\/alerts\/([^/]+)\/(acknowledge|resolve)$/);
  if (alertActionMatch) {
    assertMethod(req, 'POST');
    return proxyToPython(config, `/rank-radar/alerts/${alertActionMatch[1]}/${alertActionMatch[2]}`, { method: 'POST' });
  }

  const alertRuleMatch = path.match(/^\/api\/rank-radar\/alert-rules\/([^/]+)$/);
  if (alertRuleMatch) {
    if (req.method !== 'PATCH') throw new ApiError(405, 'Only PATCH is allowed for an alert rule resource');
    return proxyToPython(config, `/rank-radar/alert-rules/${alertRuleMatch[1]}`, { method: 'PATCH', body: await readBody(req) });
  }

  throw new ApiError(404, `Route not found: ${path}`);
}
