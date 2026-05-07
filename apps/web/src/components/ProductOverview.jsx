import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Boxes, ShieldCheck } from 'lucide-react';

export default function ProductOverview({ products, selectedId, onSelect, compact = false }) {
  if (!products.length) {
    return <div className="empty-state">No products match the filters.</div>;
  }
  const visibleProducts = compact ? products.slice(0, 8) : products;
  return (
    <div className="product-grid">
      {visibleProducts.map((product, index) => (
        <motion.button
          type="button"
          className={`product-card ${selectedId === product.id ? 'active' : ''}`}
          key={product.id}
          onClick={() => onSelect(product)}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
        >
          <div className="product-image-wrap">
            {product.image_url && <img src={product.image_url} alt={product.title} loading="eager" decoding="async" referrerPolicy="no-referrer" />}
            <span className={`health-pill ${product.health_status}`}>{product.health_status}</span>
          </div>
          <div className="product-body">
            <div className="product-title-row">
              <h3>{product.title}</h3>
              <ArrowRight size={18} />
            </div>
            <div className="meta-grid">
              <span>ASIN <b>{product.asin}</b></span>
              <span>SKU <b>{product.sku}</b></span>
              <span>Parent <b>{product.parent_asin}</b></span>
              <span>Market <b>{product.marketplace_code}</b></span>
            </div>
            <div className="product-signals">
              <span><Boxes size={15} /> {product.top10_kw || 0} top 10</span>
              <span><ShieldCheck size={15} /> {product.tracked_keywords || product.keyword_count || 0} keywords</span>
              <span><AlertTriangle size={15} /> {(product.top50_sv || 0).toLocaleString()} SV</span>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
