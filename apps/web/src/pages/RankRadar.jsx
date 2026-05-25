import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { AlertTriangle, CalendarDays, ChevronDown, ChevronUp, ChevronsUpDown, Download, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatPct, formatSV, rankBucket, RANK_BUCKET_LABELS } from '@/lib/utils';
import { api } from '@/api.js';

const TrendChart = lazy(() => import('@/components/TrendChart'));

const BUCKET_COLORS = {
  excellent:   'rank-cell-excellent',
  strong:      'rank-cell-strong',
  near_top10:  'rank-cell-near_top10',
  weak:        'rank-cell-weak',
  poor:        'rank-cell-poor',
  not_ranking: 'rank-cell-not_ranking',
};

const SEVERITY_VARIANT = {
  critical: 'critical', high: 'high', medium: 'medium', low: 'low', positive: 'positive',
};

function RankCell({ rank, date, keyword }) {
  const bucket = rankBucket(rank);
  const cell = (
    <div className={cn('text-center rounded px-1 py-0.5 text-xs font-semibold min-w-[32px] cursor-default', BUCKET_COLORS[bucket])}>
      {rank ?? '—'}
    </div>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top" className="text-left">
        <p className="font-medium mb-0.5">{keyword}</p>
        <p className="text-muted-foreground">{date}</p>
        <p>Rank: <span className="text-foreground font-semibold">{rank ?? 'Not ranking'}</span></p>
        <p>Bucket: <span className="text-foreground">{RANK_BUCKET_LABELS[bucket] ?? bucket}</span></p>
      </TooltipContent>
    </Tooltip>
  );
}

