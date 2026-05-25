import { useMemo } from 'react';
import { Download, FileText, TrendingUp, AlertTriangle, Boxes, SearchCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── animation variants ────────────────────────────────────────────────────
const fadeSlide = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: 'easeOut' },
  }),
};

const HEALTH_COLOR = {
  critical: 'bg-red-500',
  watch: 'bg-yellow-400',
  stable: 'bg-green-500',
  improving: 'bg-green-400',
  unknown: 'bg-muted',
};

const HEALTH_TEXT = {
  critical: 'text-red-300',
  watch: 'text-yellow-300',
  stable: 'text-green-300',
  improving: 'text-green-400',
  unknown: 'text-muted-foreground',
};

const SEVERITY_VARIANT = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  positive: 'positive',
};

const SEVERITY_COLORS = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#facc15',
  low: '#60a5fa',
  positive: '#4ade80',
};

// ─── helpers ───────────────────────────────────────────────────────────────
function exportCSV(rows, filename, headers, rowFn) {
  const lines = rows.map(rowFn).map((cells) =>
    cells.map((c) => JSON.stringify(c ?? '')).join(',')
  );
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportProducts(products) {
  exportCSV(
    products,
    'rankradar-products.csv',
    ['Title', 'ASIN', 'Brand', 'Marketplace', 'Keywords', 'Top10 KW', 'Top10 SV', 'Top50 KW', 'Top50 SV', 'Critical Alerts', 'Open Alerts', 'Health', 'Last Synced'],
    (p) => [
      p.title, p.asin, p.brand_name, p.marketplace_code,
      p.keyword_count, p.top10_kw, p.top10_sv, p.top50_kw, p.top50_sv,
      p.critical_alerts, p.open_alerts, p.health_status, p.last_synced_at,
    ]
  );
}

function exportAlerts(alerts) {
  exportCSV(
    alerts,
    'rankradar-alerts.csv',
    ['ID', 'Keyword', 'Severity', 'Type', 'Status', 'Detected At', 'Current Rank', 'Previous Rank', 'Marketplace', 'Product'],
    (a) => [
      a.id, a.keyword, a.severity, a.alert_type, a.status,
      a.detected_at, a.current_rank, a.previous_rank, a.marketplace_code, a.product_title,
    ]
  );
}

// ─── sub-components ────────────────────────────────────────────────────────
function KPICard({ title, value, icon: Icon, tone, index }) {
  const toneClass =
    tone === 'critical' ? 'text-red-400' :
    tone === 'positive' ? 'text-green-400' :
    tone === 'warning'  ? 'text-yellow-400' :
    'text-foreground';

  return (
    <motion.div variants={fadeSlide} custom={index} initial="hidden" animate="visible">
      <Card className="p-5 h-full">
        <div className="flex items-start justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>
        <p className={cn('text-2xl font-bold mt-2', toneClass)}>{value ?? '—'}</p>
      </Card>
    </motion.div>
  );
}

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, top10sv } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-0.5">{name}</p>
      <p className="text-muted-foreground">Top 10 SV: <span className="text-foreground font-semibold">{formatSV(top10sv)}</span></p>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────────────────
