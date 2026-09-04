import { useId } from "react";

/* ---------- streaming area chart ---------- */

export function SparkArea({
  data,
  color,
  height = 56,
  max,
  unit,
}: {
  data: number[];
  color: string;
  height?: number;
  max?: number;
  unit?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const w = 300;
  const h = 100;
  const peak = max ?? Math.max(10, ...data) * 1.15;
  const n = Math.max(2, data.length);
  const pts = data.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - Math.min(1, v / peak) * (h - 6) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = data[data.length - 1] ?? 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} className="block w-full">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#1e2a40" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1]?.[0] ?? w} cy={pts[pts.length - 1]?.[1] ?? h} r="3.4" fill={color}>
          <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span
        className="absolute right-1.5 top-1 rounded border border-line bg-deep/80 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
        style={{ color }}
      >
        {typeof last === "number" ? Math.round(last).toLocaleString() : last}
        {unit ?? ""}
      </span>
    </div>
  );
}

/* ---------- ring gauge ---------- */

export function RingGauge({
  value,
  label,
  color,
  size = 92,
  warnAt,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
  warnAt?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const hot = warnAt !== undefined && v >= warnAt;
  const col = hot ? "#ff5c5c" : color;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2a40" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (v / 100) * c}
            style={{ transition: "stroke-dashoffset 380ms cubic-bezier(.4,0,.2,1), stroke 300ms", filter: hot ? `drop-shadow(0 0 6px ${col})` : undefined }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[17px] font-bold leading-none" style={{ color: col }}>
            {Math.round(v)}
            <span className="text-[10px] font-semibold text-dim">%</span>
          </span>
        </div>
      </div>
      <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${hot ? "text-errx" : "text-mute"}`}>
        {label}
      </span>
    </div>
  );
}

/* ---------- run history bars ---------- */

export function RunBars({
  runs,
  onSelect,
  selectedId,
}: {
  runs: { id: string; durationMs: number; status: string; rows: number }[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const maxDur = Math.max(...runs.map((r) => r.durationMs), 1);
  const color = (s: string) => (s === "succeeded" ? "#3dd68c" : s === "failed" ? "#ff5c5c" : "#ffc53d");
  return (
    <div className="flex h-[150px] items-end gap-2">
      {runs.map((r) => {
        const h = Math.max(8, (r.durationMs / maxDur) * 120);
        const sel = selectedId === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onSelect?.(r.id)}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            title={`${r.id} · ${(r.durationMs / 1000).toFixed(1)}s · ${r.rows.toLocaleString()} rows · ${r.status}`}
          >
            <span className="font-mono text-[9.5px] text-dim opacity-0 transition-opacity group-hover:opacity-100">
              {(r.durationMs / 1000).toFixed(1)}s
            </span>
            <div
              className="w-full max-w-[42px] rounded-t-[4px] transition-all duration-300"
              style={{
                height: h,
                background: `linear-gradient(180deg, ${color(r.status)}cc, ${color(r.status)}55)`,
                boxShadow: sel ? `0 0 0 1.5px ${color(r.status)}, 0 0 16px ${color(r.status)}66` : undefined,
                opacity: sel || selectedId == null ? 1 : 0.45,
              }}
            />
            <span className={`font-mono text-[9px] ${sel ? "text-ink" : "text-dim"}`}>
              {r.id.replace("run-", "#")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- horizontal meter ---------- */

export function Meter({ value, color, label, right }: { value: number; color: string; label: string; right?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">{label}</span>
        <span className="font-mono text-[10.5px] font-semibold text-ink">{right ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel3">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, value)}%`, background: color, boxShadow: `0 0 8px ${color}88` }}
        />
      </div>
    </div>
  );
}
