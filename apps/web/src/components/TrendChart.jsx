import { Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts';

export default function TrendChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(222 47% 18%)" />
        <XAxis
          dataKey="rank_date"
          tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }}
          minTickGap={24}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          reversed
          tick={{ fontSize: 10, fill: 'hsl(215 20% 55%)' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Rank', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'hsl(215 20% 55%)' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(222 47% 11%)',
            border: '1px solid hsl(222 47% 18%)',
            borderRadius: '6px',
            fontSize: '11px',
            color: 'hsl(213 31% 91%)',
          }}
          formatter={(value, name) => [value != null ? `#${value}` : 'NR', name]}
        />
        <Area
          type="monotone"
          dataKey="organic_rank"
          name="Organic rank"
          stroke="hsl(217 91% 60%)"
          strokeWidth={2}
          fill="hsl(217 91% 60%)"
          fillOpacity={0.08}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
