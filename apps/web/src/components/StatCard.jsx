import { motion } from 'framer-motion';

export default function StatCard({ label, value, hint, tone = 'neutral', icon }) {
  return (
    <motion.div className={`stat-card tone-${tone}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </motion.div>
  );
}
