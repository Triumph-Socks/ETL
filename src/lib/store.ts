import { create } from "zustand";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { Connection, EdgeChange, MarkerType, NodeChange } from "@xyflow/react";
import type {
  AlertEvent,
  AlertPolicy,
  Connection as VaultConnection,
  EngineStatus,
  FlowEdge,
  FlowNode,
  LogLevel,
  LogEntry,
  NodeKind,
  PluginDef,
  RunRecord,
  SeriesKey,
  StepStat,
  Toast,
  ViewId,
} from "./types";
import {
  NODE_META,
  sampleEdges,
  sampleNodes,
  seedAlertEvents,
  seedConnections,
  seedPlugins,
  seedPolicies,
  seedRuns,
} from "./catalog";
import { clamp, fmtMs, fmtRows, jitter, uid } from "./util";

const SERIES_CAP = 90;
const LOG_CAP = 420;
const MAX_ACTIVE = 3;
const TICK_MS = 400;

const KIND_DURATION: Record<NodeKind, number> = {
  source: 2600,
  transform: 2100,
  join: 2900,
  quality: 1500,
  aggregate: 1900,
  destination: 2400,
};
const KIND_RATE: Record<NodeKind, number> = {
  source: 18000,
  transform: 22500,
  join: 16600,
  quality: 33000,
  aggregate: 760,
  destination: 620,
};
const KIND_HEAP: Record<NodeKind, number> = {
  source: 130,
  transform: 190,
  join: 430,
  quality: 64,
  aggregate: 150,
  destination: 96,
};

interface ActiveStep {
  startedAt: number;
  duration: number;
  rate: number;
  milestone: boolean;
}

interface SimState {
  indeg: Map<string, number>;
  ready: string[];
  active: Map<string, ActiveStep>;
  failed: boolean;
  gateBreached: boolean;
  skipped: Set<string>;
  cpu: number;
  ram: number;
  peakCpu: number;
  peakRam: number;
  runStart: number;
}

interface AppState {
  view: ViewId;
  setView: (v: ViewId) => void;

  toasts: Toast[];
  pushToast: (kind: Toast["kind"], title: string, message?: string) => void;
  dismissToast: (id: number) => void;

  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (conn: Connection) => void;
  addNodeAt: (kind: NodeKind, position: { x: number; y: number }, label?: string) => void;
  updateNodeConfig: (id: string, patch: Record<string, string | number>) => void;
  deleteNode: (id: string) => void;
  resetSample: () => void;

  engine: {
    status: EngineStatus;
    runId: string | null;
    startedAt: number | null;
    rowsProcessed: number;
    backpressure: boolean;
  };
  series: Record<SeriesKey, number[]>;
  nodeStats: Record<string, StepStat>;
  logs: LogEntry[];
  logPaused: boolean;
  logFilter: "ALL" | LogLevel;
  setLogFilter: (f: "ALL" | LogLevel) => void;
  toggleLogPaused: () => void;
  clearLogs: () => void;

  startRun: () => void;
  stopRun: () => void;
  startAmbient: () => void;

  runs: RunRecord[];

  connections: VaultConnection[];
  testingIds: string[];
  addConnection: (c: VaultConnection) => void;
  testConnection: (id: string) => void;

  policies: AlertPolicy[];
  alertEvents: AlertEvent[];
  togglePolicy: (id: string) => void;
  addPolicy: (p: AlertPolicy) => void;
  deletePolicy: (id: string) => void;
  sendTestAlert: (id: string) => void;

  plugins: PluginDef[];
  pluginConfigs: Record<string, Record<string, unknown>>;
  togglePlugin: (id: string) => void;
  savePluginConfig: (id: string, cfg: Record<string, unknown>) => void;
}

/* ---------------- module-level engine state ---------------- */

let sim: SimState | null = null;
let simTimer: ReturnType<typeof setInterval> | null = null;
let ambientTimer: ReturnType<typeof setInterval> | null = null;
let logSeq = 100;
let toastSeq = 1;

