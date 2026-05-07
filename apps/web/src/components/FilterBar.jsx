import { Search, SlidersHorizontal } from 'lucide-react';

export default function FilterBar({ brands, marketplaces, filters, setFilters, onSync, loading }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <section className="filter-bar glass">
      <div className="filter-title"><SlidersHorizontal size={17} /> Filters</div>
      <label>
        Brand
        <select value={filters.brandId || ''} onChange={(event) => update('brandId', event.target.value)}>
          <option value="">All brands</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
      </label>
      <label>
        Marketplace
        <select value={filters.marketplace || ''} onChange={(event) => update('marketplace', event.target.value)}>
          <option value="">All marketplaces</option>
          {marketplaces.map((marketplace) => <option key={marketplace.id} value={marketplace.code}>{marketplace.name}</option>)}
        </select>
      </label>
      <label>
        Health
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="critical">Critical</option>
          <option value="watch">Watch</option>
          <option value="stable">Stable</option>
        </select>
      </label>
      <label className="search-label">
        Search
        <span className="search-box"><Search size={16} /><input value={filters.q || ''} onChange={(event) => update('q', event.target.value)} placeholder="keyword..." /></span>
      </label>
      <button className="primary-btn" onClick={onSync} disabled={loading}>{loading ? 'Syncing' : 'Sync'}</button>
    </section>
  );
}
