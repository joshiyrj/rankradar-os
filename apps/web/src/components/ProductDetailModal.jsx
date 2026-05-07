import { Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BarChart3, Boxes, ExternalLink, SearchCheck, X } from 'lucide-react';
import Heatmap from './Heatmap.jsx';
import KeywordTable from './KeywordTable.jsx';
import ProductMetrics from './ProductMetrics.jsx';
import VariationPanel from './VariationPanel.jsx';

export default function ProductDetailModal({
  product,
  summary,
  keywords,
  selectedKeyword,
  onKeywordSelect,
  trend,
  variations,
  onClose,
  TrendChart,
}) {
  useEffect(() => {
    if (!product) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [product, onClose]);

  const rankCards = product ? [
    ['Keywords', product.keyword_count ?? summary?.trackedKeywords ?? keywords.length, <SearchCheck size={16} />],
    ['Top 10', product.top10_kw ?? summary?.top10KW ?? 0, <BarChart3 size={16} />],
    ['Top 50', product.top50_kw ?? summary?.top50KW ?? 0, <Boxes size={16} />],
    ['Top 50 SV', product.top50_sv ?? summary?.top50SV ?? 0, <AlertTriangle size={16} />],
  ] : [];
  const asinPayload = product?.raw_payload?.asin && typeof product.raw_payload.asin === 'object' ? product.raw_payload.asin : {};
  const variationAttributes = Array.isArray(asinPayload.variation_attributes) ? asinPayload.variation_attributes : [];
  const liveFields = product ? [
    ['DataDive ID', product.datadive_product_id],
    ['ASIN', product.asin],
    ['Parent', product.parent_asin],
    ['Marketplace', product.marketplace_code],
    ['Status', product.datadive_status],
    ['Keyword Count', product.keyword_count],
    ['Top 10 KW', product.top10_kw],
    ['Top 10 SV', product.top10_sv],
    ['Top 50 KW', product.top50_kw],
    ['Top 50 SV', product.top50_sv],
    ['Updated', product.updated_at || product.last_synced_at],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            className="product-modal glass"
            role="dialog"
            aria-modal="true"
            aria-label={`${product.title} rank details`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <div className="modal-product">
                {product.image_url && <img src={product.image_url} alt={product.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />}
                <div>
                  <span className="eyebrow">Live product</span>
                  <h2>{product.title}</h2>
                  <p>{product.asin} / {product.sku} / {product.marketplace_name || product.marketplace_code}</p>
                </div>
              </div>
              <div className="modal-actions">
                {product.product_url && (
                  <a className="icon-link" href={product.product_url} target="_blank" rel="noreferrer" aria-label="Open product">
                    <ExternalLink size={17} />
                  </a>
                )}
                <button className="icon-btn" type="button" onClick={onClose} aria-label="Close product details">
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="modal-rank-strip">
              {rankCards.map(([label, value, icon]) => (
                <div className="modal-rank-card" key={label}>
                  <span>{icon}{label}</span>
                  <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
                </div>
              ))}
              <div className={`modal-status ${product.health_status || 'stable'}`}>{product.health_status || product.datadive_status || 'active'}</div>
            </div>

            <div className="modal-content-grid">
              <div className="modal-main-col">
                <section className="panel live-rank-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">DataDive live rank</span>
                      <h2>Rank snapshot</h2>
                    </div>
                    <p>Only fields returned by DataDive are shown.</p>
                  </div>
                  <div className="live-rank-grid">
                    {liveFields.map(([label, value]) => (
                      <div className="live-rank-field" key={label}>
                        <span>{label}</span>
                        <b>{typeof value === 'number' ? value.toLocaleString() : String(value)}</b>
                      </div>
                    ))}
                    {variationAttributes.map((item) => (
                      <div className="live-rank-field" key={`${item.dimension}-${item.value}`}>
                        <span>{item.dimension}</span>
                        <b>{item.value}</b>
                      </div>
                    ))}
                  </div>
                </section>
                <KeywordTable rows={keywords} selectedKeywordId={selectedKeyword?.keyword_id} onSelect={onKeywordSelect} compact />
                <ProductMetrics product={product} summary={summary} />
                {trend.length > 0 && (
                  <Suspense fallback={<div className="panel chart-loading">Loading chart</div>}>
                    <TrendChart data={trend} />
                  </Suspense>
                )}
              </div>
              <aside className="modal-side-col">
                {summary?.heatmap?.length > 0 && <Heatmap data={summary.heatmap} />}
                {variations.length > 0 && <VariationPanel rows={variations} />}
              </aside>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
