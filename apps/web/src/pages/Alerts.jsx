import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter, RefreshCcw, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { api } from '@/api.js';

const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive' };
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, positive: 4 };
const STATUSES = ['all', 'open', 'acknowledged', 'reviewed', 'resolved', 'ignored'];

export default function Alerts() {
  const [allAlerts, setAllAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [globalFilter, setGlobalFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'severity', desc: false }]);
  const [actionPending, setActionPending] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.alerts({});
      setAllAlerts(rows);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Count alerts per tab
  const counts = useMemo(() => {
    const c = { all: allAlerts.length, open: 0, acknowledged: 0, reviewed: 0, resolved: 0, ignored: 0 };
    allAlerts.forEach((a) => { if (c[a.status] !== undefined) c[a.status]++; });
    return c;
  }, [allAlerts]);

  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (activeTab !== 'all' && a.status !== activeTab) return false;
      if (severityFilter && a.severity !== severityFilter) return false;
      return true;
    });
  }, [allAlerts, activeTab, severityFilter]);

  async function act(id, action) {
    setActionPending((p) => ({ ...p, [id]: action }));
    try {
      if (action === 'acknowledge') await api.acknowledge(id);
      else if (action === 'review') await api.review(id);
      else if (action === 'ignore') await api.ignore(id);
      else if (action === 'resolve') await api.resolve(id);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPending((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  const columns = useMemo(() => [
    {
      id: 'severity', accessorKey: 'severity', header: 'Severity', size: 90,
      sortingFn: (a, b) => (SEVERITY_ORDER[a.original.severity] ?? 9) - (SEVERITY_ORDER[b.original.severity] ?? 9),
      cell: ({ getValue }) => {
        const v = getValue();
        return <Badge variant={SEVERITY_VARIANT[v] || 'secondary'} className="capitalize text-xs">{v}</Badge>;
      },
    },
    {
      id: 'keyword', accessorKey: 'keyword', header: 'Keyword',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>,
    },
    {
      id: 'product_title', accessorKey: 'product_title', header: 'Product',
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground max-w-[180px] truncate block">{getValue()}</span>,
    },
    {
      id: 'marketplace_code', accessorKey: 'marketplace_code', header: 'Mktp', size: 60,
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{getValue() || '—'}</Badge>,
    },
    {
      id: 'alert_type', accessorKey: 'alert_type', header: 'Type',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue()?.replaceAll('_', ' ')}</span>
      ),
    },
    {
      id: 'rank_change', header: 'Rank Movement', size: 130,
      cell: ({ row }) => {
        const { previous_rank, current_rank } = row.original;
        return (
          <span className="text-xs font-mono">
            <span className="text-muted-foreground">#{previous_rank ?? '–'}</span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span className={!current_rank ? 'text-red-400' : 'text-foreground'}>
              {current_rank ? `#${current_rank}` : 'NR'}
            </span>
          </span>
        );
      },
    },
    {
      id: 'status', accessorKey: 'status', header: 'Status', size: 110,
      cell: ({ getValue }) => {
        const v = getValue();
        const variantMap = { open: 'critical', acknowledged: 'high', reviewed: 'medium', ignored: 'outline', resolved: 'positive' };
        return <Badge variant={variantMap[v] || 'secondary'} className="capitalize text-xs">{v}</Badge>;
      },
    },
    {
      id: 'detected_at', accessorKey: 'detected_at', header: 'Detected',
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs text-muted-foreground">{v.slice(0, 10)}</span>;
      },
    },
    {
      id: 'actions', header: 'Actions', size: 200,
      cell: ({ row }) => {
        const { id, status } = row.original;
        const pending = actionPending[id];
        return (
          <div className="flex items-center gap-1">
            {status === 'open' && (
              <>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={!!pending} onClick={() => act(id, 'acknowledge')}>
                  {pending === 'acknowledge' ? '…' : 'Ack'}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={!!pending} onClick={() => act(id, 'review')}>
                  {pending === 'review' ? '…' : 'Review'}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" disabled={!!pending} onClick={() => act(id, 'ignore')}>
                  {pending === 'ignore' ? '…' : 'Ignore'}
                </Button>
              </>
            )}
            {(status === 'open' || status === 'acknowledged' || status === 'reviewed') && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-green-400" disabled={!!pending} onClick={() => act(id, 'resolve')}>
                {pending === 'resolve' ? '…' : 'Resolve'}
              </Button>
            )}
            {(status === 'resolved' || status === 'ignored') && (
              <span className="text-[10px] text-muted-foreground">Done</span>
            )}
          </div>
        );
      },
    },
  ], [actionPending]);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const TAB_LABELS = { all: 'All Alerts', open: 'Open', acknowledged: 'Acknowledged', reviewed: 'Reviewed', resolved: 'Resolved', ignored: 'Ignored' };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <p className="text-xs text-muted-foreground mb-4">Monitor keyword changes and get notified about important updates.</p>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border pb-0 mb-4 overflow-x-auto">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                activeTab === s
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {TAB_LABELS[s]}
              {counts[s] > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  s === 'open' ? 'bg-destructive text-destructive-foreground' :
                  activeTab === s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search alerts…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-9 text-xs text-muted-foreground">
          <RefreshCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>

        <p className="text-xs text-muted-foreground ml-auto">{table.getFilteredRowModel().rows.length} alerts</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap" style={{ width: header.getSize() }}>
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn('flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground')}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              header.column.getIsSorted() === 'asc' ? <ChevronUp className="w-3 h-3" /> :
                              header.column.getIsSorted() === 'desc' ? <ChevronDown className="w-3 h-3" /> :
                              <ChevronsUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm">
                      {loading ? 'Loading…' : 'No alerts match the selected filters.'}
                    </td>
                  </tr>
                )}
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>{table.getFilteredRowModel().rows.length} alerts</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-7 text-xs">Prev</Button>
              <span>Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-7 text-xs">Next</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
