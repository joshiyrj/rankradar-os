import { useMemo } from 'react';
import { Globe, AlertTriangle, Package, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';

const FLAG_MAP = {
  US: '🇺🇸', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸',
  IT: '🇮🇹', CA: '🇨🇦', JP: '🇯🇵', AU: '🇦🇺', MX: '🇲🇽',
  NL: '🇳🇱', SE: '🇸🇪',
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

function HealthBar({ criticalCount, totalCount }) {
  const pct = totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Critical product rate</span>
        <span className={cn(pct > 30 ? 'text-red-400' : pct > 0 ? 'text-yellow-400' : 'text-green-400')}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct > 30 ? 'bg-red-500' : pct > 0 ? 'bg-yellow-500' : 'bg-green-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MarketplaceCard({ marketplace, mktProducts }) {
  const flag = FLAG_MAP[marketplace.code] ?? '🌐';
  const totalKeywords = mktProducts.reduce((s, p) => s + (p.keyword_count || 0), 0);
  const totalTop10SV = mktProducts.reduce((s, p) => s + (p.top10_sv || 0), 0);
  const totalCritical = mktProducts.reduce((s, p) => s + (p.critical_alerts || 0), 0);
  const criticalProducts = mktProducts.filter((p) => p.health_status === 'critical').length;
  const brandNames = [...new Set(mktProducts.map((p) => p.brand_name).filter(Boolean))];
  const visibleBrands = brandNames.slice(0, 3);
  const hiddenCount = brandNames.length - visibleBrands.length;

  return (
    <motion.div variants={cardVariants}>
      <Card className="flex flex-col hover:border-border/80 transition-colors h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-3xl leading-none shrink-0" aria-label={marketplace.code}>
              {flag}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-foreground leading-tight">{marketplace.name}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {marketplace.code}
                </Badge>
              </div>
              {marketplace.amazon_domain && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {marketplace.amazon_domain}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-0">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Products</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{mktProducts.length}</p>
            </div>
            <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Keywords</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{totalKeywords.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Top 10 SV</p>
              <p className="text-sm font-semibold text-green-400 mt-0.5">{formatSV(totalTop10SV)}</p>
            </div>
            <div className="rounded-md bg-muted/30 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical</p>
              <p className={cn('text-sm font-semibold mt-0.5', totalCritical > 0 ? 'text-red-400' : 'text-foreground')}>
                {totalCritical}
              </p>
            </div>
          </div>

          {/* Health bar */}
          <HealthBar criticalCount={criticalProducts} totalCount={mktProducts.length} />

          {/* Brands in this marketplace */}
          {brandNames.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Brands</p>
              <div className="flex flex-wrap gap-1">
                {visibleBrands.map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[120px] truncate">
                    {name}
                  </Badge>
                ))}
                {hiddenCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{hiddenCount} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-4 w-1/3 mt-1" />
    </Card>
  );
}

export default function Marketplaces({ marketplaces = [], products = [], loading = false }) {
  const productsByMarketplace = useMemo(() => {
    const map = new Map();
    for (const mkt of marketplaces) {
      map.set(mkt.code, products.filter((p) => p.marketplace_code === mkt.code));
    }
    return map;
  }, [marketplaces, products]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Globe className="w-5 h-5" /> Marketplaces
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {marketplaces.length === 0
            ? 'No marketplaces found'
            : `${marketplaces.length} marketplace${marketplaces.length !== 1 ? 's' : ''} active`}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {marketplaces.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Globe className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No marketplaces found</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Run a DataDive sync to populate marketplace data.
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {marketplaces.map((mkt) => (
              <MarketplaceCard
                key={mkt.id}
                marketplace={mkt}
                mktProducts={productsByMarketplace.get(mkt.code) ?? []}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
