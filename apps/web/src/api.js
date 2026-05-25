const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error || payload?.detail || `Request failed: ${response.status}`);
  }
  return payload;
}

function qs(params) {
  return new URLSearchParams(Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v))).toString();
}

export const api = {
  health: () => request('/api/health'),
  status: () => request('/api/datadive/status'),
  testConnection: () => request('/api/datadive/test-connection', { method: 'POST' }),

  sync: (params = {}) => request(`/api/rank-radar/sync?${qs(params)}`, { method: 'POST' }),
  syncRuns: () => request('/api/rank-radar/sync-runs'),

  brands: () => request('/api/rank-radar/brands'),
  marketplaces: (brandId) => request(`/api/rank-radar/marketplaces?${qs(brandId ? { brandId } : {})}`),

  products: (params) => request(`/api/rank-radar/products?${qs(params)}`),
  product: (id) => request(`/api/rank-radar/products/${id}`),
  summary: (id) => request(`/api/rank-radar/products/${id}/summary`),

  keywords: (id, params = {}) => request(`/api/rank-radar/products/${id}/keywords?${qs(params)}`),
  heatmap: (id, params = {}) => request(`/api/rank-radar/products/${id}/heatmap?${qs(params)}`),
  trend: (productId, keywordId) => request(`/api/rank-radar/products/${productId}/keywords/${keywordId}/trend`),
  variations: (productId, keywordId) => request(`/api/rank-radar/products/${productId}/keywords/${keywordId}/variations`),

  alerts: (params = {}) => request(`/api/rank-radar/alerts?${qs(params)}`),
  acknowledge: (id) => request(`/api/rank-radar/alerts/${id}/acknowledge`, { method: 'POST' }),
  review: (id) => request(`/api/rank-radar/alerts/${id}/review`, { method: 'POST' }),
  ignore: (id) => request(`/api/rank-radar/alerts/${id}/ignore`, { method: 'POST' }),
  resolve: (id) => request(`/api/rank-radar/alerts/${id}/resolve`, { method: 'POST' }),

  alertRules: () => request('/api/rank-radar/alert-rules'),
};
