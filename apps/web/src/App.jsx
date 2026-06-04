import { useCallback, useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { api } from './api.js';

// Pages
import Dashboard from '@/pages/Dashboard';
import RankRadar from '@/pages/RankRadar';
import Products from '@/pages/Products';
import Keywords from '@/pages/Keywords';
import Alerts from '@/pages/Alerts';
import Settings from '@/pages/Settings';

function StubPage({ view }) {
  const labels = {
    brands: 'Brands', marketplaces: 'Marketplaces',
    reports: 'Reports', watchlist: 'Watchlist', 'sync-logs': 'Sync & Logs',
  };
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-8">
      <p className="text-base font-semibold text-foreground">{labels[view] || view}</p>
      <p className="text-sm text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [brands, setBrands] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brandId: '', marketplace: '' });

  // Boot: load brands, marketplaces, products, alerts
  useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const [brandRows, allMarketplaces, productRows, alertRows, syncRuns] = await Promise.all([
          api.brands(),
          api.marketplaces(),
          api.products({}),
          api.alerts({ status: 'open' }),
          api.syncRuns().catch(() => []),
        ]);
        setBrands(brandRows);
        setMarketplaces(allMarketplaces);
        setProducts(productRows);
        setAlerts(alertRows);
        const lastSuccess = syncRuns.find((r) => r.status === 'success');
        if (lastSuccess) setLastSyncAt(lastSuccess.completed_at || lastSuccess.started_at);
      } catch (err) {
        console.error('Boot error:', err);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  // When brand filter changes, refresh marketplaces for that brand
  useEffect(() => {
    if (!filters.brandId) return;
    api.marketplaces(filters.brandId).then(setMarketplaces).catch(console.error);
  }, [filters.brandId]);

  // Keyboard shortcuts: R = sync, 1-6 = nav pages
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); runSync(); }
      const pageMap = { '1': 'dashboard', '2': 'rank-radar', '3': 'products', '4': 'keywords', '5': 'alerts', '6': 'settings' };
      if (pageMap[e.key]) setView(pageMap[e.key]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncing]);

  async function runSync() {
    setSyncing(true);
    setSyncError('');
    try {
      const result = await api.sync({ brandId: filters.brandId, marketplace: filters.marketplace });
      if (!result?.ok) {
        setSyncError(result?.error || result?.syncRun?.error_message || 'Sync failed — check Settings for details.');
        return;
      }
      // Refresh all data after successful sync (brands may have new niches)
      const [brandRows, allMarketplaces, productRows, alertRows, syncRuns] = await Promise.all([
        api.brands(),
        api.marketplaces(),
        api.products(filters),
        api.alerts({ ...filters, status: 'open' }),
        api.syncRuns().catch(() => []),
      ]);
      setBrands(brandRows);
      setMarketplaces(allMarketplaces);
      setProducts(productRows);
      setAlerts(alertRows);
      const lastSuccess = syncRuns.find((r) => r.status === 'success');
      if (lastSuccess) setLastSyncAt(lastSuccess.completed_at || lastSuccess.started_at);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function refreshAlerts(params = {}) {
    try {
      const rows = await api.alerts({ ...filters, status: 'open', ...params });
      setAlerts(rows);
    } catch (err) {
      console.error(err);
    }
  }

  const openAlertCount = alerts.filter((a) => a.status === 'open').length;
  const sharedProps = {
    brands,
    marketplaces,
    products,
    alerts,
    filters,
    setFilters,
    onSync: runSync,
    syncing,
    loading,
    refreshAlerts,
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar view={view} setView={setView} alertCount={openAlertCount} />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar
            view={view}
            onSync={runSync}
            syncing={syncing}
            lastSyncAt={lastSyncAt}
            syncError={syncError}
          />
          <main className="flex-1 overflow-auto">
            <ErrorBoundary key={view}>
              {view === 'dashboard' && <Dashboard {...sharedProps} />}
              {view === 'rank-radar' && <RankRadar {...sharedProps} />}
              {view === 'products' && <Products {...sharedProps} />}
              {view === 'keywords' && <Keywords {...sharedProps} />}
              {view === 'alerts' && <Alerts />}
              {view === 'settings' && <Settings />}
              {['brands', 'marketplaces', 'reports', 'watchlist', 'sync-logs'].includes(view) && (
                <StubPage view={view} />
              )}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
