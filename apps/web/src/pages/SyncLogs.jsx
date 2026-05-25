import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCcw, Play, CheckCircle, XCircle, Loader, Clock,
  Database, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, timeAgo } from '@/lib/utils';
import { api } from '@/api.js';

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.045 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: 'easeOut' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return '—';
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end - new Date(startedAt);
  if (diffMs < 0) return '—';
  const totalSecs = diffMs / 1000;
  if (totalSecs < 60) return `${totalSecs.toFixed(1)}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.round(totalSecs % 60);
  return `${mins}m ${secs}s`;
}

function statusConfig(status) {
  switch (status) {
    case 'success':
      return { variant: 'positive', icon: CheckCircle, label: 'Success', iconClass: 'text-green-400' };
    case 'failed':
    case 'error':
      return { variant: 'critical', icon: XCircle, label: 'Failed', iconClass: 'text-red-400' };
    case 'running':
    case 'in_progress':
      return { variant: 'high', icon: Loader, label: 'Running', iconClass: 'text-orange-400 animate-spin' };
    default:
      return { variant: 'secondary', icon: Clock, label: status ?? 'Unknown', iconClass: 'text-muted-foreground' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, valueClass }) {
  return (
    <div className="rounded-lg bg-muted/30 px-4 py-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-lg font-bold mt-0.5 tabular-nums', valueClass ?? 'text-foreground')}>{value}</p>
    </div>
  );
}

function ErrorCell({ message }) {
  const [expanded, setExpanded] = useState(false);
  if (!message) return <span className="text-muted-foreground">—</span>;
  const isLong = message.length > 60;
  return (
    <button
      onClick={() => isLong && setExpanded((e) => !e)}
      className={cn(
        'text-left text-red-400 text-xs max-w-[240px]',
        isLong && 'cursor-pointer hover:text-red-300 transition-colors',
        !expanded && 'truncate block'
      )}
      title={isLong ? message : undefined}
    >
      {expanded ? (
        <span className="whitespace-pre-wrap break-words">{message}</span>
      ) : (
        message
      )}
      {isLong && (
        <span className="ml-1 inline-flex items-center text-muted-foreground">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      )}
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      {[80, 100, 70, 60, 80, 200].map((w, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SyncLogs({ onSync, syncing = false }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.syncRuns();
      // Most recent first, cap at 50
      const sorted = [...data].sort(
        (a, b) => new Date(b.started_at ?? 0) - new Date(a.started_at ?? 0)
      );
      setRuns(sorted.slice(0, 50));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load sync runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 30_000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, load]);

  // Turn on auto-refresh automatically when a sync is running
  useEffect(() => {
    if (syncing) setAutoRefresh(true);
  }, [syncing]);

  // Refresh once sync completes so the new run appears
  useEffect(() => {
    if (!syncing) load();
  }, [syncing, load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalRuns = runs.length;
  const successCount = runs.filter((r) => r.status === 'success').length;
  const failedCount = runs.filter((r) => ['failed', 'error'].includes(r.status)).length;
  const lastSuccess = runs.find((r) => r.status === 'success');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            Sync &amp; Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            DataDive sync history and manual trigger
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <Button
            variant={autoRefresh ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className={cn('gap-1.5 text-xs h-8', autoRefresh && 'text-primary')}
          >
            <Clock className={cn('w-3.5 h-3.5', autoRefresh && 'animate-pulse')} />
            {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh'}
          </Button>

          {/* Manual refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>

          {/* Sync Now */}
          <Button
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="gap-1.5 text-xs h-8"
          >
            {syncing ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <StatPill label="Total Runs" value={totalRuns} />
          <StatPill label="Successful" value={successCount} valueClass="text-green-400" />
          <StatPill label="Failed" value={failedCount} valueClass={failedCount > 0 ? 'text-red-400' : 'text-foreground'} />
          <StatPill
            label="Last Success"
            value={lastSuccess ? timeAgo(lastSuccess.completed_at ?? lastSuccess.started_at) : 'Never'}
            valueClass="text-sm font-semibold text-muted-foreground"
          />
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Run History</CardTitle>
            <CardDescription className="text-xs">
              {totalRuns > 0 ? `Showing ${runs.length} most recent runs` : ''}
            </CardDescription>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {['Status', 'Started', 'Duration', 'Records', 'Source', 'Error'].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <AnimatePresence mode="wait">
              {loading ? (
                <tbody key="skeleton">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              ) : runs.length === 0 ? (
                <tbody key="empty">
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Database className="w-9 h-9 opacity-30" />
                        <p className="text-sm font-medium text-foreground">No sync runs yet</p>
                        <p className="text-xs">
                          Click &ldquo;Sync Now&rdquo; to start your first sync.
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key="rows"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {runs.map((run) => {
                    const { variant, icon: Icon, label, iconClass } = statusConfig(run.status);
                    const isRunning = ['running', 'in_progress'].includes(run.status);
                    return (
                      <motion.tr
                        key={run.id}
                        variants={rowVariants}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        {/* Status */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant={variant} className="gap-1 text-xs capitalize">
                            <Icon className={cn('w-3 h-3', iconClass)} />
                            {label}
                          </Badge>
                        </td>

                        {/* Started */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs text-foreground tabular-nums">
                              {run.started_at
                                ? new Date(run.started_at).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })
                                : '—'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {timeAgo(run.started_at)}
                            </span>
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={cn('text-xs tabular-nums', isRunning && 'text-orange-400 animate-pulse')}>
                            {isRunning ? 'Running…' : formatDuration(run.started_at, run.completed_at)}
                          </span>
                        </td>

                        {/* Records */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-xs font-mono text-foreground">
                            {run.records_processed != null
                              ? run.records_processed.toLocaleString()
                              : '—'}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {run.source ?? 'manual'}
                          </Badge>
                        </td>

                        {/* Error */}
                        <td className="px-3 py-2.5 max-w-[260px]">
                          <ErrorCell message={run.error_message} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              )}
            </AnimatePresence>
          </table>
        </div>

        {/* Footer */}
        {!loading && runs.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>{runs.length} run{runs.length !== 1 ? 's' : ''} shown</span>
            {autoRefresh && (
              <span className="flex items-center gap-1 text-primary">
                <Clock className="w-3 h-3 animate-pulse" />
                Auto-refreshing every 30s
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
