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

export const api = {
  health: () => request('/api/health'),
  status: () => request('/api/datadive/status'),
  testConnection: () => request('/api/datadive/test-connection', { method: 'POST' }),
  sync: (params = {}) => request(`/api/rank-radar/sync?${new URLSearchParams(params)}`, { method: 'POST' }),
  brands: () => request('/api/rank-radar/brands'),
  marketplaces: (brandId) => request(`/api/rank-radar/marketplaces?${new URLSearchParams({ ...(brandId ? { brandId } : {}) })}`),
  products: (params) => request(`/api/rank-radar/products?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)))}`),
  product: (id) => request(`/api/rank-radar/products/${id}`),
  summary: (id) => request(`/api/rank-radar/products/${id}/summary`),
  keywords: (id, params = {}) => request(`/api/rank-radar/products/${id}/keywords?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)))}`),
  trend: (productId, keywordId) => request(`/api/rank-radar/products/${productId}/keywords/${keywordId}/trend`),
  variations: (productId, keywordId) => request(`/api/rank-radar/products/${productId}/keywords/${keywordId}/variations`),
  alerts: (params = {}) => request(`/api/rank-radar/alerts?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)))}`),
  acknowledge: (id) => request(`/api/rank-radar/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id) => request(`/api/rank-radar/alerts/${id}/resolve`, { method: 'POST' }),
  alertRules: () => request('/api/rank-radar/alert-rules'),
};
