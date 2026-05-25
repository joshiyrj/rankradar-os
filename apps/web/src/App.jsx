import { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { api } from './api.js';

// Pages
import Dashboard from '@/pages/Dashboard';
import RankRadar from '@/pages/RankRadar';
import Products from '@/pages/Products';
import Keywords from '@/pages/Keywords';
import Alerts from '@/pages/Alerts';
import Settings from '@/pages/Settings';

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

  async function runSync() {
    setSyncing(true);
    setSyncError('');
    try {
      await api.sync({ brandId: filters.brandId, marketplace: filters.marketplace });
      const [productRows, alertRows, syncRuns] = await Promise.all([
        api.products(filters),
        api.alerts({ ...filters, status: 'open' }),
        api.syncRuns().catch(() => []),
      ]);
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
            {view === 'dashboard' && <Dashboard {...sharedProps} />}
            {view === 'rank-radar' && <RankRadar {...sharedProps} />}
            {view === 'products' && <Products {...sharedProps} />}
            {view === 'keywords' && <Keywords {...sharedProps} />}
            {view === 'alerts' && <Alerts {...sharedProps} refreshAlerts={refreshAlerts} />}
            {view === 'settings' && <Settings />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
