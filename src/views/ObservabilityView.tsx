import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Gauge, History, MemoryStick, Square, Table2, Waves } from "lucide-react";
import { useApp } from "../lib/store";
import LogTerminal from "../components/LogTerminal";
import { Meter, RingGauge, RunBars, SparkArea } from "../components/charts";
import { Pill, engineTone } from "../components/ui";
import { STATUS_COLOR } from "../lib/catalog";
import { fmtMs, fmtRows, timeAgoShort } from "../lib/util";

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function ObservabilityView() {
  const engine = useApp((s) => s.engine);
  const series = useApp((s) => s.series);
  const nodes = useApp((s) => s.nodes);
  const nodeStats = useApp((s) => s.nodeStats);
  const runs = useApp((s) => s.runs);
  const stopRun = useApp((s) => s.stopRun);

  const running = engine.status === "running";
  const now = useNow(running);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const cpu = series.cpu[series.cpu.length - 1] ?? 0;
  const ram = series.ram[series.ram.length - 1] ?? 0;
  const rps = series.rps[series.rps.length - 1] ?? 0;
  const elapsed = running && engine.startedAt ? now - engine.startedAt : null;

  const steps = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.data.label,
        kind: n.data.kind,
        status: n.data.status,
        rows: n.data.rows,
        durationMs: n.data.durationMs,
        peakMB: nodeStats[n.id]?.peakMB ?? 0,
      })),
    [nodes, nodeStats],
  );

  const selected = runs.find((r) => r.id === selectedRun) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5">
      {/* header strip */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line2 bg-panel2 text-cy">
            <Activity size={17} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight tracking-tight text-ink">Execution Telemetry</h2>
            <p className="font-mono text-[10.5px] text-dim">
              {engine.runId ?? "cluster idle"} · workers w-01…w-03 · gRPC stream 200ms flush
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {engine.backpressure && (
            <Pill tone="amber" pulse>backpressure · intake −55%</Pill>
          )}
          <Pill tone={engineTone(engine.status)} pulse={running}>{running ? "streaming" : engine.status}</Pill>
          {running && (
            <button
              onClick={stopRun}
              className="flex items-center gap-1.5 rounded-lg border border-errx/50 bg-errx/15 px-2.5 py-1 text-[11px] font-bold text-errx transition-colors hover:bg-errx/25"
            >
              <Square size={10} fill="currentColor" /> Abort
            </button>
          )}
        </div>
      </div>

      {/* stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { icon: <Waves size={15} />, label: "Rows processed", value: fmtRows(engine.rowsProcessed), sub: "this run", color: "#4cc9f0" },
          { icon: <Gauge size={15} />, label: "Throughput", value: fmtRows(rps), sub: "rows / sec", color: "#3dd68c" },
          { icon: <History size={15} />, label: "Elapsed", value: elapsed !== null ? fmtMs(elapsed) : "—", sub: running ? "wall clock" : "no active run", color: "#ff7849" },
          { icon: <MemoryStick size={15} />, label: "Heap / RAM", value: `${Math.round(ram)}%`, sub: `${(ram * 0.08).toFixed(1)}GB of 8GB pool`, color: ram > 84 ? "#ff5c5c" : "#9d8cff" },
        ].map((t) => (
          <div key={t.label} className="group rounded-xl border border-line bg-panel/70 p-3.5 transition-colors hover:border-line2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-dim">{t.label}</span>
              <span style={{ color: t.color }} className="opacity-70 transition-opacity group-hover:opacity-100">{t.icon}</span>
            </div>
            <p className="mt-1.5 font-display text-[22px] font-bold leading-none tracking-tight text-ink">{t.value}</p>
            <p className="mt-1 font-mono text-[10px] text-dim">{t.sub}</p>
          </div>
        ))}
      </div>

      {/* dual pane */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        {/* left: resources + steps */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-panel/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cpu size={14} className="text-cy" />
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Worker resources</h3>
            </div>
            <div className="flex items-center justify-around">
              <RingGauge value={cpu} label="CPU" color="#4cc9f0" warnAt={88} />
              <RingGauge value={ram} label="RAM" color="#9d8cff" warnAt={84} />
            </div>
            <div className="mt-4 space-y-3">
              <Meter label="Heap buffer" value={ram} color={ram > 84 ? "#ff5c5c" : "#9d8cff"} right={`${(ram * 0.08).toFixed(1)} / 8 GB`} />
              <Meter label="Disk spill" value={Math.min(100, ram * 0.42)} color="#ff8a5c" right={`${(ram * 0.021).toFixed(1)} / 50 GB`} />
            </div>
            {engine.backpressure && (
              <p className="mt-3 rounded-lg border border-amberx/30 bg-amberx/10 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-amberx">
                Dynamic backpressure active — consumer fetch.max.bytes reduced 55% until heap &lt; 72%.
              </p>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel/70 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Table2 size={14} className="text-mint" />
              <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Step metrics</h3>
              <span className="ml-auto font-mono text-[9.5px] text-dim">{steps.length} stages</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left font-mono text-[9px] uppercase tracking-wider text-dim">
                    <th className="pb-1.5 pr-2 font-semibold">Stage</th>
                    <th className="pb-1.5 pr-2 text-right font-semibold">Rows</th>
                    <th className="pb-1.5 pr-2 text-right font-semibold">Time</th>
                    <th className="pb-1.5 text-right font-semibold">Heap</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((st) => (
                    <tr key={st.id} className="border-t border-line/60 transition-colors hover:bg-panel2/40">
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.status === "pending" || st.status === "running" ? "anim-pulse-dot" : ""}`}
                            style={{ background: STATUS_COLOR[st.status] }}
                          />
                          <span className="truncate">{st.label}</span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-[10.5px] text-mute">{st.rows ? fmtRows(st.rows) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-[10.5px] text-mute">
                        {st.status === "running" ? `${Math.floor(useApp.getState().nodes.find((n) => n.id === st.id)?.data.progress ?? 0)}%` : st.durationMs ? fmtMs(st.durationMs) : "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono text-[10.5px] text-mute">{st.peakMB ? `${st.peakMB}MB` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* right: logs + throughput */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="rounded-xl border border-line bg-panel/70 p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">
                <Gauge size={14} className="text-mint" /> Stream rate · rows/sec
              </h3>
              <span className="font-mono text-[10px] text-dim">window · last 36s</span>
            </div>
            <SparkArea data={series.rps} color="#3dd68c" height={74} unit=" r/s" />
          </div>
          <div className="min-h-[380px] flex-1">
            <LogTerminal heightClass="" />
          </div>
        </div>
      </div>

      {/* history */}
      <div className="mt-4 rounded-xl border border-line bg-panel/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <History size={14} className="text-ember" />
          <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Run history · duration comparison</h3>
          <span className="ml-auto font-mono text-[10px] text-dim">
            {selected ? `${selected.id} · ${fmtRows(selected.rows)} rows · peak CPU ${selected.peakCpu}% / RAM ${selected.peakRam}%` : "click a bar to inspect"}
          </span>
        </div>
        <RunBars runs={runs.slice(0, 12)} onSelect={(id) => setSelectedRun(id === selectedRun ? null : id)} selectedId={selectedRun} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left font-mono text-[9.5px] uppercase tracking-wider text-dim">
                <th className="pb-2 pr-3 font-semibold">Run</th>
                <th className="pb-2 pr-3 font-semibold">Started</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 text-right font-semibold">Rows</th>
                <th className="pb-2 pr-3 text-right font-semibold">Duration</th>
                <th className="pb-2 pr-3 text-right font-semibold">Peak CPU</th>
                <th className="pb-2 text-right font-semibold">Peak RAM</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRun(r.id === selectedRun ? null : r.id)}
                  className={`cursor-pointer border-t border-line/60 transition-colors hover:bg-panel2/40 ${selectedRun === r.id ? "bg-panel2/60" : ""}`}
                >
                  <td className="py-2 pr-3 font-mono text-[11px] font-semibold text-ink">{r.id}</td>
                  <td className="py-2 pr-3 font-mono text-[10.5px] text-mute">{timeAgoShort(r.startedAt)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                        r.status === "succeeded" ? "border-mint/40 bg-mint/10 text-mint" : r.status === "failed" ? "border-errx/40 bg-errx/10 text-errx" : "border-amberx/40 bg-amberx/10 text-amberx"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-[11px] text-mute">{fmtRows(r.rows)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-[11px] text-mute">{fmtMs(r.durationMs)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-[11px] text-mute">{r.peakCpu}%</td>
                  <td className="py-2 text-right font-mono text-[11px] text-mute">{r.peakRam}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
