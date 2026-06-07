// Dependency-free sparkline so the dashboard doesn't pull in Recharts.
export function MiniSpark({
  data,
  color,
  width = 120,
  height = 40,
}: {
  data: { value: number }[]
  color: string
  width?: number
  height?: number
}) {
  const vals = data.map((d) => d.value)
  if (vals.length < 2) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const stepX = width / (vals.length - 1)
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8)
  const pts = vals.map((v, i) => `${i * stepX},${y(v)}`)
  const d = `M ${pts.join(' L ')}`
  const area = `${d} L ${width},${height} L 0,${height} Z`
  const gid = `ms-${color.replace('#', '')}`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
