import { useCallback, useMemo, useRef } from "react";
import type { DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  Database,
  Frame,
  GitMerge,
  HardDrive,
  Maximize2,
  Minimize2,
  Play,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useApp, validateConnection } from "../lib/store";
import type { NodeKind } from "../lib/types";
import { KIND_ORDER, NODE_META, STATUS_COLOR } from "../lib/catalog";
import { nodeTypes } from "../components/FlowNodes";
import { Pill, engineTone } from "../components/ui";
import { fmtMs, fmtRows } from "../lib/util";

const KIND_ICON: Record<NodeKind, typeof Database> = {
  source: Database,
  transform: SlidersHorizontal,
  join: GitMerge,
  quality: ShieldCheck,
  aggregate: Sigma,
  destination: HardDrive,
};

const GROUPS: { name: string; kinds: NodeKind[] }[] = [
  { name: "Ingest", kinds: ["source"] },
  { name: "Shape", kinds: ["transform", "join", "aggregate"] },
  { name: "Govern", kinds: ["quality"] },
  { name: "Load", kinds: ["destination"] },
];

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#3a4c66" },
  style: { stroke: "#3a4c66", strokeWidth: 1.6 },
};

function Palette() {
  const addNodeAt = useApp((s) => s.addNodeAt);
  const plugins = useApp((s) => s.plugins);
  const installed = plugins.filter((p) => p.installed);

  const onDragStart = (e: DragEvent, kind: NodeKind, pluginId?: string) => {
    e.dataTransfer.setData("application/dataflow", kind);
    if (pluginId) e.dataTransfer.setData("application/dataflowplugin", pluginId);
    e.dataTransfer.effectAllowed = "move";
  };

  const clickAdd = (kind: NodeKind, label?: string) => {
    const n = useApp.getState().nodes.length;
    addNodeAt(kind, { x: 220 + (n % 4) * 40, y: 160 + (n % 5) * 46 }, label);
  };

  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-line bg-panel/60">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-ink">Node Palette</h3>
        <p className="mt-0.5 text-[10.5px] leading-snug text-dim">Drag onto the canvas · DAG rules enforced</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {GROUPS.map((g) => (
          <div key={g.name} className="mb-4">
            <p className="mb-1.5 px-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">{g.name}</p>
            <div className="space-y-1.5">
              {g.kinds.map((kind) => {
                const meta = NODE_META[kind];
                const Icon = KIND_ICON[kind];
                return (
                  <motion.button
                    key={kind}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as DragEvent, kind)}
                    onClick={() => clickAdd(kind)}
                    className="group flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-line bg-panel2/70 px-2.5 py-2 text-left transition-colors hover:border-line2 hover:bg-panel2 active:cursor-grabbing"
                    title={meta.blurb}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                      style={{ background: `${meta.color}14`, borderColor: `${meta.color}3a`, color: meta.color }}
                    >
                      <Icon size={13.5} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">{meta.label}</span>
                      <span className="block truncate text-[10px] text-dim">{meta.group} · core</span>
                    </span>
                    <span className="font-mono text-[10px] text-dim opacity-0 transition-opacity group-hover:opacity-100">+ add</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
        {installed.length > 0 && (
          <div className="mb-2">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">
              <Plug size={10} className="text-ember" /> Plugin nodes
            </p>
            <div className="space-y-1.5">
              {installed.map((p) => {
                const meta = NODE_META[p.kind];
                const Icon = KIND_ICON[p.kind];
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    draggable
                    onDragStart={(e) => onDragStart(e as unknown as DragEvent, p.kind, p.id)}
                    onClick={() => clickAdd(p.kind, p.name)}
                    className="group flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-dashed border-line bg-panel2/40 px-2.5 py-2 text-left transition-colors hover:border-ember/40 hover:bg-panel2 active:cursor-grabbing"
                    title={p.description}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                      style={{ background: `${meta.color}10`, borderColor: `${meta.color}30`, color: meta.color }}
                    >
                      <Icon size={13.5} strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">{p.name}</span>
                      <span className="block truncate font-mono text-[9.5px] text-ember/80">v{p.version} · {p.runtime}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Inspector() {
  const nodes = useApp((s) => s.nodes);
  const edges = useApp((s) => s.edges);
  const updateNodeConfig = useApp((s) => s.updateNodeConfig);
  const deleteNode = useApp((s) => s.deleteNode);
  const runs = useApp((s) => s.runs);
  const resetSample = useApp((s) => s.resetSample);
  const engine = useApp((s) => s.engine);

  const selected = nodes.find((n) => n.selected);

  if (!selected) {
    const counts = nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.data.status] = (acc[n.data.status] ?? 0) + 1;
      return acc;
    }, {});
    const last = runs[0];
    return (
      <aside className="flex w-[264px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel/60 px-4 py-4">
        <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.14em] text-ink">Pipeline Graph</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-mute">
          Select a node to edit its config. Drag from a right port to a left port to wire stages — cycles and illegal
          directions are rejected.
        </p>

        <div className="mt-4 space-y-1.5">
          {(["running", "pending", "succeeded", "failed", "skipped", "idle"] as const).map((st) =>
            counts[st] ? (
              <div key={st} className="flex items-center justify-between rounded-md border border-line bg-panel2/50 px-2.5 py-1.5">
                <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wide text-mute">
                  <span className={`h-1.5 w-1.5 rounded-full ${st === "pending" ? "anim-pulse-dot" : ""}`} style={{ background: STATUS_COLOR[st] }} />
                  {st}
                </span>
                <span className="font-mono text-[11px] font-bold text-ink">{counts[st]}</span>
              </div>
            ) : null,
          )}
        </div>

        <div className="mt-4 rounded-lg border border-line bg-deep/50 p-3">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">Topology</p>
          <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <span className="text-mute">nodes</span><span className="text-right font-bold text-ink">{nodes.length}</span>
            <span className="text-mute">edges</span><span className="text-right font-bold text-ink">{edges.length}</span>
            <span className="text-mute">concurrency</span><span className="text-right font-bold text-ink">3</span>
          </div>
        </div>

        {last && (
          <div className="mt-3 rounded-lg border border-line bg-deep/50 p-3">
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">Last run · {last.id}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <span className="text-mute">status</span>
              <span className={`text-right font-bold ${last.status === "succeeded" ? "text-mint" : last.status === "failed" ? "text-errx" : "text-amberx"}`}>{last.status}</span>
              <span className="text-mute">rows</span><span className="text-right font-bold text-ink">{fmtRows(last.rows)}</span>
              <span className="text-mute">duration</span><span className="text-right font-bold text-ink">{fmtMs(last.durationMs)}</span>
              <span className="text-mute">peak RAM</span><span className="text-right font-bold text-ink">{last.peakRam}%</span>
            </div>
          </div>
        )}

        <button
          onClick={resetSample}
          className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-line2 bg-panel2 px-3 py-2 text-[12px] font-semibold text-mute transition-colors hover:border-cy/40 hover:text-cy"
        >
          <RefreshCw size={13} /> Restore reference pipeline
        </button>

        {engine.rowsProcessed > 0 && (
          <p className="mt-3 text-center font-mono text-[10px] text-dim">
            session throughput · <span className="text-cy">{fmtRows(engine.rowsProcessed)}</span> rows processed
          </p>
        )}
      </aside>
    );
  }

  const meta = NODE_META[selected.data.kind];
  const Icon = KIND_ICON[selected.data.kind];

  return (
    <aside className="flex w-[264px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel/60">
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ background: `${meta.color}16`, borderColor: `${meta.color}40`, color: meta.color }}>
            <Icon size={15} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[13px] font-bold text-ink">{selected.data.label}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-widest text-dim">{meta.label} · {selected.id}</p>
          </div>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-mute">{meta.blurb}</p>
      </div>

      <div className="flex-1 space-y-3.5 px-4 py-4">
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">Node config</p>
        {meta.fields.map((f) => {
          const val = selected.data.config[f.key];
          if (f.type === "select") {
            return (
              <label key={f.key} className="block">
                <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">{f.label}</span>
                <select
                  value={String(val)}
                  onChange={(e) => updateNodeConfig(selected.id, { [f.key]: e.target.value })}
                  className="w-full rounded-lg border border-line2 bg-panel2 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-cy/60"
                >
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          if (f.type === "range") {
            return (
              <label key={f.key} className="block">
                <span className="mb-1.5 flex justify-between font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">
                  {f.label}
                  <span className="text-ember">{String(val)}{f.key === "threshold" ? "%" : ""}</span>
                </span>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Number(val)}
                  onChange={(e) => updateNodeConfig(selected.id, { [f.key]: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            );
          }
          if (f.type === "number") {
            return (
              <label key={f.key} className="block">
                <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">{f.label}</span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Number(val)}
                  onChange={(e) => updateNodeConfig(selected.id, { [f.key]: Number(e.target.value) })}
                  className="w-full rounded-lg border border-line2 bg-panel2 px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-cy/60"
                />
              </label>
            );
          }
          return (
            <label key={f.key} className="block">
              <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-mute">{f.label}</span>
              <input
                type="text"
                value={String(val)}
                onChange={(e) => updateNodeConfig(selected.id, { [f.key]: e.target.value })}
                className="w-full rounded-lg border border-line2 bg-panel2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-cy/60"
              />
            </label>
          );
        })}
      </div>

      <div className="border-t border-line p-4">
        <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
          <span className="text-mute">status</span>
          <span className="text-right font-bold" style={{ color: STATUS_COLOR[selected.data.status] }}>{selected.data.status}</span>
          <span className="text-mute">rows</span>
          <span className="text-right font-bold text-ink">{selected.data.rows ? fmtRows(selected.data.rows) : "—"}</span>
        </div>
        <button
          onClick={() => deleteNode(selected.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-errx/30 bg-errx/10 px-3 py-2 text-[12px] font-semibold text-errx transition-colors hover:bg-errx/20"
        >
          <Trash2 size={13} /> Remove node
        </button>
      </div>
    </aside>
  );
}

function CanvasInner() {
  const nodes = useApp((s) => s.nodes);
  const edges = useApp((s) => s.edges);
  const onNodesChange = useApp((s) => s.onNodesChange);
  const onEdgesChange = useApp((s) => s.onEdgesChange);
  const onConnect = useApp((s) => s.onConnect);
  const addNodeAt = useApp((s) => s.addNodeAt);
  const startRun = useApp((s) => s.startRun);
  const stopRun = useApp((s) => s.stopRun);
  const engine = useApp((s) => s.engine);
  const pushToast = useApp((s) => s.pushToast);
  const plugins = useApp((s) => s.plugins);

  const flowRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();

  const displayEdges = useMemo(() => {
    const statusOf = new Map(nodes.map((n) => [n.id, n.data.status]));
    return edges.map((e) => ({
      ...e,
      className: statusOf.get(e.source) === "running" ? "edge-live" : "",
      animated: statusOf.get(e.source) === "running",
    }));
  }, [edges, nodes]);

  const isValid = useCallback(
    (c: Connection | { source: string | null; target: string | null }) =>
      validateConnection(useApp.getState, c as Connection) === null,
    [],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/dataflow") as NodeKind | "";
      if (!kind || !NODE_META[kind]) return;
      const pluginId = e.dataTransfer.getData("application/dataflowplugin");
      const plugin = pluginId ? plugins.find((p) => p.id === pluginId) : undefined;
      const pos = screenToFlowPosition({ x: e.clientX - 106, y: e.clientY - 40 });
      addNodeAt(kind, pos, plugin?.name);
    },
    [addNodeAt, plugins, screenToFlowPosition],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, rawState?: unknown) => {
      const state = rawState as
        | { toNode?: { id: string } | null; fromNode?: { id: string } | null; isValid?: boolean | null }
        | undefined;
      if (state && state.toNode && state.fromNode && state.isValid === false) {
        const reason =
          validateConnection(useApp.getState, { source: state.fromNode.id, target: state.toNode.id } as Connection) ??
          "That connection is not allowed.";
        pushToast("error", "Connection rejected", reason);
      }
    },
    [pushToast],
  );

  const running = engine.status === "running";

  return (
    <div className="flex h-full min-h-0">
      <Palette />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-panel/40 px-4">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-[13px] font-bold text-ink">orders_analytics</span>
            <Pill tone="dim">v14</Pill>
            <Pill tone={engineTone(engine.status)} pulse={running}>
              {engine.status === "idle" ? "standby" : engine.status}
            </Pill>
            {engine.runId && <span className="hidden font-mono text-[10.5px] text-dim lg:inline">{engine.runId}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fitView({ padding: 0.18, duration: 400 })}
              className="flex items-center gap-1.5 rounded-lg border border-line2 bg-panel2 px-2.5 py-1.5 text-[11.5px] font-semibold text-mute transition-colors hover:border-cy/40 hover:text-cy"
            >
              <Frame size={13} /> Fit
            </button>
            {running ? (
              <button
                onClick={stopRun}
                className="flex items-center gap-2 rounded-lg border border-errx/50 bg-errx/15 px-3.5 py-1.5 text-[12px] font-bold text-errx transition-colors hover:bg-errx/25"
              >
                <Square size={12} fill="currentColor" /> Abort run
              </button>
            ) : (
              <button
                onClick={startRun}
                className="flex items-center gap-2 rounded-lg bg-ember px-4 py-1.5 text-[12px] font-bold text-deep transition-all hover:bg-ember2 hover:shadow-[0_0_20px_rgba(255,120,73,0.4)]"
              >
                <Play size={13} fill="currentColor" /> Run pipeline
              </button>
            )}
          </div>
        </div>

        {/* canvas */}
        <div ref={flowRef} className="relative min-h-0 flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValid}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.35}
            maxZoom={1.75}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="#22314e" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              maskColor="rgba(8,12,20,0.75)"
              nodeColor={(n) => STATUS_COLOR[(n as unknown as { data: { status: keyof typeof STATUS_COLOR } }).data.status] ?? "#5b6b85"}
              nodeStrokeColor="#2c3d5c"
            />
          </ReactFlow>

          {/* zoom cluster */}
          <div className="absolute bottom-4 left-4 z-10 flex overflow-hidden rounded-lg border border-line2 bg-panel/90 shadow-lg backdrop-blur">
            <button onClick={() => zoomIn({ duration: 200 })} className="p-2 text-mute transition-colors hover:bg-panel2 hover:text-ink" aria-label="Zoom in"><ZoomIn size={14} /></button>
            <button onClick={() => zoomOut({ duration: 200 })} className="border-x border-line p-2 text-mute transition-colors hover:bg-panel2 hover:text-ink" aria-label="Zoom out"><ZoomOut size={14} /></button>
            <button onClick={() => fitView({ padding: 0.18, duration: 400 })} className="p-2 text-mute transition-colors hover:bg-panel2 hover:text-ink" aria-label="Fit view"><Maximize2 size={14} /></button>
          </div>

          {running && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-cy/40 bg-deep/85 px-3.5 py-1.5 font-mono text-[10.5px] font-semibold text-cy shadow-glow-cy backdrop-blur">
                <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-cy" />
                EXECUTING · {Math.min(3, nodes.filter((n) => n.data.status === "running").length)} stages active · telemetry streaming
              </div>
            </div>
          )}

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Minimize2 size={28} className="mx-auto text-dim" />
                <p className="mt-2 font-display text-sm font-semibold text-mute">Canvas is empty</p>
                <p className="text-[11.5px] text-dim">Drag a node from the palette to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Inspector />
    </div>
  );
}

export default function CanvasView() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