function KPICard({ title, value, sub }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function exportCSV(rows, dates) {
  const headers = ['Keyword', 'Search Volume', ...dates, 'Rank Change', 'Our ASIN Share', 'Our CTR', 'Our CVR', 'Alert'];
  const lines = rows.map((r) => {
    const dateCells = dates.map((d) => {
      const entry = r.dates?.find((x) => x.date === d);
      return entry?.organic_rank ?? '';
    });
    return [
      r.keyword,
      r.search_volume ?? '',
      ...dateCells,
      r.rank_change ?? '',
      r.our_asin_share != null ? (r.our_asin_share * 100).toFixed(1) + '%' : '',
      r.our_ctr != null ? (r.our_ctr * 100).toFixed(1) + '%' : '',
      r.our_cvr != null ? (r.our_cvr * 100).toFixed(1) + '%' : '',
      r.alert_type ?? '',
    ].map((c) => JSON.stringify(c ?? '')).join(',');
  });
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rank-radar-heatmap.csv';
  a.click();
}

// Default date range: last 28 days
function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 27);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function RankRadar({ brands, marketplaces, products, alerts, filters, setFilters, loading: globalLoading }) {
  const [localFilters, setLocalFilters] = useState({ brandId: '', marketplace: '', productId: '' });
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [localMarketplaces, setLocalMarketplaces] = useState(marketplaces);
  const [localProducts, setLocalProducts] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [pageAlerts, setPageAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kwFilter, setKwFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'search_volume', desc: true }]);

  useEffect(() => {
    if (!localFilters.brandId) {
      setLocalMarketplaces(marketplaces);
      return;
    }
    api.marketplaces(localFilters.brandId).then(setLocalMarketplaces).catch(console.error);
  }, [localFilters.brandId, marketplaces]);

  useEffect(() => {
    api.products({ brandId: localFilters.brandId, marketplace: localFilters.marketplace })
      .then(setLocalProducts)
      .catch(console.error);
  }, [localFilters.brandId, localFilters.marketplace]);

  useEffect(() => {
    if (!localFilters.productId) {
      setKeywords([]); setHeatmapData([]); setSummary(null); setPageAlerts([]); setSelectedKeyword(null);
      return;
    }
    setLoading(true);
    const heatmapParams = {};
    if (dateRange.start) heatmapParams.start = dateRange.start;
    if (dateRange.end) heatmapParams.end = dateRange.end;
    Promise.all([
      api.keywords(localFilters.productId),
      api.heatmap(localFilters.productId, heatmapParams).catch(() => []),
      api.summary(localFilters.productId).catch(() => null),
      api.alerts({ productId: localFilters.productId, status: 'open' }).catch(() => []),
    ]).then(([kws, hm, sum, alts]) => {
      setKeywords(kws);
      setHeatmapData(hm);
      setSummary(sum);
      setPageAlerts(alts);
    }).catch(console.error).finally(() => setLoading(false));
  }, [localFilters.productId, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (!localFilters.productId || !selectedKeyword) return;
    api.trend(localFilters.productId, selectedKeyword.keyword_id).then(setTrend).catch(console.error);
  }, [localFilters.productId, selectedKeyword?.keyword_id]);

  const dates = useMemo(() => {
    if (heatmapData.length > 0 && heatmapData[0]?.dates) {
      return heatmapData[0].dates.map((d) => d.date).sort();
    }
    const all = new Set();
    keywords.forEach((kw) => { if (kw.rank_date) all.add(kw.rank_date); });
    return [...all].sort();
  }, [heatmapData, keywords]);

  const tableRows = useMemo(() => {
    if (heatmapData.length > 0) return heatmapData;
    return keywords.map((kw) => ({
      keyword_id: kw.keyword_id,
      keyword: kw.keyword,
      search_volume: kw.search_volume,
      rank_change: kw.rank_change,
      organic_rank: kw.organic_rank,
      our_asin_share: kw.our_asin_share,
      our_ctr: kw.our_ctr,
      our_cvr: kw.our_cvr,
      alert_type: kw.alert_type,
      severity: kw.severity,
      dates: kw.rank_date ? [{ date: kw.rank_date, organic_rank: kw.organic_rank, rank_bucket: rankBucket(kw.organic_rank) }] : [],
    }));
  }, [heatmapData, keywords]);

  const columns = useMemo(() => {
    const fixed = [
      {
        id: 'keyword', accessorKey: 'keyword', header: 'Keyword', size: 220,
        cell: ({ row }) => (
          <button
            className="text-left hover:text-primary transition-colors font-medium text-sm"
            onClick={() => setSelectedKeyword(row.original)}
          >
            {row.original.keyword}
          </button>
        ),
      },
      {
        id: 'search_volume', accessorKey: 'search_volume', header: 'Search Vol', size: 90,
        cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{formatSV(getValue())}</span>,
      },
      {
        id: 'rank_change', accessorKey: 'rank_change', header: 'Change', size: 70,
        cell: ({ getValue }) => {
          const v = getValue();
          if (v == null) return <span className="text-muted-foreground text-xs">—</span>;
          if (v > 0) return <span className="text-red-400 text-xs font-semibold">▼{v}</span>;
          if (v < 0) return <span className="text-green-400 text-xs font-semibold">▲{Math.abs(v)}</span>;
          return <span className="text-muted-foreground text-xs">0</span>;
        },
      },
    ];

    const dateCols = dates.map((d) => ({
      id: `date_${d}`,
      header: () => <span className="text-xs">{d.slice(5)}</span>,
      size: 52,
      cell: ({ row }) => {
        const entry = row.original.dates?.find((x) => x.date === d);
        return <RankCell rank={entry?.organic_rank ?? null} date={d} keyword={row.original.keyword} />;
      },
      accessorFn: (row) => {
        const entry = row.dates?.find((x) => x.date === d);
        return entry?.organic_rank ?? null;
      },
    }));

    const sqpCols = [
      { id: 'our_asin_share', accessorKey: 'our_asin_share', header: 'ASIN Share', size: 90,
        cell: ({ getValue }) => <span className="text-xs">{formatPct(getValue())}</span> },
      { id: 'our_ctr', accessorKey: 'our_ctr', header: 'CTR', size: 70,
        cell: ({ getValue }) => <span className="text-xs">{formatPct(getValue())}</span> },
      { id: 'our_cvr', accessorKey: 'our_cvr', header: 'CVR', size: 70,
        cell: ({ getValue }) => <span className="text-xs">{formatPct(getValue())}</span> },
    ];

    const alertCol = {
      id: 'alert', header: 'Alert', size: 110,
      cell: ({ row }) => {
        const { alert_type, severity } = row.original;
        if (!alert_type) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <Badge variant={SEVERITY_VARIANT[severity] || 'secondary'} className="text-[10px]">
            {alert_type.replaceAll('_', ' ')}
          </Badge>
        );
      },
    };

    return [...fixed, ...dateCols, ...sqpCols, alertCol];
  }, [dates]);

  const table = useReactTable({
    data: tableRows, columns,
    state: { sorting, globalFilter: kwFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setKwFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const selectedProduct = localProducts.find((p) => p.id === localFilters.productId);
  const criticalCount = pageAlerts.filter((a) => a.severity === 'critical').length;

  const isDateRangeDefault =
    dateRange.start === defaultDateRange().start && dateRange.end === defaultDateRange().end;

  return (
    <div className="p-6 space-y-5 max-w-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Brand</label>
          <Select value={localFilters.brandId} onValueChange={(v) => setLocalFilters((f) => ({ ...f, brandId: v, marketplace: '', productId: '' }))}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All brands</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Marketplace</label>
          <Select value={localFilters.marketplace} onValueChange={(v) => setLocalFilters((f) => ({ ...f, marketplace: v, productId: '' }))}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All marketplaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All marketplaces</SelectItem>
              {localMarketplaces.map((m) => <SelectItem key={m.id} value={m.code}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground font-medium">Product</label>
          <Select value={localFilters.productId} onValueChange={(v) => setLocalFilters((f) => ({ ...f, productId: v }))}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select product</SelectItem>
              {localProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Date range picker */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Date Range
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateRange.start}
              max={dateRange.end || undefined}
              onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start || undefined}
              onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {!isDateRangeDefault && (
              <button
                onClick={() => setDateRange(defaultDateRange())}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Reset to last 28 days"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!localFilters.productId && (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          Select a product to view the keyword heatmap
        </div>
      )}

      {localFilters.productId && loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {localFilters.productId && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <KPICard title="Top 10 KW" value={summary?.top10KW ?? selectedProduct?.top10_kw ?? '—'} />
            <KPICard title="Top 50 KW" value={summary?.top50KW ?? selectedProduct?.top50_kw ?? '—'} />
            <KPICard title="Top 10 SV" value={formatSV(summary?.top10SV ?? selectedProduct?.top10_sv)} />
            <KPICard title="Top 50 SV" value={formatSV(summary?.top50SV ?? selectedProduct?.top50_sv)} />
            <KPICard title="Keywords" value={tableRows.length} />
            <KPICard
              title="Critical Alerts"
              value={criticalCount}
              sub={criticalCount > 0 ? 'Open issues' : 'All clear'}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* Main heatmap area */}
            <div className="xl:col-span-3 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords…"
                    value={kwFilter}
                    onChange={(e) => setKwFilter(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => exportCSV(table.getFilteredRowModel().rows.map((r) => r.original), dates)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Download className="w-3 h-3" /> Export CSV
                </Button>
              </div>

              {/* Heatmap Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id}>
                          {hg.headers.map((header) => (
                            <th
                              key={header.id}
                              className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                              style={{ width: header.getSize() }}
                            >
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
                            No keywords found. Sync DataDive data to populate the heatmap.
                          </td>
                        </tr>
                      )}
                      {table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            'border-b border-border/50 hover:bg-muted/20 transition-colors',
                            selectedKeyword?.keyword_id === row.original.keyword_id && 'bg-primary/10'
                          )}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-2 py-1.5 whitespace-nowrap">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                  <span>
                    {table.getFilteredRowModel().rows.length} keywords
                    {kwFilter && ` matching "${kwFilter}"`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-7 text-xs">Prev</Button>
                    <span>Page {table.getState().pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-7 text-xs">Next</Button>
                  </div>
                </div>
              </Card>

              {/* Rank color legend */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="font-medium">Rank buckets:</span>
                {[
                  ['excellent', '1–3'],
                  ['strong', '4–10'],
                  ['near_top10', '11–20'],
                  ['weak', '21–50'],
                  ['poor', '51+'],
                  ['not_ranking', 'NR'],
                ].map(([bucket, label]) => (
                  <span key={bucket} className="flex items-center gap-1">
                    <span className={cn('inline-block w-5 h-4 rounded text-[10px] flex items-center justify-center', BUCKET_COLORS[bucket])} />
                    {label}
                  </span>
                ))}
              </div>

              {/* Trend chart for selected keyword */}
              {selectedKeyword && trend.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Rank Trend — {selectedKeyword.keyword}</span>
                      <button
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setSelectedKeyword(null); setTrend([]); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Suspense fallback={<Skeleton className="h-48" />}>
                      <TrendChart data={trend} />
                    </Suspense>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Alert panel */}
            <div className="xl:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Open Alerts
                    {criticalCount > 0 && <Badge variant="critical" className="ml-auto">{criticalCount}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[600px] overflow-y-auto p-3">
                  {pageAlerts.slice(0, 30).map((a) => (
                    <div key={a.id} className="border-b border-border/50 pb-2 last:border-0">
                      <div className="flex items-start gap-2">
                        <Badge variant={SEVERITY_VARIANT[a.severity] || 'secondary'} className="text-[10px] shrink-0 mt-0.5 capitalize">
                          {a.severity}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{a.keyword}</p>
                          <p className="text-[10px] text-muted-foreground">{a.alert_type?.replaceAll('_', ' ')}</p>
                          <p className="text-[10px] text-muted-foreground">
                            #{a.previous_rank ?? '–'} → {a.current_rank ? `#${a.current_rank}` : 'NR'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pageAlerts.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No open alerts for this product.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
