import { motion } from 'framer-motion';

function intensityClass(value = 0) {
  if (value >= 0.75) return 'hm-4';
  if (value >= 0.55) return 'hm-3';
  if (value >= 0.35) return 'hm-2';
  if (value >= 0.15) return 'hm-1';
  return 'hm-0';
}

export default function Heatmap({ data = [] }) {
  return (
    <section className="panel heatmap-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Volatility</span>
          <h2>Heatmap</h2>
        </div>
        <p>Darker means more risk.</p>
      </div>
      <div className="heatmap-grid">
        {data.map((cell, index) => (
          <motion.div
            key={cell.rank_date}
            className={`heat-cell ${intensityClass(cell.intensity ?? ((cell.drops || 0) / 6))}`}
            title={`${cell.rank_date} / Avg rank ${cell.avg_rank || cell.avgRank || '-'} / Drops ${cell.drops || 0}`}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.015 }}
          >
            <span>{new Date(cell.rank_date).getDate()}</span>
            <b>{cell.drops || 0}</b>
          </motion.div>
        ))}
      </div>
      <div className="legend"><span /> Low risk <span /> Watch <span /> Critical</div>
    </section>
  );
}