function stamp(level: LogLevel, source: string, message: string): LogEntry {
  return { id: ++logSeq, ts: Date.now(), level, source, message };
}

function startLogs(): LogEntry[] {
  const t = Date.now();
  return [
    { id: 1, ts: t - 42_000, level: "INFO", source: "scheduler", message: "Orchestrator attached · cluster prod-eu-1 · 3 workers warm" },
    { id: 2, ts: t - 41_000, level: "INFO", source: "kafka", message: "Transit topic df.transit.orders · 12 partitions · ISR 12/12" },
    { id: 3, ts: t - 39_000, level: "METRIC", source: "w-01", message: "Heap 2.1GB / 8GB · GC pause p99 3.1ms · spill disk 4%" },
    { id: 4, ts: t - 21_000, level: "INFO", source: "vault", message: "8 connections re-validated · credential rotation OK (AES-256-GCM)" },
    { id: 5, ts: t - 8_000, level: "INFO", source: "plugin-host", message: "Wasm runtime ready · 2 plugins loaded · sandbox heap cap 256MB" },
  ];
}

function pushSeries(series: Record<SeriesKey, number[]>, key: SeriesKey, v: number) {
  const next = [...series[key], v];
  if (next.length > SERIES_CAP) next.splice(0, next.length - SERIES_CAP);
  series[key] = next;
}

function edgeTargets(edges: FlowEdge[], from: string): string[] {
  return edges.filter((e) => e.source === from).map((e) => e.target);
}

