/**
 * Tiny dependency-free sparkline. Renders an area+line over the given series,
 * scaled to its own max. Flat baseline when there's no activity yet, so the
 * leaderboard degrades gracefully at low volume.
 */
export function Sparkline({
  data,
  width = 96,
  height = 24,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const n = data.length;
  const max = Math.max(1, ...data);
  const pad = 1;
  const stepX = n > 1 ? (width - pad * 2) / (n - 1) : 0;
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const pts = data.map((v, i) => [pad + i * stepX, y(v)] as const);

  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad + (n - 1) * stepX).toFixed(1)},${height - pad} L${pad},${height - pad} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
      className="overflow-visible">
      <path d={area} fill="var(--red)" opacity={0.1} />
      <path d={line} fill="none" stroke="var(--red)" strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}
