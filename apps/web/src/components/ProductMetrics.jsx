export default function ProductMetrics({ product, summary }) {
  if (!product) return null;
  const metrics = [
    ['Keywords', product.keyword_count ?? summary?.trackedKeywords ?? 0],
    ['Top 10 KW', product.top10_kw ?? summary?.top10KW ?? 0],
    ['Top 10 SV', product.top10_sv ?? summary?.top10SV ?? 0],
    ['Top 50 KW', product.top50_kw ?? summary?.top50KW ?? 0],
    ['Top 50 SV', product.top50_sv ?? summary?.top50SV ?? 0],
    ['Status', product.datadive_status || summary?.status || 'active'],
  ];
  return (
    <section className="panel real-data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Real DataDive fields</span>
          <h2>Product metrics</h2>
        </div>
        <p>Live values from DataDive Rank Radar.</p>
      </div>
      <div className="real-metric-grid">
        {metrics.map(([label, value]) => (
          <div className="real-metric" key={label}>
            <span>{label}</span>
            <b>{typeof value === 'number' ? value.toLocaleString() : value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