export const useApp = create<AppState>()((set, get) => {
  /* ---------- internal helpers ---------- */

  const appendLogs = (entries: LogEntry[]) => {
    if (entries.length === 0) return;
    set((s) => {
      if (s.logPaused) return {};
      const merged = [...s.logs, ...entries];
      return { logs: merged.length > LOG_CAP ? merged.slice(merged.length - LOG_CAP) : merged };
    });
  };

  const fireAlert = (ev: Omit<AlertEvent, "id" | "ts" | "status">) => {
    set((s) => ({
      alertEvents: [
        { ...ev, id: uid("ae"), ts: Date.now(), status: "firing" as const },
        ...s.alertEvents,
      ].slice(0, 30),
    }));
  };

  const setNodeData = (id: string, patch: Partial<FlowNode["data"]>) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }));
  };

  const markSkipped = (fromId: string, edges: FlowEdge[]) => {
    const queue = [...edgeTargets(edges, fromId)];
    const seen = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = get().nodes.find((n) => n.id === id);
      if (!node || node.data.status === "failed") continue;
      setNodeData(id, { status: "skipped", progress: 0 });
      sim?.skipped.add(id);
      appendLogs([stamp("WARN", "scheduler", `Skipping ${node.data.label} — upstream failed`)]);
      queue.push(...edgeTargets(edges, id));
    }
    if (sim) {
      sim.ready = sim.ready.filter((r) => !sim!.skipped.has(r));
    }
  };

  const startNode = (node: FlowNode) => {
    const d = node.data;
    const cfg = d.config;
    sim!.active.set(node.id, {
      startedAt: Date.now(),
      duration: jitter(KIND_DURATION[d.kind]),
      rate: jitter(KIND_RATE[d.kind]),
      milestone: false,
    });
    setNodeData(node.id, { status: "running", progress: 0, rows: 0, durationMs: null });

    const msg: Record<NodeKind, string> = {
      source: `Opening snapshot cursor on ${cfg.table} · batch ${cfg.batch_size} · mode ${cfg.incremental}`,
      transform: `Compiling ${cfg.language} plan · ${cfg.parallelism} vectorized lanes`,
      join: `Building ${cfg.strategy} table on ${cfg.left_key} ⋈ ${cfg.right_key} · spill budget ${cfg.spill_mb}MB`,
      quality: `Sampling ${cfg.sample_size} rows · contract: ${cfg.metric} < ${cfg.threshold}%`,
      aggregate: `Tumbling window ${cfg.window} · ${cfg.fn}(${cfg.group_by})`,
      destination: `Staging ${cfg.table} · write mode ${cfg.mode} · commit every ${cfg.commit_batch}`,
    };
    appendLogs([stamp("INFO", d.label, msg[d.kind])]);
  };

  const completeNode = (node: FlowNode, step: ActiveStep) => {
    const s = get();
    const d = node.data;
    const durationMs = Date.now() - step.startedAt;
    sim!.active.delete(node.id);

    if (d.kind === "quality") {
      const sample = 0.2 + Math.random() * 2.6;
      const threshold = Number(d.config.threshold) || 2;
      const ok = sample <= threshold;
      const action = String(d.config.action ?? "fail_fast");
      if (!ok && action === "fail_fast") {
        sim!.failed = true;
        sim!.gateBreached = true;
        setNodeData(node.id, { status: "failed", progress: 100, durationMs });
        appendLogs([
          stamp("ERROR", d.label, `${d.config.metric} ${sample.toFixed(2)}% exceeds threshold ${threshold.toFixed(2)}% (n=${d.config.sample_size})`),
          stamp("ERROR", "engine", `Circuit opened — halting downstream stages`),
        ]);
        const pol = s.policies.find((p) => p.trigger === "quality.breach" && p.enabled);
        fireAlert({
          severity: "critical",
          policy: pol?.name ?? "DQ contract breach",
          message: `${d.label}: ${d.config.metric} ${sample.toFixed(2)}% > ${threshold.toFixed(2)}% on ${s.engine.runId}`,
          channels: pol?.channels ?? ["slack"],
        });
        markSkipped(node.id, s.edges);
        return;
      }
      if (!ok) {
        appendLogs([
          stamp("WARN", d.label, `${d.config.metric} ${sample.toFixed(2)}% > ${threshold.toFixed(2)}% — ${action === "quarantine" ? "rows routed to dq_quarantine" : "warn_only, passing through"}`),
        ]);
      } else {
        appendLogs([stamp("INFO", d.label, `Contract passed · ${d.config.metric} ${sample.toFixed(2)}% ≤ ${threshold.toFixed(2)}%`)]);
      }
    }

    const peakMB = get().nodeStats[node.id]?.peakMB ?? Math.round(KIND_HEAP[d.kind]);
    const rows = Math.round(node.data.rows);
    setNodeData(node.id, { status: "succeeded", progress: 100, durationMs });
    set((st) => ({
      nodeStats: { ...st.nodeStats, [node.id]: { rows, durationMs, peakMB } },
      engine: { ...st.engine, rowsProcessed: st.engine.rowsProcessed + rows },
    }));
    appendLogs([
      stamp("INFO", d.label, `Finished · ${fmtRows(rows)} rows in ${fmtMs(durationMs)} · peak heap ${peakMB}MB`),
    ]);

    for (const target of edgeTargets(get().edges, node.id)) {
      const deg = (sim!.indeg.get(target) ?? 1) - 1;
      sim!.indeg.set(target, deg);
      if (deg === 0 && !sim!.skipped.has(target)) sim!.ready.push(target);
    }
  };

  const finishRun = () => {
    const s = get();
    if (!sim) return;
    const failed = sim.failed;
    const durationMs = Date.now() - sim.runStart;
    const record: RunRecord = {
      id: s.engine.runId ?? uid("run"),
      pipeline: "orders_analytics",
      startedAt: sim.runStart,
      durationMs,
      rows: s.engine.rowsProcessed,
      peakCpu: Math.round(sim.peakCpu),
      peakRam: Math.round(sim.peakRam),
      status: failed ? "failed" : "succeeded",
    };
    appendLogs([
      failed
        ? stamp("ERROR", "engine", `Run ${record.id} FAILED · ${fmtRows(s.engine.rowsProcessed)} rows processed · ${fmtMs(durationMs)} · peak RAM ${record.peakRam}%`)
        : stamp("INFO", "engine", `Run ${record.id} succeeded · ${fmtRows(s.engine.rowsProcessed)} rows · ${fmtMs(durationMs)} · peak RAM ${record.peakRam}% / CPU ${record.peakCpu}%`),
    ]);
    if (failed) {
      const pol = s.policies.find((p) => p.trigger === "pipeline.failed" && p.enabled);
      fireAlert({
        severity: "critical",
        policy: pol?.name ?? "Prod pipeline failure",
        message: `${record.id} failed at quality gate — downstream stages skipped`,
        channels: pol?.channels ?? ["slack", "pagerduty"],
      });
    }
    if (simTimer) clearInterval(simTimer);
    simTimer = null;
    sim = null;
    set((st) => ({
      runs: [record, ...st.runs].slice(0, 24),
      engine: { ...st.engine, status: failed ? "failed" : "succeeded" },
    }));
  };

  const tick = () => {
    const s = get();
    if (!sim) return;
    const throttle = s.engine.backpressure ? 0.45 : 1;

    /* advance active steps */
    const completed: string[] = [];
    const activeEntries = [...sim.active.entries()];
    for (const [id, step] of activeEntries) {
      const node = s.nodes.find((n) => n.id === id);
      if (!node) continue;
      const inc = (TICK_MS / step.duration) * 100 * throttle * jitter(1, 0.5);
      const progress = Math.min(100, node.data.progress + inc);
      const rows = node.data.rows + step.rate * (TICK_MS / 1000) * throttle * jitter(1, 0.4);
      const heapBase = KIND_HEAP[node.data.kind];
      const prevPeak = s.nodeStats[id]?.peakMB ?? 0;
      const peakMB = Math.max(prevPeak, Math.round(heapBase * jitter(1, 0.5) * (0.7 + progress / 250)));
      set((st) => ({
        nodes: st.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, progress, rows } } : n)),
        nodeStats: { ...st.nodeStats, [id]: { rows: Math.round(rows), durationMs: null, peakMB } },
      }));
      if (!step.milestone && progress >= 50) {
        step.milestone = true;
        appendLogs([stamp("METRIC", node.data.label, `52% · ${fmtRows(rows)} rows @ ${fmtRows(step.rate * throttle)}/s · heap ${peakMB}MB`)]);
      }
      if (progress >= 100) completed.push(id);
    }
    for (const id of completed) {
      const node = get().nodes.find((n) => n.id === id);
      const step = sim?.active.get(id);
      if (node && step) completeNode(node, step);
      if (get().engine.status !== "running") return;
    }

    /* promote ready nodes */
    while (sim && sim.ready.length > 0 && sim.active.size < MAX_ACTIVE) {
      const nextId = sim.ready.shift()!;
      if (sim.skipped.has(nextId)) continue;
      const node = get().nodes.find((n) => n.id === nextId);
      if (node) startNode(node);
    }

    /* resource walk */
    const activeCount = sim ? sim.active.size : 0;
    let rps = 0;
    if (sim) for (const [, step] of sim.active) rps += step.rate * throttle;
    const cpuTarget = 9 + activeCount * 17 + (s.engine.backpressure ? 14 : 0);
    const ramTarget = s.engine.backpressure ? 76 : 31 + activeCount * 12 + Math.min(14, s.engine.rowsProcessed / 9000);
    const cpu = clamp(sim.cpu + (cpuTarget - sim.cpu) * 0.35 + (Math.random() * 6 - 3), 4, 97);
    const ram = clamp(sim.ram + (ramTarget - sim.ram) * 0.3 + (Math.random() * 4 - 2), 18, 94);
    sim.cpu = cpu;
    sim.ram = ram;
    sim.peakCpu = Math.max(sim.peakCpu, cpu);
    sim.peakRam = Math.max(sim.peakRam, ram);

    let backpressure = s.engine.backpressure;
    const bpLogs: LogEntry[] = [];
    if (!backpressure && ram > 84) {
      backpressure = true;
      bpLogs.push(stamp("WARN", "engine", `Heap pressure ${ram.toFixed(0)}% — engaging backpressure, throttling intake 55%`));
      const pol = s.policies.find((p) => p.trigger === "memory.spike" && p.enabled);
      fireAlert({
        severity: "warning",
        policy: pol?.name ?? "Heap pressure",
        message: `Worker heap ${ram.toFixed(0)}% during ${s.engine.runId} — backpressure engaged`,
        channels: pol?.channels ?? ["slack"],
      });
    } else if (backpressure && ram < 72) {
      backpressure = false;
      bpLogs.push(stamp("INFO", "engine", `Heap recovered to ${ram.toFixed(0)}% — backpressure released, full throughput resumed`));
    }

    set((st) => {
      const series = { cpu: [...st.series.cpu], ram: [...st.series.ram], rps: [...st.series.rps] };
      pushSeries(series, "cpu", cpu);
      pushSeries(series, "ram", ram);
      pushSeries(series, "rps", Math.round(rps));
      return { series, engine: { ...st.engine, backpressure } };
    });
    appendLogs(bpLogs);

    /* terminate when drained */
    if (sim && sim.active.size === 0 && sim.ready.length === 0) {
      finishRun();
    }
  };

  /* ---------------- store ---------------- */

  return {
    view: "canvas",
    setView: (v) => set({ view: v }),

    toasts: [],
    pushToast: (kind, title, message) => {
      const id = ++toastSeq;
      set((s) => ({ toasts: [...s.toasts, { id, kind, title, message }].slice(-4) }));
      setTimeout(() => get().dismissToast(id), 4200);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    nodes: sampleNodes(),
    edges: sampleEdges(),
    onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
    onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
    onConnect: (conn) =>
      set((s) => ({
        edges: addEdge(
          {
            ...conn,
            sourceHandle: conn.sourceHandle ?? "out",
            targetHandle: conn.targetHandle ?? "in",
          },
          s.edges,
        ),
      })),

    addNodeAt: (kind, position, label) => {
      const meta = NODE_META[kind];
      const count = get().nodes.filter((n) => n.data.kind === kind).length + 1;
      const node: FlowNode = {
        id: uid(kind.slice(0, 2)),
        type: "pipeline",
        position,
        data: {
          label: label ?? `${meta.label} ${count > 1 ? count : ""}`.trim(),
          kind,
          status: "idle",
          progress: 0,
          rows: 0,
          durationMs: null,
          config: { ...meta.defaults },
        },
      };
      set((s) => ({ nodes: [...s.nodes, node] }));
      get().pushToast("info", `${meta.label} added`, "Wire it into the graph, then configure it in the inspector.");
    },

    updateNodeConfig: (id, patch) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n,
        ),
      })),

    deleteNode: (id) => {
      const node = get().nodes.find((n) => n.id === id);
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      }));
      if (node) get().pushToast("warn", `${node.data.label} removed`, "Connected edges were detached.");
    },

    resetSample: () => {
      set({ nodes: sampleNodes(), edges: sampleEdges() });
      get().pushToast("success", "Reference pipeline restored", "orders_analytics · 7 nodes · 6 edges");
    },

    engine: { status: "idle", runId: null, startedAt: null, rowsProcessed: 0, backpressure: false },
    series: {
      cpu: Array.from({ length: 40 }, () => 8 + Math.random() * 6),
      ram: Array.from({ length: 40 }, () => 30 + Math.random() * 5),
      rps: Array.from({ length: 40 }, () => Math.random() * 400),
    },
    nodeStats: {},
    logs: startLogs(),
    logPaused: false,
    logFilter: "ALL",
    setLogFilter: (f) => set({ logFilter: f }),
    toggleLogPaused: () => set((s) => ({ logPaused: !s.logPaused })),
    clearLogs: () => set({ logs: [stamp("INFO", "terminal", "Log buffer cleared by operator")] }),

    startRun: () => {
      const s = get();
      if (s.engine.status === "running") return;
      if (s.nodes.length === 0) {
        s.pushToast("warn", "Nothing to run", "Add nodes to the canvas first.");
        return;
      }
      const indeg = new Map<string, number>();
      s.nodes.forEach((n) => indeg.set(n.id, 0));
      s.edges.forEach((e) => {
        if (indeg.has(e.target)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
      });
      const ready = s.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);

      sim = {
        indeg,
        ready,
        active: new Map(),
        failed: false,
        gateBreached: false,
        skipped: new Set(),
        cpu: 12,
        ram: 34,
        peakCpu: 12,
        peakRam: 34,
        runStart: Date.now(),
      };

      const runId = `run-${8405 + s.runs.length}`;
      set((st) => ({
        engine: { status: "running", runId, startedAt: Date.now(), rowsProcessed: 0, backpressure: false },
        nodes: st.nodes.map((n) => ({
          ...n,
          data: { ...n.data, status: "pending" as const, progress: 0, rows: 0, durationMs: null },
        })),
        nodeStats: {},
      }));
      appendLogs([
        stamp("INFO", "engine", `Run ${runId} queued · ${s.nodes.length} nodes · ${s.edges.length} edges · concurrency ${MAX_ACTIVE}`),
        stamp("INFO", "scheduler", "Topological schedule resolved · critical path 5 stages"),
      ]);
      get().pushToast("info", `Run ${runId} started`, "Streaming telemetry to the observability pane.");

      if (simTimer) clearInterval(simTimer);
      simTimer = setInterval(tick, TICK_MS);
    },

    stopRun: () => {
      const s = get();
      if (s.engine.status !== "running" || !sim) return;
      const record: RunRecord = {
        id: s.engine.runId ?? uid("run"),
        pipeline: "orders_analytics",
        startedAt: sim.runStart,
        durationMs: Date.now() - sim.runStart,
        rows: s.engine.rowsProcessed,
        peakCpu: Math.round(sim.peakCpu),
        peakRam: Math.round(sim.peakRam),
        status: "aborted",
      };
      if (simTimer) clearInterval(simTimer);
      simTimer = null;
      sim = null;
      set((st) => ({
        runs: [record, ...st.runs].slice(0, 24),
        engine: { ...st.engine, status: "idle", backpressure: false },
        nodes: st.nodes.map((n) =>
          n.data.status === "running" || n.data.status === "pending"
            ? { ...n, data: { ...n.data, status: "idle" as const, progress: 0 } }
            : n,
        ),
      }));
      appendLogs([stamp("WARN", "engine", `Run ${record.id} aborted by operator · drain completed in 120ms`)]);
      get().pushToast("warn", "Run aborted", "Workers drained and returned to the warm pool.");
    },

    startAmbient: () => {
      if (ambientTimer) return;
      ambientTimer = setInterval(() => {
        const s = get();
        if (s.engine.status === "running") return;
        const cpu = clamp(7 + Math.random() * 7, 3, 20);
        const ram = clamp(29 + Math.random() * 7, 20, 42);
        set((st) => {
          const series = { cpu: [...st.series.cpu], ram: [...st.series.ram], rps: [...st.series.rps] };
          pushSeries(series, "cpu", cpu);
          pushSeries(series, "ram", ram);
          pushSeries(series, "rps", Math.random() * 250);
          return { series };
        });
        const roll = Math.random();
        if (roll < 0.14) appendLogs([stamp("METRIC", "w-02", `Idle sweep · heap ${(2 + Math.random()).toFixed(1)}GB / 8GB · GC 1.8ms`)]);
        else if (roll < 0.22) appendLogs([stamp("INFO", "kafka", `Broker heartbeat · consumer lag ${Math.round(8 + Math.random() * 30)}ms`)]);
        else if (roll < 0.27) appendLogs([stamp("INFO", "vault", "Credential audit · 0 secrets pending rotation`".replace("`", ""))]);
      }, 4000);
    },

    runs: seedRuns,

    connections: seedConnections,
    testingIds: [],
    addConnection: (c) => {
      set((s) => ({ connections: [c, ...s.connections] }));
      get().pushToast("success", `${c.name} registered`, "Credentials sealed with AES-256-GCM and stored in the vault.");
    },
    testConnection: (id) => {
      if (get().testingIds.includes(id)) return;
      set((s) => ({ testingIds: [...s.testingIds, id] }));
      const conn = get().connections.find((c) => c.id === id);
      setTimeout(() => {
        const fail = Math.random() < 0.12;
        const latency = Math.round(fail ? 0 : 16 + Math.random() * 130);
        set((s) => ({
          testingIds: s.testingIds.filter((t) => t !== id),
          connections: s.connections.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: fail ? "error" : latency > 120 ? "degraded" : "healthy",
                  latencyMs: fail ? null : latency,
                  lastTested: Date.now(),
                }
              : c,
          ),
        }));
        if (conn) {
          get().pushToast(
            fail ? "error" : "success",
            fail ? `${conn.name} unreachable` : `${conn.name} · ${latency}ms`,
            fail ? "TCP handshake timed out after 5s — check egress rules." : "Handshake + auth + probe query all green.",
          );
        }
      }, 950);
    },

    policies: seedPolicies,
    alertEvents: seedAlertEvents,
    togglePolicy: (id) =>
      set((s) => ({ policies: s.policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)) })),
    addPolicy: (p) => {
      set((s) => ({ policies: [p, ...s.policies] }));
      get().pushToast("success", "Policy armed", `${p.name} → ${p.channels.join(", ")}`);
    },
    deletePolicy: (id) => set((s) => ({ policies: s.policies.filter((p) => p.id !== id) })),
    sendTestAlert: (id) => {
      const pol = get().policies.find((p) => p.id === id);
      if (!pol) return;
      fireAlert({
        severity: "info",
        policy: pol.name,
        message: "Synthetic test alert fired from the matrix console",
        channels: pol.channels,
      });
      get().pushToast("info", "Test alert dispatched", `Delivered via ${pol.channels.join(" + ")} in 240ms`);
    },

    plugins: seedPlugins,
    pluginConfigs: {},
    togglePlugin: (id) => {
      const pl = get().plugins.find((p) => p.id === id);
      set((s) => ({
        plugins: s.plugins.map((p) => (p.id === id ? { ...p, installed: !p.installed } : p)),
      }));
      if (pl) {
        const installing = !pl.installed;
        get().pushToast(
          installing ? "success" : "warn",
          installing ? `${pl.name} installed` : `${pl.name} disabled`,
          installing
            ? pl.runtime === "wasm"
              ? "Wasm module verified (sigstore) · sandbox armed · node registered in palette"
              : "Container image pulled · gRPC sidecar healthy · node registered"
            : "Node removed from palette · existing pipelines keep their pinned version",
        );
        appendLogs([
          stamp(
            "INFO",
            "plugin-host",
            installing ? `${pl.id}@${pl.version} registered (${pl.runtime}) · configSchema v2 accepted` : `${pl.id} unregistered from node catalog`,
          ),
        ]);
      }
    },
    savePluginConfig: (id, cfg) => {
      set((s) => ({ pluginConfigs: { ...s.pluginConfigs, [id]: cfg } }));
      get().pushToast("success", "Plugin config committed", "Schema-validated and pushed to all warm workers.");
    },
  };
});

/* helpers shared with views */
export function validateConnection(getState: () => AppState, conn: Connection): string | null {
  const { nodes, edges } = getState();
  const source = nodes.find((n) => n.id === conn.source);
  const target = nodes.find((n) => n.id === conn.target);
  if (!source || !target) return "Both endpoints must exist.";
  if (source.id === target.id) return "A node cannot feed itself.";
  if (target.data.kind === "source") return "Sources are read-only — they cannot receive input.";
  if (source.data.kind === "destination") return "Destinations are terminal — nothing flows out.";
  if (edges.some((e) => e.source === conn.source && e.target === conn.target)) return "These nodes are already wired.";
  /* cycle detection */
  const stack = [conn.target];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === conn.source) return "That link would create a cycle in the DAG.";
    if (seen.has(cur)) continue;
    seen.add(cur);
    edges.filter((e) => e.source === cur).forEach((e) => stack.push(e.target));
  }
  return null;
}
