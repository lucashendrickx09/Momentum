import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { prettyShort } from '../../lib/dates'

type Point = { date: string; value: number }

const axisProps = {
  tick: { fontSize: 10, fill: 'var(--text-3)' },
  tickLine: false,
  axisLine: false,
} as const

function tickFmt(d: string) {
  return prettyShort(d)
}

export function TrendArea({
  data,
  color,
  height = 180,
  unit = '',
  yDomain,
}: {
  data: Point[]
  color: string
  height?: number
  unit?: string
  yDomain?: [number, number]
}) {
  const id = `g-${color.replace('#', '')}`
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={tickFmt} minTickGap={28} {...axisProps} />
          <YAxis width={40} domain={yDomain ?? ['auto', 'auto']} {...axisProps} />
          <Tooltip
            labelFormatter={(l) => prettyShort(String(l))}
            formatter={(v) => [`${v}${unit}`, '']}
            cursor={{ stroke: 'var(--border-strong)' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.4}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TrendLine({
  data,
  color,
  height = 180,
  unit = '',
}: {
  data: Point[]
  color: string
  height?: number
  unit?: string
}) {
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={tickFmt} minTickGap={28} {...axisProps} />
          <YAxis width={40} {...axisProps} />
          <Tooltip
            labelFormatter={(l) => prettyShort(String(l))}
            formatter={(v) => [`${v}${unit}`, '']}
            cursor={{ stroke: 'var(--border-strong)' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.4}
            dot={{ r: 2.5, fill: color }}
            activeDot={{ r: 4 }}
            isAnimationActive
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Bars({
  data,
  color,
  height = 170,
  unit = '',
  target,
}: {
  data: Point[]
  color: string
  height?: number
  unit?: string
  target?: number
}) {
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={tickFmt} minTickGap={20} {...axisProps} />
          <YAxis width={40} allowDecimals={false} {...axisProps} />
          <Tooltip
            labelFormatter={(l) => prettyShort(String(l))}
            formatter={(v) => [`${v}${unit}`, '']}
            cursor={{ fill: 'color-mix(in srgb, var(--text-3) 12%, transparent)' }}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke={color}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: `target ${target}`, position: 'right', fill: 'var(--text-3)', fontSize: 10 }}
            />
          )}
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({ data, color, height = 44 }: { data: Point[]; color: string; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
