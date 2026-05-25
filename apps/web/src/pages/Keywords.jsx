import { useEffect, useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSV, rankBucket, RANK_BUCKET_LABELS } from '@/lib/utils';
import { api } from '@/api.js';

const BUCKET_VARIANT = {
  excellent: 'positive', strong: 'positive', near_top10: 'medium', weak: 'high', poor: 'critical', not_ranking: 'secondary',
};
const SEVERITY_VARIANT = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive' };

export default function Keywords({ products, filters }) {
  const [allKeywords, setAllKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'search_volume', desc: true }]);

  // Load keywords from all products (or filtered ones)
  useEffect(() => {
    const targetProducts = products.slice(0, 20); // limit to avoid flooding API
    if (targetProducts.length === 0) return;
    setLoading(true);
    Promise.all(
      targetProducts.map((p) =>
        api.keywords(p.id).then((kws) =>
          kws.map((kw) => ({
            ...kw,
            product_title: p.title,
            brand_name: p.brand_name,
            marketplace_code: p.marketplace_code,
          }))
        ).catch(() => [])
      )
    ).then((results) => {
      setAllKeywords(results.flat());
    }).finally(() => setLoading(false));
  }, [products]);

  const columns = useMemo(() => [
    {
      id: 'keyword',
      accessorKey: 'keyword',
      header: 'Keyword',
      cell: ({ getValue }) => <span className="text-sm font-medium">{getValue()}</span>,
    },
    {
      id: 'brand_name',
      accessorKey: 'brand_name',
      header: 'Brand',
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue()}</span>,
    },
    {
      id: 'marketplace_code',
      accessorKey: 'marketplace_code',
      header: 'Marketplace',
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{getValue()}</Badge>,
    },
    {
      id: 'product_title',
      accessorKey: 'product_title',
      header: 'Product',
      cell: ({ getValue }) => <span className="text-xs text-muted-foreground max-w-[180px] truncate block">{getValue()}</span>,
    },
    {
      id: 'search_volume',
      accessorKey: 'search_volume',
      header: 'Search Vol',
      cell: ({ getValue }) => <span className="text-sm font-medium">{formatSV(getValue())}</span>,
    },
    {
      id: 'organic_rank',
      accessorKey: 'organic_rank',
      header: 'Current Rank',
      cell: ({ getValue }) => {
        const rank = getValue();
        const bucket = rankBucket(rank);
        return (
          <Badge variant={BUCKET_VARIANT[bucket] || 'secondary'} className="text-xs">
            {rank != null ? `#${rank}` : 'NR'}
          </Badge>
        );
      },
    },
    {
      id: 'previous_organic_rank',
      accessorKey: 'previous_organic_rank',
      header: 'Prev Rank',
      cell: ({ getValue }) => {
        const v = getValue();
        return <span className="text-xs text-muted-foreground">{v != null ? `#${v}` : '—'}</span>;
      },
    },
    {
      id: 'rank_change',
      accessorKey: 'rank_change',
      header: 'Change',
      cell: ({ getValue }) => {
        const v = getValue();
        if (v == null) return <span className="text-muted-foreground text-xs">—</span>;
        if (v > 0) return <span className="text-red-400 text-xs font-semibold">▼{v}</span>;
        if (v < 0) return <span className="text-green-400 text-xs font-semibold">▲{Math.abs(v)}</span>;
        return <span className="text-muted-foreground text-xs">0</span>;
      },
    },
    {
      id: 'alert_type',
      accessorKey: 'alert_type',
      header: 'Alert',
      cell: ({ row }) => {
        const { alert_type, severity } = row.original;
        if (!alert_type) return <span className="text-xs text-muted-foreground">—</span>;
        return <Badge variant={SEVERITY_VARIANT[severity] || 'secondary'} className="text-[10px]">{alert_type.replaceAll('_', ' ')}</Badge>;
      },
    },
  ], []);

  const table = useReactTable({
    data: allKeywords,
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
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search keywords…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <p className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} keywords</p>
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
                    No keywords loaded. Select a product on the Rank Radar page or sync DataDive data.
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
          <span>{table.getFilteredRowModel().rows.length} keywords</span>
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
