import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV } from '@/lib/utils';
import { api } from '@/api.js';

const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive' };
const STATUS_VARIANT = { open: 'destructive', acknowledged: 'secondary', reviewed: 'secondary', ignored: 'outline', resolved: 'outline' };

async function updateAlertStatus(id, action, refreshAlerts) {
  if (action === 'acknowledge') await api.acknowledge(id);
  else if (action === 'review') await api.review(id);
  else if (action === 'ignore') await api.ignore(id);
  else if (action === 'resolve') await api.resolve(id);
  await refreshAlerts({});
}

export default function Alerts({ alerts, refreshAlerts, loading }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [sorting, setSorting] = useState([{ id: 'severity', desc: false }]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter && a.severity !== severityFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter]);

  const columns = useMemo(() => [
    {
      id: 'severity',
      accessorKey: 'severity',
      header: 'Severity',
      size: 90,
      cell: ({ getValue }) => {
        const v = getValue();
        return <Badge variant={SEVERITY_VARIANT[v] || 'secondary'} className="capitalize text-xs">{v}</Badge>;
      },
    },
    {
      id: 'keyword',
      accessorKey: 'keyword',
      header: 'Keyword',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>,
    },
    {
      id: 'product_title',
      accessorKey: 'product_title',
      header: 'Product',
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue()}</span>,
    },
    {
      id: 'marketplace_code',
      accessorKey: 'marketplace_code',
      header: 'Mktp',
      size: 60,
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{getValue()}</Badge>,
    },
    {
      id: 'alert_type',
      accessorKey: 'alert_type',
      header: 'Alert Type',
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue()?.replaceAll('_', ' ')}</span>
      ),
    },
    {
      id: 'rank_change',
      header: 'Rank',
      size: 110,
      cell: ({ row }) => {
        const { previous_rank, current_rank } = row.original;
        return (
          <span className="text-xs">
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
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue();
        return <Badge variant={STATUS_VARIANT[v] || 'secondary'} className="capitalize text-xs">{v}</Badge>;
      },
    },
    {
      id: 'detected_at',
      accessorKey: 'detected_at',
      header: 'Detected',
      cell: ({ getValue }) => {
        const v = getValue();
        if (!v) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className="text-xs text-muted-foreground">{new Date(v).toLocaleDateString()}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 180,
      cell: ({ row }) => {
        const { id, status } = row.original;
        return (
          <div className="flex items-center gap-1">
            {status === 'open' && (
              <>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => updateAlertStatus(id, 'acknowledge', refreshAlerts)}>Ack</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => updateAlertStatus(id, 'review', refreshAlerts)}>Review</Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => updateAlertStatus(id, 'ignore', refreshAlerts)}>Ignore</Button>
              </>
            )}
            {(status === 'open' || status === 'acknowledged' || status === 'reviewed') && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-green-400" onClick={() => updateAlertStatus(id, 'resolve', refreshAlerts)}>Resolve</Button>
            )}
            {(status === 'resolved' || status === 'ignored') && (
              <span className="text-[10px] text-muted-foreground">Done</span>
            )}
          </div>
        );
      },
    },
  ], [refreshAlerts]);

  const table = useReactTable({
    data: filteredAlerts,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground ml-auto">{table.getFilteredRowModel().rows.length} alerts</p>
      </div>

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
                    No alerts match the selected filters.
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
            <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-7 text-xs">Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