export default function Reports({ brands, products, alerts, loading }) {
  // ── derived data ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalKeywords = products.reduce((s, p) => s + (p.keyword_count || 0), 0);
    const openAlerts = alerts.filter((a) => a.status === 'open').length;
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    return { totalKeywords, openAlerts, criticalAlerts };
  }, [products, alerts]);

  const topProductsChart = useMemo(() =>
    [...products]
      .sort((a, b) => (b.top10_sv || 0) - (a.top10_sv || 0))
      .slice(0, 10)
      .map((p) => ({
        name: (p.title || p.asin || '').slice(0, 30),
        top10sv: p.top10_sv || 0,
        health: p.health_status,
      })),
    [products]
  );

  const alertsBySeverity = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, positive: 0 };
    alerts.forEach((a) => {
      if (a.severity in counts) counts[a.severity]++;
    });
    return counts;
  }, [alerts]);

  const healthCounts = useMemo(() => {
    const counts = { critical: 0, watch: 0, stable: 0, improving: 0, unknown: 0 };
    products.forEach((p) => {
      const h = p.health_status || 'unknown';
      if (h in counts) counts[h]++;
      else counts.unknown++;
    });
    return counts;
  }, [products]);

  const healthTotal = products.length || 1;

  const rankTable = useMemo(() =>
    [...products]
      .sort((a, b) => {
        const ca = b.critical_alerts || 0, cb = a.critical_alerts || 0;
        if (ca !== cb) return ca - cb;
        return (b.top10_sv || 0) - (a.top10_sv || 0);
      })
      .slice(0, 15),
    [products]
  );

  // ── skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // ── empty state ───────────────────────────────────────────────────────
  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center p-8">
        <FileText className="w-10 h-10 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">No data available</p>
        <p className="text-sm text-muted-foreground">Run a DataDive sync to populate reports.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">

      {/* ── 1. Summary KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard index={0} title="Total Products" value={products.length.toLocaleString()} icon={Boxes} />
        <KPICard index={1} title="Total Keywords" value={stats.totalKeywords.toLocaleString()} icon={SearchCheck} />
        <KPICard index={2} title="Open Alerts" value={stats.openAlerts.toLocaleString()} icon={AlertTriangle}
          tone={stats.openAlerts > 0 ? 'warning' : 'default'} />
        <KPICard index={3} title="Critical Alerts" value={stats.criticalAlerts.toLocaleString()} icon={AlertTriangle}
          tone={stats.criticalAlerts > 0 ? 'critical' : 'positive'} />
      </div>

      {/* ── 2. Top Products by Top 10 SV ── */}
      <motion.div variants={fadeSlide} custom={4} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top Products by Search Volume (Top 10)
            </CardTitle>
            <CardDescription>Sorted by Top 10 keyword search volume</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsChart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No products to display.</p>
            ) : (
              <ResponsiveContainer width="100%" height={topProductsChart.length * 40 + 20}>
                <BarChart
                  data={topProductsChart}
                  layout="vertical"
                  margin={{ top: 4, right: 64, bottom: 4, left: 8 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatSV(v)}
                    tick={{ fontSize: 10, fill: 'hsl(213 31% 60%)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={200}
                    tick={{ fontSize: 11, fill: 'hsl(213 31% 75%)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(222 47% 18% / 0.5)' }} />
                  <Bar dataKey="top10sv" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: 'hsl(213 31% 60%)', formatter: (v) => formatSV(v) }}>
                    {topProductsChart.map((entry, i) => (
                      <Cell key={i} fill="hsl(217 91% 60%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 3. Alert Breakdown by Severity ── */}
      <motion.div variants={fadeSlide} custom={5} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alert Breakdown by Severity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(alertsBySeverity).map(([severity, count]) => (
                <div key={severity} className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: SEVERITY_COLORS[severity] }}>{count}</p>
                  <Badge variant={SEVERITY_VARIANT[severity]} className="mt-2 capitalize">{severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 4. Product Health Distribution ── */}
      <motion.div variants={fadeSlide} custom={6} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle>Product Health Distribution</CardTitle>
            <CardDescription>{products.length} products tracked</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stacked percentage bar */}
            <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
              {healthCounts.critical > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(healthCounts.critical / healthTotal) * 100}%` }}
                  title={`Critical: ${healthCounts.critical}`}
                />
              )}
              {healthCounts.watch > 0 && (
                <div
                  className="bg-yellow-400 transition-all"
                  style={{ width: `${(healthCounts.watch / healthTotal) * 100}%` }}
                  title={`Watch: ${healthCounts.watch}`}
                />
              )}
              {healthCounts.stable > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(healthCounts.stable / healthTotal) * 100}%` }}
                  title={`Stable: ${healthCounts.stable}`}
                />
              )}
              {healthCounts.improving > 0 && (
                <div
                  className="bg-green-400 transition-all"
                  style={{ width: `${(healthCounts.improving / healthTotal) * 100}%` }}
                  title={`Improving: ${healthCounts.improving}`}
                />
              )}
              {healthCounts.unknown > 0 && (
                <div
                  className="bg-muted transition-all"
                  style={{ width: `${(healthCounts.unknown / healthTotal) * 100}%` }}
                  title={`Unknown: ${healthCounts.unknown}`}
                />
              )}
            </div>
            {/* Labels */}
            <div className="flex flex-wrap gap-4 text-xs">
              {[
                { key: 'critical', label: 'Critical', dotClass: 'bg-red-500' },
                { key: 'watch', label: 'Watch', dotClass: 'bg-yellow-400' },
                { key: 'stable', label: 'Stable', dotClass: 'bg-green-500' },
                { key: 'improving', label: 'Improving', dotClass: 'bg-green-400' },
                { key: 'unknown', label: 'Unknown', dotClass: 'bg-muted-foreground' },
              ].map(({ key, label, dotClass }) => (
                <span key={key} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClass)} />
                  {label}
                  <span className="text-foreground font-semibold">{healthCounts[key]}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Rank Health Summary Table ── */}
      <motion.div variants={fadeSlide} custom={7} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle>Rank Health Summary</CardTitle>
            <CardDescription>Top 15 products by critical alerts, then search volume</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Product', 'Brand', 'Marketplace', 'Top 10 SV', 'Critical Alerts', 'Health'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {rankTable.map((p, i) => (
                      <motion.tr
                        key={p.id}
                        variants={fadeSlide}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground truncate max-w-[200px]">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.asin}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.brand_name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs">{p.marketplace_code}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-green-400">{formatSV(p.top10_sv)}</td>
                        <td className="px-4 py-2.5">
                          {p.critical_alerts > 0 ? (
                            <Badge variant="critical" className="text-xs">{p.critical_alerts}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={
                              p.health_status === 'critical' ? 'critical' :
                              p.health_status === 'watch' ? 'high' :
                              p.health_status === 'stable' || p.health_status === 'improving' ? 'positive' :
                              'secondary'
                            }
                            className="capitalize text-xs"
                          >
                            {p.health_status || 'unknown'}
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 6. Export Buttons ── */}
      <motion.div variants={fadeSlide} custom={8} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Data
            </CardTitle>
            <CardDescription>Download raw data as CSV files</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => exportProducts(products)}
            >
              <Download className="w-4 h-4" />
              Export Products CSV
              <Badge variant="secondary" className="ml-1 text-xs">{products.length}</Badge>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => exportAlerts(alerts)}
            >
              <Download className="w-4 h-4" />
              Export Alerts CSV
              <Badge variant="secondary" className="ml-1 text-xs">{alerts.length}</Badge>
            </Button>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}
