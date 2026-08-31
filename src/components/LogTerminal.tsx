import { useEffect, useRef, useState } from "react";
import { Eraser, Pause, Play, Radio } from "lucide-react";
import { useApp } from "../lib/store";
import type { LogLevel } from "../lib/types";
import { fmtClock } from "../lib/util";

const LEVEL_STYLE: Record<LogLevel, string> = {
  INFO: "text-cy",
  WARN: "text-amberx",
  ERROR: "text-errx",
  METRIC: "text-peri",
};

const FILTERS: ("ALL" | LogLevel)[] = ["ALL", "INFO", "WARN", "ERROR", "METRIC"];

export default function LogTerminal({ heightClass = "h-[420px]" }: { heightClass?: string }) {
  const logs = useApp((s) => s.logs);
  const filter = useApp((s) => s.logFilter);
  const setFilter = useApp((s) => s.setLogFilter);
  const paused = useApp((s) => s.logPaused);
  const togglePaused = useApp((s) => s.toggleLogPaused);
  const clearLogs = useApp((s) => s.clearLogs);
  const engine = useApp((s) => s.engine);

  const [follow, setFollow] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  const visible = filter === "ALL" ? logs : logs.filter((l) => l.level === filter);
  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    const el = bodyRef.current;
    if (el && follow && !paused) el.scrollTop = el.scrollHeight;
  }, [visible.length, follow, paused]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-deep">
      {/* terminal chrome */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-errx/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amberx/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          </span>
          <span className="ml-1 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold text-mute">
            <Radio size={11} className={engine.status === "running" ? "text-cy" : "text-dim"} />
            live-tail · wss://edge.dataflow.dev{engine.runId ? `/runs/${engine.runId}/logs` : "/cluster/logs"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f;
            const n = f === "ALL" ? logs.length : counts[f] ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide transition-all ${
                  active
                    ? f === "ERROR"
                      ? "border-errx/60 bg-errx/15 text-errx"
                      : f === "WARN"
                        ? "border-amberx/60 bg-amberx/15 text-amberx"
                        : "border-cy/60 bg-cy/15 text-cy"
                    : "border-line bg-panel2/60 text-dim hover:border-line2 hover:text-mute"
                }`}
              >
                {f}
                <span className="ml-1 opacity-60">{n}</span>
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px bg-line2" />
          <button
            onClick={() => setFollow((v) => !v)}
            className={`rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${
              follow ? "border-mint/50 bg-mint/10 text-mint" : "border-line bg-panel2/60 text-dim hover:text-mute"
            }`}
            title="Follow tail"
          >
            TAIL
          </button>
          <button
            onClick={togglePaused}
            className="rounded-md border border-line bg-panel2/60 p-1 text-mute transition-colors hover:border-line2 hover:text-ink"
            title={paused ? "Resume stream" : "Pause stream"}
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}
          </button>
          <button
            onClick={clearLogs}
            className="rounded-md border border-line bg-panel2/60 p-1 text-mute transition-colors hover:border-errx/40 hover:text-errx"
            title="Clear buffer"
          >
            <Eraser size={11} />
          </button>
        </div>
      </div>

      {/* body */}
      <div ref={bodyRef} className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.75] ${heightClass}`}>
        {visible.length === 0 && (
          <p className="mt-6 text-center text-[11px] text-dim">No {filter !== "ALL" ? filter + " " : ""}events in buffer — start a run to stream telemetry.</p>
        )}
        {visible.map((l) => (
          <div
            key={l.id}
            className={`group flex gap-2 rounded px-1 transition-colors hover:bg-panel2/50 ${
              l.level === "ERROR" ? "border-l-2 border-errx bg-errx/5 pl-2" : "border-l-2 border-transparent pl-2"
            }`}
          >
            <span className="shrink-0 select-none text-dim">{fmtClock(l.ts)}</span>
            <span className={`w-[52px] shrink-0 select-none font-bold ${LEVEL_STYLE[l.level]}`}>{l.level}</span>
            <span className="w-[120px] shrink-0 truncate select-none text-mute/80">{l.source}</span>
            <span className={`min-w-0 break-words ${l.level === "ERROR" ? "text-ink" : "text-[#b8c8e2]"}`}>{l.message}</span>
          </div>
        ))}
        {!paused && (
          <div className="flex items-center gap-2 px-1 text-dim">
            <span className="anim-blink text-cy">▍</span>
            <span className="text-[10px]">streaming…</span>
          </div>
        )}
        {paused && (
          <div className="px-1 py-1">
            <span className="rounded border border-amberx/40 bg-amberx/10 px-2 py-0.5 text-[10px] font-bold text-amberx">
              STREAM PAUSED — {logs.length} events buffered server-side
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
