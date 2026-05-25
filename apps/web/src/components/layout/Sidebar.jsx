import { Activity, AlertTriangle, BarChart3, Boxes, SearchCheck, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'rank-radar', label: 'Rank Radar', icon: SearchCheck },
  { key: 'products', label: 'Products', icon: Boxes },
  { key: 'keywords', label: 'Keywords', icon: Activity },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ view, setView, alertCount = 0 }) {
  return (
    <aside className="flex flex-col w-60 min-h-screen bg-card border-r border-border shrink-0">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
          <SearchCheck className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <span className="font-bold text-sm text-foreground">RankRadar</span>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Keyword Monitor</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left w-full',
              view === key
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            {key === 'alerts' && alertCount > 0 && (
              <span className="ml-auto text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-muted-foreground">DataDive Rank Radar</p>
      </div>
    </aside>
  );
}
