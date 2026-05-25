import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Trash2, ExternalLink, PackageSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─── localStorage helpers (exported for use from Products page) ───────────
const LS_KEY = 'rankradar_watchlist';

export function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function toggleWatchlist(productId) {
  const list = getWatchlist();
  const idx = list.indexOf(productId);
  if (idx === -1) list.push(productId);
  else list.splice(idx, 1);
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  return list;
}

export function isWatchlisted(productId) {
  return getWatchlist().includes(productId);
}

// ─── animation variants ───────────────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.05, ease: 'easeOut' },
  }),
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -8,
    transition: { duration: 0.22, ease: 'easeIn' },
  },
};

const HEALTH_VARIANT = {
  critical: 'critical',
  watch: 'high',
  stable: 'positive',
  improving: 'positive',
};

// ─── ProductCard ──────────────────────────────────────────────────────────
function WatchlistCard({ product, onUnpin, index, removed }) {
  return (
    <motion.div
      key={product.id}
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <Card className={cn('h-full flex flex-col', removed && 'opacity-50 border-dashed')}>
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                {product.title || product.asin}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {product.brand_name}
                {product.marketplace_code && ` · ${product.marketplace_code}`}
              </p>
            </div>
            <button
              onClick={() => onUnpin(product.id)}
              className="shrink-0 text-yellow-400 hover:text-muted-foreground transition-colors"
              title="Remove from watchlist"
              aria-label="Unpin product"
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Removed notice */}
          {removed && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
              This product is no longer in your current data set.
            </p>
          )}

          {/* Metrics row */}
          {!removed && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/30 rounded p-2">
                <p className="text-muted-foreground">Top 10 SV</p>
                <p className="font-semibold text-green-400 text-sm mt-0.5">{formatSV(product.top10_sv)}</p>
              </div>
              <div className="bg-muted/30 rounded p-2">
                <p className="text-muted-foreground">Critical</p>
                <p className={cn('font-semibold text-sm mt-0.5', product.critical_alerts > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                  {product.critical_alerts > 0 ? product.critical_alerts : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          {!removed && (
            <div className="flex items-center justify-between mt-auto pt-1">
              <Badge
                variant={HEALTH_VARIANT[product.health_status] || 'secondary'}
                className="capitalize text-xs"
              >
                {product.health_status || 'unknown'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {timeAgo(product.last_synced_at)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────
export default function Watchlist({ products, loading }) {
  const [watchedIds, setWatchedIds] = useState(() => getWatchlist());

  // Sync from localStorage on mount and when storage changes (other tabs)
  useEffect(() => {
    function onStorage(e) {
      if (e.key === LS_KEY) setWatchedIds(getWatchlist());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleUnpin = useCallback((productId) => {
    const next = toggleWatchlist(productId);
    setWatchedIds([...next]);
  }, []);

  const handleClearAll = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setWatchedIds([]);
  }, []);

  // Split into: found in products list vs ghost (removed)
  const { watchedProducts, removedGhosts } = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const watched = [];
    const removed = [];
    watchedIds.forEach((id) => {
      if (productMap.has(id)) watched.push(productMap.get(id));
      else removed.push({ id, title: `Product ${id}`, removed: true });
    });
    return { watchedProducts: watched, removedGhosts: removed };
  }, [watchedIds, products]);

  const totalCount = watchedProducts.length + removedGhosts.length;

  // ── skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            Watchlist
          </h1>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-xs font-semibold">
              {totalCount}
            </Badge>
          )}
        </div>
        {totalCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </Button>
        )}
      </motion.div>

      {/* ── Empty state ── */}
      {totalCount === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center justify-center gap-4 py-20 text-center border border-dashed border-border rounded-xl"
        >
          <PackageSearch className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="text-base font-semibold text-foreground">Your watchlist is empty</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Pin products from the Products page to track them here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 mt-2"
            onClick={() => window.dispatchEvent(new CustomEvent('rankradar:navigate', { detail: 'products' }))}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Go to Products
          </Button>
        </motion.div>
      )}

      {/* ── Watched product grid ── */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {watchedProducts.map((product, i) => (
              <WatchlistCard
                key={product.id}
                product={product}
                onUnpin={handleUnpin}
                index={i}
                removed={false}
              />
            ))}
            {removedGhosts.map((ghost, i) => (
              <WatchlistCard
                key={ghost.id}
                product={ghost}
                onUnpin={handleUnpin}
                index={watchedProducts.length + i}
                removed
              />
            ))}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
