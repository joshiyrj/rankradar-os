import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Boxes, SearchCheck, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';
import { api } from '@/api.js';

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeScale = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.32, ease: 'easeOut' },
  }),
};

// ─── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_VARIANT = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  positive: 'positive',
};

const HEALTH_BAR_COLOR = {
  critical:  '#ef4444',
  watch:     '#eab308',
  stable:    '#22c55e',
  improving: '#10b981',
  unknown:   '#6b7280',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function KPICard({ title, value, sub, tone, icon: Icon, index }) {
  const toneClass =
    tone === 'critical' ? 'text-red-400'
    : tone === 'positive' ? 'text-green-400'
    : tone === 'warning' ? 'text-yellow-400'
    : 'text-foreground';

  return (
    <motion.div variants={fadeScale} custom={index} initial="hidden" animate="visible">
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>
        <p className={cn('text-2xl font-bold mt-2', toneClass)}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </Card>
    </motion.div>
  );
}

function AlertRow({ alert }) {
  const variant = SEVERITY_VARIANT[alert.severity] || 'secondary';
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Badge variant={variant} className="shrink-0 mt-0.5 capitalize">{alert.severity}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{alert.keyword}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[alert.brand_name, alert.marketplace_code, alert.alert_type?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-xs text-right shrink-0 font-mono">
        <span className="text-muted-foreground">#{alert.previous_rank ?? '–'}</span>
        <span className="mx-1 text-muted-foreground">→</span>
        <span className={!alert.current_rank ? 'text-red-400' : 'text-foreground'}>
          {alert.current_rank ? `#${alert.current_rank}` : 'NR'}
        </span>
      </div>
    </div>
  );
}

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg max-w-[220px]">
      <p className="font-medium text-foreground mb-0.5 break-words">{d.name}</p>
      <p className="text-muted-foreground">
        Top 10 SV: <span className="text-foreground font-semibold">{formatSV(d.top10sv)}</span>
      </p>
      {d.health && (
        <p className="text-muted-foreground capitalize">
          Health: <span className="text-foreground">{d.health}</span>
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard({ brands, marketplaces, products, alerts, loading }) {
  const [syncRuns, setSyncRuns] = useState([]);

  useEffect(() => {
    api.syncRuns().then(setSyncRuns).catch(console.error);
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    const top10SV  = products.reduce((s, p) => s + (p.top10_sv  || 0), 0);
    const top50SV  = products.reduce((s, p) => s + (p.top50_sv  || 0), 0);
    const top10KW  = products.reduce((s, p) => s + (p.top10_kw  || 0), 0);
    const top50KW  = products.reduce((s, p) => s + (p.top50_kw  || 0), 0);
    const totalKeywords = products.reduce((s, p) => s + (p.keyword_count || p.tracked_keywords || 0), 0);
    return { criticalAlerts, top10SV, top50SV, top10KW, top50KW, totalKeywords };
  }, [products, alerts]);

  const recentAlerts = alerts.slice(0, 10);
  const lastSyncRun  = syncRuns.find((r) => r.status === 'success');

  // ── Products by alert status (worst first) ─────────────────────────────────
  const worstProducts = useMemo(() =>
    [...products]
      .sort((a, b) => (b.critical_alerts || 0) - (a.critical_alerts || 0))
      .slice(0, 6),
    [products]
  );

  // ── Top 8 products by Top 10 SV (for the bar chart) ───────────────────────
  const topProductsChart = useMemo(() =>
    [...products]
      .sort((a, b) => (b.top10_sv || 0) - (a.top10_sv || 0))
      .slice(0, 8)
      .map((p) => ({
        name:    p.title?.slice(0, 25) || p.asin || '—',
        top10sv: p.top10_sv || 0,
        health:  p.health_status || 'unknown',
      })),
    [products]
  );

  // ── Rank health counts ─────────────────────────────────────────────────────
  const healthCounts = useMemo(() => {
    const counts = { critical: 0, watch: 0, stable: 0, improving: 0, unknown: 0 };
    products.forEach((p) => {
      const h = p.health_status || 'unknown';
      if (h in counts) counts[h]++;
      else counts.unknown++;
    });
    return counts;
  }, [products]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Last sync banner ── */}
      {lastSyncRun && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground"
        >
          Last Sync:{' '}
          {lastSyncRun.started_at ? new Date(lastSyncRun.started_at).toLocaleString() : '—'}
          {lastSyncRun.records_processed != null && ` · ${lastSyncRun.records_processed} products`}
        </motion.p>
      )}

      {/* ── Primary KPI row (6 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <KPICard index={0} title="Total Keywords" value={stats.totalKeywords.toLocaleString()} icon={SearchCheck} />
        <KPICard index={1} title="Top 10 KW"      value={stats.top10KW.toLocaleString()}      icon={TrendingUp}  tone="positive" />
        <KPICard index={2} title="Top 50 KW"      value={stats.top50KW.toLocaleString()} />
        <KPICard index={3} title="Top 10 SV"      value={formatSV(stats.top10SV)}             icon={TrendingUp}  tone="positive" />
        <KPICard index={4} title="Top 50 SV"      value={formatSV(stats.top50SV)} />
        <KPICard
          index={5}
          title="Alerts"
          value={alerts.length}
          tone={stats.criticalAlerts > 0 ? 'critical' : 'default'}
          icon={AlertTriangle}
          sub={stats.criticalAlerts > 0 ? `${stats.criticalAlerts} critical` : 'All clear'}
        />
      </div>

      {/* ── Secondary KPI row (4 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard index={6}  title="Brands"           value={brands.length}      icon={Boxes} sub="Monitored brands" />
        <KPICard index={7}  title="Marketplaces"     value={marketplaces.length}              sub="Active marketplaces" />
        <KPICard index={8}  title="Products"         value={products.length}    icon={Boxes} sub="Tracked products" />
        <KPICard
          index={9}
          title="Critical Products"
          value={products.filter((p) => p.health_status === 'critical').length}
          tone={products.some((p) => p.health_status === 'critical') ? 'critical' : 'default'}
          sub="With open critical alerts"
        />
      </div>

      {/* ── Section D: Rank Health Overview pills ── */}
      {products.length > 0 && (
        <motion.div
          variants={fadeScale}
          custom={10}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground font-medium">Health Overview:</span>
            {[
              { key: 'critical',  label: 'Critical',  dot: 'bg-red-500',     text: 'text-red-400'     },
              { key: 'watch',     label: 'Watch',     dot: 'bg-yellow-400',  text: 'text-yellow-400'  },
              { key: 'stable',    label: 'Stable',    dot: 'bg-green-500',   text: 'text-green-400'   },
              { key: 'improving', label: 'Improving', dot: 'bg-emerald-400', text: 'text-emerald-400' },
              { key: 'unknown',   label: 'Unknown',   dot: 'bg-zinc-600',    text: 'text-zinc-400'    },
            ].map(({ key, label, dot, text }) => (
              healthCounts[key] > 0 && (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/20"
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                  <span className={text}>{healthCounts[key]}</span>
                  <span className="text-muted-foreground">{label}</span>
                </span>
              )
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Section A: Top Products by Search Volume (real bar chart) ── */}
        <motion.div variants={fadeScale} custom={11} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Top Products by Search Volume
              </CardTitle>
              <CardDescription>Top 8 products ranked by Top 10 keyword search volume</CardDescription>
            </CardHeader>
            <CardContent>
              {topProductsChart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">
                  No products synced yet — run a DataDive sync to populate.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={topProductsChart.length * 40 + 16}>
                  <BarChart
                    data={topProductsChart}
                    layout="vertical"
                    margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: 'hsl(213 31% 60%)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatSV(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={160}
                      tick={{ fontSize: 10, fill: 'hsl(213 31% 75%)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<CustomBarTooltip />}
                      cursor={{ fill: 'hsl(222 47% 18% / 0.4)' }}
                    />
                    <Bar dataKey="top10sv" radius={[0, 3, 3, 0]}>
                      {topProductsChart.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={HEALTH_BAR_COLOR[entry.health] || HEALTH_BAR_COLOR.unknown}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {topProductsChart.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {[
                    { h: 'critical',  label: 'Critical',  color: 'bg-red-500'     },
                    { h: 'watch',     label: 'Watch',     color: 'bg-yellow-400'  },
                    { h: 'stable',    label: 'Stable',    color: 'bg-green-500'   },
                    { h: 'improving', label: 'Improving', color: 'bg-emerald-400' },
                    { h: 'unknown',   label: 'Unknown',   color: 'bg-zinc-600'    },
                  ].map(({ h, label, color }) => (
                    <span key={h} className="flex items-center gap-1">
                      <span className={cn('w-2.5 h-2.5 rounded-sm', color)} />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Section B: Recent Open Alerts (real data) ── */}
        <motion.div variants={fadeScale} custom={12} initial="hidden" animate="visible">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recent Open Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center px-5">
                  No open alerts — all clear!
                </p>
              ) : (
                <div className="px-5">
                  {recentAlerts.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Section C: Products by Alert Status ── */}
      <motion.div variants={fadeScale} custom={13} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Products by Alert Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worstProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No products synced yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {worstProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.brand_name} · {p.marketplace_code}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          Top 10 SV:{' '}
                          <span className="text-foreground font-medium">{formatSV(p.top10_sv)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {p.critical_alerts > 0 && (
                        <Badge variant="critical" className="text-xs">
                          {p.critical_alerts} crit
                        </Badge>
                      )}
                      {p.open_alerts > 0 && p.critical_alerts === 0 && (
                        <Badge variant="high" className="text-xs">
                          {p.open_alerts} open
                        </Badge>
                      )}
                      {(!p.open_alerts || p.open_alerts === 0) && (
                        <Badge variant="positive" className="text-xs">Clean</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}
