import { useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Boxes, ChevronLeft, ChevronRight,
  FileText, Globe, RefreshCcw, SearchCheck, Settings, Star, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Dashboard',    icon: BarChart3 },
  { key: 'rank-radar',   label: 'Rank Radar',   icon: SearchCheck },
  { key: 'keywords',     label: 'Keywords',     icon: Activity },
  { key: 'products',     label: 'Products',     icon: Boxes },
  { key: 'brands',       label: 'Brands',       icon: Star },
  { key: 'marketplaces', label: 'Marketplaces', icon: Globe },
  { key: 'alerts',       label: 'Alerts',       icon: AlertTriangle, badge: true },
  { key: 'watchlist',    label: 'Watchlist',    icon: Star },
  { key: 'reports',      label: 'Reports',      icon: FileText },
  { key: 'sync-logs',    label: 'Sync & Logs',  icon: RefreshCcw },
  { key: 'settings',     label: 'Settings',     icon: Settings },
];

function NavLinks({ view, setView, alertCount, collapsed, onNavigate }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
      {NAV_ITEMS.map(({ key, label, icon: Icon, badge }, i) => (
        <motion.button
          key={key}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.025, duration: 0.18 }}
          onClick={() => { setView(key); onNavigate?.(); }}
          title={collapsed ? label : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md text-sm font-medium transition-colors text-left w-full relative',
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
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </motion.button>
      ))}
    </nav>
  );
}

export default function Sidebar({ view, setView, alertCount = 0, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar (md+) ── */}
      <aside className={cn(
        'hidden md:flex flex-col min-h-screen bg-card border-r border-border shrink-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-60'
      )}>
        <div className={cn('flex items-center gap-2.5 border-b border-border shrink-0', collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5')}>
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
            <SearchCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-bold text-sm text-foreground">RANK RADAR</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Keyword Monitor</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <NavLinks view={view} setView={setView} alertCount={alertCount} collapsed={collapsed} />

        <div className={cn('border-t border-border shrink-0', collapsed ? 'p-2' : 'px-3 py-3')}>
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

      {/* ── Mobile drawer (< md) ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col md:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-border shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                    <SearchCheck className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">RANK RADAR</span>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Keyword Monitor</p>
                  </div>
                </div>
                <button onClick={onMobileClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavLinks view={view} setView={setView} alertCount={alertCount} collapsed={false} onNavigate={onMobileClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
