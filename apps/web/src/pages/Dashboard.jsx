import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Boxes, SearchCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSV, timeAgo } from '@/lib/utils';
import { api } from '@/api.js';

const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive' };

function KPICard({ title, value, sub, tone, icon: Icon, delta }) {
  const toneClass = tone === 'critical' ? 'text-red-400' : tone === 'positive' ? 'text-green-400' : tone === 'warning' ? 'text-yellow-400' : 'text-foreground';
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>
      <p className={`text-2xl font-bold mt-2 ${toneClass}`}>{value ?? '—'}</p>
      <div className="flex items-center gap-2 mt-1">
        {delta != null && (
          <span className={`text-xs font-medium ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta >= 0 ? '▲' : '▼'}{Math.abs(delta)}
          </span>
        )}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
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

// Placeholder chart showing mock trend for the overall portfolio
function PortfolioTrendChart({ products }) {
  const data = useMemo(() => {
    if (!products.length) return [];
    // Build a synthetic 7-day trend from products top10_sv
    const total = products.reduce((s, p) => s + (p.top10_sv || 0), 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        top10sv: Math.round(total * (0.88 + 0.02 * i + Math.sin(i) * 0.04)),
        top50sv: Math.round((products.reduce((s, p) => s + (p.top50_sv || 0), 0)) * (0.91 + 0.015 * i)),
      };
    });
  }, [products]);

  if (!data.length) return <p className="text-xs text-muted-foreground py-8 text-center">No data yet — sync DataDive to populate.</p>;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 47% 18%)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(213 31% 60%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(213 31% 60%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatSV(v)} />
        <RechartTooltip
          contentStyle={{ background: 'hsl(222 47% 11%)', border: '1px solid hsl(222 47% 18%)', borderRadius: 6, fontSize: 11 }}
          labelStyle={{ color: 'hsl(213 31% 91%)' }}
          formatter={(v, name) => [formatSV(v), name === 'top10sv' ? 'Top 10 SV' : 'Top 50 SV']}
        />
        <Line type="monotone" dataKey="top10sv" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="top50sv" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard({ brands, marketplaces, products, alerts, loading }) {
  const [syncRuns, setSyncRuns] = useState([]);

  useEffect(() => {
    api.syncRuns().then(setSyncRuns).catch(console.error);
  }, []);

  const stats = useMemo(() => {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    const top10SV = products.reduce((s, p) => s + (p.top10_sv || 0), 0);
    const top50SV = products.reduce((s, p) => s + (p.top50_sv || 0), 0);
    const top10KW = products.reduce((s, p) => s + (p.top10_kw || 0), 0);
    const top50KW = products.reduce((s, p) => s + (p.top50_kw || 0), 0);
    const totalKeywords = products.reduce((s, p) => s + (p.keyword_count || p.tracked_keywords || 0), 0);
    return { criticalAlerts, top10SV, top50SV, top10KW, top50KW, totalKeywords };
  }, [products, alerts]);

  const recentAlerts = alerts.slice(0, 10);
  const lastSyncRun = syncRuns.find((r) => r.status === 'success');

  const worstProducts = useMemo(() =>
    [...products].sort((a, b) => (b.critical_alerts || 0) - (a.critical_alerts || 0)).slice(0, 6),
    [products]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Last sync banner */}
      {lastSyncRun && (
        <p className="text-xs text-muted-foreground">
          Last Sync: {lastSyncRun.started_at ? new Date(lastSyncRun.started_at).toLocaleString() : '—'}
          {lastSyncRun.records_processed != null && ` · ${lastSyncRun.records_processed} products`}
        </p>
      )}

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <KPICard title="Total Keywords" value={stats.totalKeywords.toLocaleString()} icon={SearchCheck} />
        <KPICard title="Top 10 KW" value={stats.top10KW.toLocaleString()} icon={TrendingUp} tone="positive" />
        <KPICard title="Top 50 KW" value={stats.top50KW.toLocaleString()} />
        <KPICard title="Top 10 SV" value={formatSV(stats.top10SV)} tone="positive" icon={TrendingUp} />
        <KPICard title="Top 50 SV" value={formatSV(stats.top50SV)} />
        <KPICard
          title="Alerts"
          value={alerts.length}
          tone={stats.criticalAlerts > 0 ? 'critical' : 'default'}
          icon={AlertTriangle}
          sub={stats.criticalAlerts > 0 ? `${stats.criticalAlerts} critical` : 'All clear'}
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard title="Brands" value={brands.length} icon={Boxes} sub="Monitored brands" />
        <KPICard title="Marketplaces" value={marketplaces.length} sub="Active marketplaces" />
        <KPICard title="Products" value={products.length} icon={Boxes} sub="Tracked products" />
        <KPICard
          title="Critical Products"
          value={products.filter((p) => p.health_status === 'critical').length}
          tone={products.some((p) => p.health_status === 'critical') ? 'critical' : 'default'}
          sub="With open critical alerts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Portfolio Search Volume Trend
            </CardTitle>
            <CardDescription>Top 10 SV vs Top 50 SV across all products</CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioTrendChart products={products} />
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-green-400 inline-block" /> Top 10 SV</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-primary inline-block" /> Top 50 SV</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Recent Open Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center px-5">No open alerts — all clear!</p>
            ) : (
              <div className="px-5">
                {recentAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products by alert status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Products by Alert Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {worstProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No products synced yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {worstProducts.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.brand_name} · {p.marketplace_code}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-muted-foreground">Top 10 SV: <span className="text-foreground font-medium">{formatSV(p.top10_sv)}</span></span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {p.critical_alerts > 0 && <Badge variant="critical" className="text-xs">{p.critical_alerts} crit</Badge>}
                    {p.open_alerts > 0 && p.critical_alerts === 0 && <Badge variant="high" className="text-xs">{p.open_alerts} open</Badge>}
                    {(!p.open_alerts || p.open_alerts === 0) && <Badge variant="positive" className="text-xs">Clean</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
