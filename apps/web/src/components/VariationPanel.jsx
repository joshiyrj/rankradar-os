export default function VariationPanel({ rows = [] }) {
  return (
    <section className="panel variation-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Child ASIN</span>
          <h2>Variations</h2>
        </div>
        <p>Current keyword ownership.</p>
      </div>
      <div className="variation-list">
        {rows.map((row, index) => (
          <div className="variation-row" key={row.id}>
            <div className="podium">#{index + 1}</div>
            <div>
              <b>{row.variation_label || row.title || row.child_asin}</b>
              <span>{row.child_asin} / {row.sku}</span>
            </div>
            <strong>Rank #{row.organic_rank}</strong>
            <em className={(row.rank_change || 0) > 0 ? 'bad-text' : 'good-text'}>{row.rank_change > 0 ? '+' : ''}{row.rank_change ?? 0}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
