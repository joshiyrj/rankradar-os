import { Menu, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  'rank-radar': 'Rank Radar',
  products:     'Products',
  keywords:     'Keywords',
  brands:       'Brands',
  marketplaces: 'Marketplaces',
  alerts:       'Alerts',
  reports:      'Reports',
  watchlist:    'Watchlist',
  settings:     'Settings',
  'sync-logs':  'Sync & Logs',
};

export default function TopBar({ view, onSync, syncing, lastSyncAt, syncError, onMenuOpen }) {
  const isStale = lastSyncAt && (Date.now() - new Date(lastSyncAt).getTime()) > 6 * 60 * 60 * 1000;

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-background/60 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuOpen}
          className="md:hidden p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base font-semibold text-foreground">{PAGE_TITLES[view] || view}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">DataDive Rank Radar monitoring</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sync status badge */}
        {(lastSyncAt || syncError) && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs max-w-[240px]">
            {syncError ? (
              <WifiOff className="w-3.5 h-3.5 text-destructive shrink-0" />
            ) : isStale ? (
              <WifiOff className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-green-400 shrink-0" />
            )}
            <span className={`truncate ${syncError ? 'text-destructive' : isStale ? 'text-yellow-400' : 'text-muted-foreground'}`}
              title={syncError || undefined}>
              {syncError ? syncError : `Synced ${timeAgo(lastSyncAt)}`}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
          className="gap-1.5 text-xs"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">{syncing ? 'Syncing…' : 'Sync'}</span>
        </Button>
      </div>
    </header>
  );
}
