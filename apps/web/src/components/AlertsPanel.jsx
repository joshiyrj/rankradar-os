import { BellRing } from 'lucide-react';

export default function AlertsPanel({ alerts = [], onAcknowledge, onResolve }) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Risk</span>
          <h2><BellRing size={19} /> Alerts</h2>
        </div>
        <p>Open rank movement signals.</p>
      </div>
      <div className="alert-list">
        {alerts.slice(0, 60).map((alert) => (
          <article className={`alert-item ${alert.severity}`} key={alert.id}>
            <div>
              <span className="alert-type">{alert.alert_type?.replaceAll('_', ' ')}</span>
              <h3>{alert.keyword}</h3>
              <p>{alert.product_title} / {alert.asin} / {alert.marketplace_code}</p>
            </div>
            <div className="alert-ranks">
              <span>#{alert.previous_rank ?? '-'}</span>
              <b>{'->'}</b>
              <span>#{alert.current_rank ?? 'NR'}</span>
            </div>
            <div className="alert-actions">
              <button onClick={() => onAcknowledge(alert.id)}>Ack</button>
              <button onClick={() => onResolve(alert.id)}>Resolve</button>
            </div>
          </article>
        ))}
        {!alerts.length && <div className="empty-state">No alerts for the selected filters.</div>}
      </div>
    </section>
  );
}
