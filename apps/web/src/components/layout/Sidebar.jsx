import { useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Boxes, ChevronLeft, ChevronRight,
  FileText, Globe, RefreshCcw, SearchCheck, Settings, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'rank-radar', label: 'Rank Radar', icon: SearchCheck },
  { key: 'keywords', label: 'Keywords', icon: Activity },
  { key: 'products', label: 'Products', icon: Boxes },
  { key: 'brands', label: 'Brands', icon: Star },
  { key: 'marketplaces', label: 'Marketplaces', icon: Globe },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: true },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'watchlist', label: 'Watchlist', icon: Star },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'sync-logs', label: 'Sync & Logs', icon: RefreshCcw },
];

// Pages that just show a coming-soon placeholder
const STUB_PAGES = new Set(['brands', 'marketplaces', 'reports', 'watchlist', 'sync-logs']);

export default function Sidebar({ view, setView, alertCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);

  function navigate(key) {
    if (STUB_PAGES.has(key)) {
      // For stub pages, don't navigate — show nothing. We can handle later.
      setView(key);
      return;
    }
    setView(key);
  }

  return (
    <aside className={cn(
      'flex flex-col min-h-screen bg-card border-r border-border shrink-0 transition-all duration-200',
      collapsed ? 'w-14' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-2.5 border-b border-border', collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5')}>
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
          <SearchCheck className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-sm text-foreground">RANK RADAR</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Keyword Monitor</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => navigate(key)}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md text-sm font-medium transition-colors text-left w-full',
              collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2',
              view === key
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
            {!collapsed && badge && alertCount > 0 && (
              <span className="ml-auto text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
            {collapsed && badge && alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
            )}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className={cn('border-t border-border', collapsed ? 'p-2' : 'px-3 py-3')}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full',
            collapsed ? 'justify-center py-1' : 'px-0 py-1'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
