import type { Node, Edge } from "@xyflow/react";

/* ---------------- canvas domain ---------------- */

export type NodeKind =
  | "source"
  | "transform"
  | "join"
  | "quality"
  | "aggregate"
  | "destination";

export type NodeStatus =
  | "idle"
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export interface PipelineNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  progress: number;
  rows: number;
  durationMs: number | null;
  config: Record<string, string | number>;
}

export type FlowNode = Node<PipelineNodeData, "pipeline">;
export type FlowEdge = Edge;

/* ---------------- observability ---------------- */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "METRIC";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  source: string;
  message: string;
}

export interface RunRecord {
  id: string;
  pipeline: string;
  startedAt: number;
  durationMs: number;
  rows: number;
  peakCpu: number;
  peakRam: number;
  status: "succeeded" | "failed" | "aborted";
}

export interface StepStat {
  rows: number;
  durationMs: number | null;
  peakMB: number;
}

/* ---------------- connections ---------------- */

export type ConnCategory = "rdbms" | "warehouse" | "storage" | "saas" | "file";

export interface Connection {
  id: string;
  name: string;
  category: ConnCategory;
  vendor: string;
  detail: string;
  status: "healthy" | "degraded" | "error" | "untested";
  latencyMs: number | null;
  lastTested: number | null;
  encryption: string;
}

/* ---------------- alerts ---------------- */

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertPolicy {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  channels: string[];
  severity: AlertSeverity;
  enabled: boolean;
}

export interface AlertEvent {
  id: string;
  ts: number;
  severity: AlertSeverity;
  policy: string;
  message: string;
  channels: string[];
  status: "firing" | "resolved";
}

/* ---------------- plugins ---------------- */

export interface PluginFieldSchema {
  type: "string" | "number" | "boolean" | "enum";
  title: string;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
}

export interface PluginDef {
  id: string;
  name: string;
  author: string;
  version: string;
  runtime: "wasm" | "docker" | "typescript";
  kind: NodeKind;
  description: string;
  installed: boolean;
  downloads: string;
  configSchema: { title: string; required: string[]; properties: Record<string, PluginFieldSchema> };
}

/* ---------------- misc ui ---------------- */

export type ViewId =
  | "canvas"
  | "observability"
  | "connections"
  | "alerts"
  | "plugins"
  | "blueprint";

export interface Toast {
  id: number;
  kind: "success" | "warn" | "error" | "info";
  title: string;
  message?: string;
}

export type EngineStatus = "idle" | "running" | "succeeded" | "failed";

export type SeriesKey = "cpu" | "ram" | "rps";
