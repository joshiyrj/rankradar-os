import { useMemo } from 'react';
import { Boxes, Tag, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';

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

function BrandCard({ brand, brandProducts }) {
  const totalTop10SV = brandProducts.reduce((s, p) => s + (p.top10_sv || 0), 0);
  const totalKeywords = brandProducts.reduce((s, p) => s + (p.keyword_count || 0), 0);
  const totalCritical = brandProducts.reduce((s, p) => s + (p.critical_alerts || 0), 0);
  const totalOpen = brandProducts.reduce((s, p) => s + (p.open_alerts || 0), 0);
  const marketplaces = [...new Set(brandProducts.map((p) => p.marketplace_code).filter(Boolean))];
  const lastSynced = brandProducts.map((p) => p.last_synced_at).filter(Boolean).sort().pop();

  return (
    <motion.div variants={cardVariants}>
      <Card className="flex flex-col gap-0 hover:border-border/80 transition-colors h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground leading-tight truncate">{brand.name}</p>
              <code className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 mt-1 inline-block">
                {brand.datadive_brand_id}
              </code>
            </div>
            <Boxes className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-0">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/30 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Products</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{brandProducts.length}</p>
            </div>
            <div className="rounded-md bg-muted/30 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Keywords</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{totalKeywords.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-muted/30 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Top 10 SV</p>
              <p className="text-sm font-semibold text-green-400 mt-0.5">{formatSV(totalTop10SV)}</p>
            </div>
          </div>

          {/* Alert status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {totalCritical > 0 && (
              <Badge variant="critical" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {totalCritical} critical
              </Badge>
            )}
            {totalOpen > 0 && (
              <Badge variant="medium" className="gap-1">
                {totalOpen} open
              </Badge>
            )}
            {totalCritical === 0 && totalOpen === 0 && (
              <Badge variant="positive">All clear</Badge>
            )}
          </div>

          {/* Marketplace badges */}
          {marketplaces.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {marketplaces.map((code) => (
                <Badge key={code} variant="outline" className="text-[10px] px-1.5 py-0">
                  {code}
                </Badge>
              ))}
            </div>
          )}

          {/* Last synced */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-auto pt-1 border-t border-border/50">
            <Clock className="w-3 h-3 shrink-0" />
            <span>Synced {timeAgo(lastSynced)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3.5 w-2/5 mt-auto" />
    </Card>
  );
}

export default function Brands({ brands = [], products = [], loading = false }) {
  const productsByBrand = useMemo(() => {
    const map = new Map();
    for (const brand of brands) {
      map.set(brand.id, []);
    }
    for (const product of products) {
      const key = brands.find(
        (b) => b.id === product.brand_id || b.name === product.brand_name
      )?.id;
      if (key != null) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(product);
      }
    }
    return map;
  }, [brands, products]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="w-5 h-5" /> Brands
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {brands.length === 0
              ? 'No brands synced yet'
              : `${brands.length} brand${brands.length !== 1 ? 's' : ''} monitored`}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {brands.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Boxes className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No brands synced yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Run a DataDive sync to populate brands.
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {brands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                brandProducts={productsByBrand.get(brand.id) ?? []}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
