import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, timeAgo } from '@/lib/utils';
import { getWatchlist, toggleWatchlist } from '@/pages/Watchlist';

const HEALTH_VARIANT = { critical: 'critical', watch: 'high', stable: 'positive', improving: 'positive' };

export default function Products({ products, loading }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'critical_alerts', desc: true }]);
  const [watchlist, setWatchlist] = useState(() => getWatchlist());

  const columns = useMemo(() => [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.asin}</p>
        </div>
      ),
    },
    {
      id: 'brand_name',
      accessorKey: 'brand_name',
      header: 'Brand',
      cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue()}</span>,
    },
    {
      id: 'marketplace_code',
      accessorKey: 'marketplace_code',
      header: 'Marketplace',
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{getValue()}</Badge>,
    },
    {
      id: 'keyword_count',
      accessorKey: 'keyword_count',
      header: 'Keywords',
      cell: ({ getValue }) => <span className="text-sm">{getValue() ?? '—'}</span>,
    },
    {
      id: 'top10_sv',
      accessorKey: 'top10_sv',
      header: 'Top 10 SV',
      cell: ({ getValue }) => <span className="text-sm text-green-400 font-medium">{formatSV(getValue())}</span>,
    },
    {
      id: 'top50_sv',
      accessorKey: 'top50_sv',
      header: 'Top 50 SV',
      cell: ({ getValue }) => <span className="text-sm">{formatSV(getValue())}</span>,
    },
    {
      id: 'critical_alerts',
      accessorKey: 'critical_alerts',
      header: 'Alerts',
      cell: ({ row }) => {
        const { critical_alerts, open_alerts, health_status } = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={HEALTH_VARIANT[health_status] || 'secondary'} className="capitalize text-xs">
              {health_status || 'unknown'}
            </Badge>
            {critical_alerts > 0 && (
              <Badge variant="critical" className="text-xs">{critical_alerts}</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'last_synced_at',
      accessorKey: 'last_synced_at',
      header: 'Last Synced',
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue())}</span>,
    },
    {
      id: 'watchlist',
      header: '',
      size: 40,
      cell: ({ row }) => {
        const id = row.original.id;
        const pinned = watchlist.includes(id);
        return (
          <button
            onClick={() => setWatchlist(toggleWatchlist(id))}
            title={pinned ? 'Remove from watchlist' : 'Add to watchlist'}
            className={cn(
              'transition-colors p-1 rounded hover:bg-secondary',
              pinned ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'
            )}
          >
            <Star className="w-3.5 h-3.5" fill={pinned ? 'currentColor' : 'none'} />
          </button>
        );
      },
    },
  ], [watchlist]);

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <p className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} products</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
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
                    No products found. Run a DataDive sync to populate products.
                  </td>
                </tr>
              )}
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>{table.getFilteredRowModel().rows.length} products total</span>
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
