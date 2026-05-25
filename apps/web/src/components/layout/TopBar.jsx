import { RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'rank-radar': 'Rank Radar',
  products: 'Products',
  keywords: 'Keywords',
  brands: 'Brands',
  marketplaces: 'Marketplaces',
  alerts: 'Alerts',
  reports: 'Reports',
  watchlist: 'Watchlist',
  settings: 'Settings',
  'sync-logs': 'Sync & Logs',
};

export default function TopBar({ view, onSync, syncing, lastSyncAt, syncError }) {
  const isStale = lastSyncAt && (Date.now() - new Date(lastSyncAt).getTime()) > 6 * 60 * 60 * 1000;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/60 backdrop-blur sticky top-0 z-20">
      <div>
        <h1 className="text-base font-semibold text-foreground">{PAGE_TITLES[view] || view}</h1>
        <p className="text-xs text-muted-foreground">DataDive Rank Radar monitoring</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync status badge */}
        {lastSyncAt && (
          <div className="flex items-center gap-1.5 text-xs">
            {syncError ? (
              <WifiOff className="w-3.5 h-3.5 text-destructive" />
            ) : isStale ? (
              <WifiOff className="w-3.5 h-3.5 text-yellow-400" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            )}
            <span className={syncError ? 'text-destructive' : isStale ? 'text-yellow-400' : 'text-muted-foreground'}>
              {syncError ? 'Sync error' : `Synced ${timeAgo(lastSyncAt)}`}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="gap-1.5"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync'}
        </Button>
      </div>
    </header>
  );
}
