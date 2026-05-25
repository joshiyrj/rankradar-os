import { useMemo } from 'react';
import {
  AlertTriangle, BarChart3, Boxes, RefreshCcw, SearchCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardValue, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSV } from '@/lib/utils';

function KPICard({ title, value, description, tone = 'default', icon: Icon }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
        </div>
        <CardValue className={
          tone === 'critical' ? 'text-red-400' :
          tone === 'positive' ? 'text-green-400' :
          tone === 'warning' ? 'text-yellow-400' : ''
        }>{value}</CardValue>
      </CardHeader>
      {description && <CardContent><CardDescription>{description}</CardDescription></CardContent>}
    </Card>
  );
}

function AlertRow({ alert }) {
  const severityVariant = {
    critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive'
  }[alert.severity] || 'secondary';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Badge variant={severityVariant} className="shrink-0 mt-0.5 capitalize">{alert.severity}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{alert.keyword}</p>
        <p className="text-xs text-muted-foreground truncate">
          {alert.product_title} · {alert.marketplace_code} · {alert.alert_type?.replaceAll('_', ' ')}
        </p>
      </div>
      <div className="text-xs text-right shrink-0">
        <span className="text-muted-foreground">#{alert.previous_rank ?? '–'}</span>
        <span className="mx-1 text-muted-foreground">→</span>
        <span className={alert.current_rank ? 'text-foreground' : 'text-red-400'}>
          {alert.current_rank ? `#${alert.current_rank}` : 'NR'}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({ brands, marketplaces, products, alerts, loading }) {
  const stats = useMemo(() => {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    const top10SV = products.reduce((sum, p) => sum + (p.top10_sv || 0), 0);
    const top50SV = products.reduce((sum, p) => sum + (p.top50_sv || 0), 0);
    const criticalProducts = products.filter((p) => p.health_status === 'critical').length;
    return { criticalAlerts, top10SV, top50SV, criticalProducts };
  }, [products, alerts]);

  const recentAlerts = alerts.slice(0, 8);

  const worstProducts = useMemo(() =>
    [...products]
      .sort((a, b) => (b.critical_alerts || 0) - (a.critical_alerts || 0))
      .slice(0, 5),
    [products]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Brands" value={brands.length} icon={Boxes} description="Monitored brands" />
        <KPICard title="Marketplaces" value={marketplaces.length} icon={BarChart3} description="Active marketplaces" />
        <KPICard title="Products" value={products.length} icon={SearchCheck} description="Tracked products" />
        <KPICard
          title="Critical Alerts"
          value={stats.criticalAlerts}
          tone={stats.criticalAlerts > 0 ? 'critical' : 'default'}
          icon={AlertTriangle}
          description="Open critical alerts"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Top 10 SV (total)"
          value={formatSV(stats.top10SV)}
          icon={TrendingUp}
          tone="positive"
          description="Combined Top 10 search volume"
        />
        <KPICard
          title="Top 50 SV (total)"
          value={formatSV(stats.top50SV)}
          icon={TrendingDown}
          description="Combined Top 50 search volume"
        />
        <KPICard
          title="Critical Products"
          value={stats.criticalProducts}
          tone={stats.criticalProducts > 0 ? 'critical' : 'default'}
          icon={AlertTriangle}
          description="Products with critical alerts"
        />
        <KPICard
          title="Open Alerts"
          value={alerts.length}
          tone={alerts.length > 0 ? 'warning' : 'default'}
          icon={AlertTriangle}
          description="Total open alerts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No open alerts. All clear!</p>
            ) : (
              <div>{recentAlerts.map((a) => <AlertRow key={a.id} alert={a} />)}</div>
            )}
          </CardContent>
        </Card>

        {/* Products by alert severity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-4 h-4" /> Products by Alert Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {worstProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No products synced yet.</p>
            ) : (
              <div className="space-y-2">
                {worstProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.brand_name} · {p.marketplace_code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.critical_alerts > 0 && (
                        <Badge variant="critical">{p.critical_alerts} critical</Badge>
                      )}
                      {p.open_alerts > 0 && p.critical_alerts === 0 && (
                        <Badge variant="high">{p.open_alerts} alerts</Badge>
                      )}
                      {(!p.open_alerts || p.open_alerts === 0) && (
                        <Badge variant="positive">Clean</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
