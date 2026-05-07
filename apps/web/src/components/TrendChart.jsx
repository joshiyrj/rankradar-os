import { Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart, Bar } from 'recharts';

export default function TrendChart({ data = [] }) {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Trend</span>
          <h2>Rank + PPC</h2>
        </div>
        <p>Lower rank is better.</p>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={310}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rank_date" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis yAxisId="rank" reversed tick={{ fontSize: 11 }} />
            <YAxis yAxisId="spend" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area yAxisId="rank" type="monotone" dataKey="organic_rank" name="Organic rank" strokeWidth={3} fillOpacity={0.12} />
            <Line yAxisId="rank" type="monotone" dataKey="sponsored_rank" name="Sponsored rank" strokeWidth={2} dot={false} />
            <Bar yAxisId="spend" dataKey="ppc_spend" name="PPC spend" barSize={8} opacity={0.25} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
