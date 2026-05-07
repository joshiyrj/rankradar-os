import { motion } from 'framer-motion';

function rankDelta(change) {
  if (change === null || change === undefined) return <span className="muted">-</span>;
  if (change > 0) return <span className="delta bad">Down {change}</span>;
  if (change < 0) return <span className="delta good">Up {Math.abs(change)}</span>;
  return <span className="delta neutral">0</span>;
}

export default function KeywordTable({ rows, selectedKeywordId, onSelect }) {
  if (!rows.length) return <div className="empty-state">Keyword history is not returned by the current DataDive endpoint for this Rank Radar.</div>;
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Latest</span>
          <h2>Keywords</h2>
        </div>
        <p>Select a row for trend and variation detail.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Rank</th>
              <th>Change</th>
              <th>Variation</th>
              <th>Search Vol.</th>
              <th>PPC Spend</th>
              <th>PPC Sales</th>
              <th>Alert</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((row, index) => (
              <motion.tr
                key={row.id}
                className={selectedKeywordId === row.keyword_id ? 'selected-row' : ''}
                onClick={() => onSelect(row)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
              >
                <td><b>{row.keyword}</b><small>{row.priority} / {row.marketplace_code}</small></td>
                <td className="rank-number">#{row.organic_rank ?? '-'}</td>
                <td>{rankDelta(row.rank_change)}</td>
                <td>{row.variation_label || row.child_asin || 'Parent'}</td>
                <td>{row.search_volume?.toLocaleString?.() || '-'}</td>
                <td>${Number(row.ppc_spend || 0).toFixed(2)}</td>
                <td>${Number(row.ppc_sales || 0).toFixed(2)}</td>
                <td>{row.alert_type ? <span className={`alert-chip ${row.severity}`}>{row.alert_type.replaceAll('_', ' ')}</span> : <span className="muted">Clean</span>}</td>
                <td><span>{row.rank_date}</span><small>{row.day_name}</small></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
