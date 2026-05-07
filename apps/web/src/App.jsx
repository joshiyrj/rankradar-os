import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, BarChart3, Boxes, RefreshCcw, SearchCheck, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from './api.js';
import AlertsPanel from './components/AlertsPanel.jsx';
import FilterBar from './components/FilterBar.jsx';
import Heatmap from './components/Heatmap.jsx';
import KeywordTable from './components/KeywordTable.jsx';
import ProductOverview from './components/ProductOverview.jsx';
import ProductMetrics from './components/ProductMetrics.jsx';
import Skeleton from './components/Skeleton.jsx';
import StatCard from './components/StatCard.jsx';
import VariationPanel from './components/VariationPanel.jsx';
import Settings from './pages/Settings.jsx';

const TrendChart = lazy(() => import('./components/TrendChart.jsx'));

export default function App() {
  const [brands, setBrands] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [summary, setSummary] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [trend, setTrend] = useState([]);
  const [variations, setVariations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ brandId: '', marketplace: '', status: '', q: '' });

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError('');
      try {
        const [brandRows, marketplaceRows] = await Promise.all([api.brands(), api.marketplaces()]);
        setBrands(brandRows);
        setMarketplaces(marketplaceRows);
        setFilters((current) => ({ ...current, brandId: '', marketplace: '' }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (!filters.brandId) return;
    api.marketplaces(filters.brandId).then((rows) => {
      setMarketplaces(rows);
      setFilters((current) => rows.some((row) => row.code === current.marketplace) ? current : { ...current, marketplace: '' });
    }).catch((err) => setError(err.message));
  }, [filters.brandId]);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError('');
      try {
        const [productRows, alertRows] = await Promise.all([
          api.products(filters),
          api.alerts({ brandId: filters.brandId, marketplace: filters.marketplace, status: 'open' }),
        ]);
        setProducts(productRows);
        setAlerts(alertRows);
        const next = selectedProduct && productRows.find((product) => product.id === selectedProduct.id) ? selectedProduct : productRows[0];
        setSelectedProduct(next || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [filters.brandId, filters.marketplace, filters.status]);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedProduct) return;
      setError('');
      try {
        const [summaryData, keywordRows] = await Promise.all([
          api.summary(selectedProduct.id),
          api.keywords(selectedProduct.id, { q: filters.q }),
        ]);
        setSummary(summaryData);
        setKeywords(keywordRows);
        const nextKeyword = selectedKeyword && keywordRows.find((row) => row.keyword_id === selectedKeyword.keyword_id) ? selectedKeyword : keywordRows[0];
        setSelectedKeyword(nextKeyword || null);
      } catch (err) {
        setError(err.message);
      }
    }
    loadDetail();
  }, [selectedProduct?.id, filters.q]);

  useEffect(() => {
    async function loadKeywordDeepDive() {
      if (!selectedProduct || !selectedKeyword) return;
      try {
        const [trendRows, variationRows] = await Promise.all([
          api.trend(selectedProduct.id, selectedKeyword.keyword_id),
          api.variations(selectedProduct.id, selectedKeyword.keyword_id),
        ]);
        setTrend(trendRows);
        setVariations(variationRows);
      } catch (err) {
        setError(err.message);
      }
    }
    loadKeywordDeepDive();
  }, [selectedProduct?.id, selectedKeyword?.keyword_id]);

  async function runSync() {
    setSyncing(true);
    setError('');
    try {
      await api.sync({ brandId: filters.brandId, marketplace: filters.marketplace });
      const [productRows, alertRows] = await Promise.all([
        api.products(filters),
        api.alerts({ brandId: filters.brandId, marketplace: filters.marketplace, status: 'open' }),
      ]);
      setProducts(productRows);
      setAlerts(alertRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function changeAlert(id, action) {
    try {
      if (action === 'ack') await api.acknowledge(id);
      if (action === 'resolve') await api.resolve(id);
      setAlerts(await api.alerts({ brandId: filters.brandId, marketplace: filters.marketplace, status: 'open' }));
    } catch (err) {
      setError(err.message);
    }
  }

  const topStats = useMemo(() => {
    const criticalProducts = products.filter((product) => product.health_status === 'critical').length;
    return {
      products: products.length,
      keywords: selectedProduct?.keyword_count || summary?.trackedKeywords || 0,
      improved: summary?.improved || 0,
      declined: summary?.declined || 0,
      critical: alerts.filter((alert) => alert.severity === 'critical').length || criticalProducts,
      avgChange: summary?.avgRankChange || 0,
    };
  }, [products, summary, alerts]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><Sparkles size={20} /><span>RankRadar</span></div>
        <nav>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><BarChart3 size={17} /> Overview</button>
          <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}><Boxes size={17} /> Products</button>
          <button className={view === 'alerts' ? 'active' : ''} onClick={() => setView('alerts')}><AlertTriangle size={17} /> Alerts</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}><Activity size={17} /> Settings</button>
        </nav>
        <div className="side-note">{products.length} products / {alerts.length} alerts</div>
      </aside>

      <main>
        <header className="hero">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <span className="eyebrow">DataDive live</span>
            <h1>Rank radar console</h1>
            <p>Products, keywords, movement, PPC, and alerts in one compact workspace.</p>
          </motion.div>
          <button className="ghost-btn" onClick={runSync} disabled={syncing}><RefreshCcw size={17} /> {syncing ? 'Syncing' : 'Refresh'}</button>
        </header>

        {error && <div className="error-box">{error}</div>}

        <AnimatePresence mode="wait">
        {view === 'settings' && <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><Settings /></motion.div>}

        {view !== 'settings' && (
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <FilterBar brands={brands} marketplaces={marketplaces} filters={filters} setFilters={setFilters} onSync={runSync} loading={syncing} />

            {loading ? <Skeleton lines={5} /> : (
              <>
                <section className="stats-grid">
                  <StatCard label="Products" value={topStats.products} hint="visible" icon={<SearchCheck size={17} />} />
                  <StatCard label="Keywords" value={topStats.keywords} hint="selected" icon={<BarChart3 size={17} />} />
                  <StatCard label="Top 10" value={selectedProduct?.top10_kw || 0} hint="keywords" tone="positive" icon={<TrendingUp size={17} />} />
                  <StatCard label="Top 50" value={selectedProduct?.top50_kw || 0} hint="keywords" tone="warning" icon={<TrendingDown size={17} />} />
                  <StatCard label="Top 50 SV" value={(selectedProduct?.top50_sv || 0).toLocaleString()} hint="search volume" tone="critical" icon={<AlertTriangle size={17} />} />
                </section>

                {(view === 'dashboard' || view === 'products') && (
                  <>
                    <ProductOverview products={products} selectedId={selectedProduct?.id} onSelect={setSelectedProduct} compact={view === 'dashboard'} />
                    {selectedProduct && (
                      <section className="detail-grid">
                        <div className="detail-main">
                          <div className="product-hero panel">
                            {selectedProduct.image_url && <img src={selectedProduct.image_url} alt={selectedProduct.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />}
                            <div>
                              <span className="eyebrow">Selected product</span>
                              <h2>{selectedProduct.title}</h2>
                              <p>{selectedProduct.asin} / {selectedProduct.sku} / {selectedProduct.marketplace_name}</p>
                            </div>
                          </div>
                          <KeywordTable rows={keywords} selectedKeywordId={selectedKeyword?.keyword_id} onSelect={setSelectedKeyword} />
                          <ProductMetrics product={selectedProduct} summary={summary} />
                          {trend.length > 0 && (
                            <Suspense fallback={<div className="panel chart-loading">Loading chart</div>}>
                              <TrendChart data={trend} />
                            </Suspense>
                          )}
                        </div>
                        <div className="detail-side">
                          {summary?.heatmap?.length > 0 && <Heatmap data={summary.heatmap} />}
                          {variations.length > 0 && <VariationPanel rows={variations} />}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {view === 'alerts' && <AlertsPanel alerts={alerts} onAcknowledge={(id) => changeAlert(id, 'ack')} onResolve={(id) => changeAlert(id, 'resolve')} />}
              </>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}
