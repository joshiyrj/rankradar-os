import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import Brands from '@/pages/Brands';
import Marketplaces from '@/pages/Marketplaces';
import SyncLogs from '@/pages/SyncLogs';
import Reports from '@/pages/Reports';
import Watchlist from '@/pages/Watchlist';

const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function App() {
  const [view, setView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brands, setBrands] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brandId: '', marketplace: '' });

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

  // Keyboard shortcuts: R = sync, 1-6 = pages
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

  const openAlertCount = alerts.filter((a) => a.status === 'open').length;
  const sharedProps = {
    brands, marketplaces, products, alerts, filters, setFilters,
    onSync: runSync, syncing, loading,
    setView,
  };

  function renderPage() {
    switch (view) {
      case 'dashboard':    return <Dashboard {...sharedProps} />;
      case 'rank-radar':   return <RankRadar {...sharedProps} />;
      case 'products':     return <Products {...sharedProps} />;
      case 'keywords':     return <Keywords {...sharedProps} />;
      case 'alerts':       return <Alerts />;
      case 'settings':     return <Settings />;
      case 'brands':       return <Brands brands={brands} products={products} loading={loading} />;
      case 'marketplaces': return <Marketplaces marketplaces={marketplaces} products={products} loading={loading} />;
      case 'sync-logs':    return <SyncLogs onSync={runSync} syncing={syncing} />;
      case 'reports':      return <Reports brands={brands} products={products} alerts={alerts} loading={loading} />;
      case 'watchlist':    return <Watchlist products={products} loading={loading} setView={setView} />;
      default:             return null;
    }
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          view={view}
          setView={setView}
          alertCount={openAlertCount}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar
            view={view}
            onSync={runSync}
            syncing={syncing}
            lastSyncAt={lastSyncAt}
            syncError={syncError}
            onMenuOpen={() => setMobileMenuOpen(true)}
          />
          <main className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="h-full"
              >
                <ErrorBoundary key={view}>
                  {renderPage()}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
