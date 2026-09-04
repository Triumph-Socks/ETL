import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps, NodeTypes } from "@xyflow/react";
import { Database, GitMerge, HardDrive, ShieldCheck, Sigma, SlidersHorizontal } from "lucide-react";
import type { FlowNode, NodeKind, NodeStatus } from "../lib/types";
import { NODE_META, STATUS_COLOR } from "../lib/catalog";
import { fmtMs, fmtRows } from "../lib/util";

const KIND_ICON: Record<NodeKind, typeof Database> = {
  source: Database,
  transform: SlidersHorizontal,
  join: GitMerge,
  quality: ShieldCheck,
  aggregate: Sigma,
  destination: HardDrive,
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: "ready",
  pending: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
};

function borderFor(status: NodeStatus, selected: boolean): string {
  if (selected) return "border-ember/70";
  if (status === "running") return "border-cy/60";
  if (status === "failed") return "border-errx/60";
  if (status === "succeeded") return "border-mint/35";
  if (status === "skipped") return "border-line border-dashed";
  return "border-line2";
}

function shadowFor(status: NodeStatus): string | undefined {
  if (status === "running") return "var(--shadow-glow-cy)";
  if (status === "failed") return "var(--shadow-glow-err)";
  if (status === "succeeded") return "var(--shadow-glow-mint)";
  return undefined;
}

function PipelineNodeInner({ id, data, selected }: NodeProps<FlowNode>) {
  const meta = NODE_META[data.kind];
  const Icon = KIND_ICON[data.kind];
  const st = data.status;
  const kindColor = meta.color;
  const stColor = STATUS_COLOR[st];

  return (
    <div
      className={`w-[212px] rounded-xl border bg-panel/95 backdrop-blur-sm transition-all duration-300 ${borderFor(st, !!selected)} ${
        st === "skipped" ? "opacity-50" : ""
      }`}
      style={{ boxShadow: shadowFor(st) }}
      data-node-id={id}
    >
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5">
        <span
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{ background: `${kindColor}1a`, borderColor: `${kindColor}44`, color: kindColor }}
        >
          <Icon size={14} strokeWidth={2.2} />
          {st === "running" && (
            <span
              className="anim-pulse-dot absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-panel"
              style={{ background: "#4cc9f0" }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[12.5px] font-semibold leading-tight text-ink">{data.label}</p>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-widest" style={{ color: kindColor }}>
            {meta.label}
          </p>
        </div>
      </div>

      {/* config summary */}
      <div className="mx-3 mt-2 truncate rounded-md border border-line bg-deep/60 px-2 py-1 font-mono text-[10px] text-mute">
        {meta.configSummary(data.config)}
      </div>

      {/* status footer */}
      <div className="px-3 pb-2.5 pt-2">
        {st === "running" ? (
          <>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
              <span className="text-cy">{Math.floor(data.progress)}%</span>
              <span className="text-mute">{fmtRows(data.rows)} rows</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-panel3">
              <div
                className="h-full rounded-full bg-cy"
                style={{ width: `${data.progress}%`, boxShadow: "0 0 8px #4cc9f0aa", transition: "width 300ms linear" }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide" style={{ color: stColor }}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${st === "pending" ? "anim-pulse-dot" : ""}`}
                style={{ background: stColor }}
              />
              {STATUS_LABEL[st]}
            </span>
            <span className="font-mono text-[10px] text-dim">
              {data.rows > 0
                ? `${fmtRows(data.rows)} rows${data.durationMs ? ` · ${fmtMs(data.durationMs)}` : ""}`
                : "—"}
            </span>
          </div>
        )}
      </div>

      {data.kind !== "source" && <Handle type="target" position={Position.Left} id="in" />}
      {data.kind !== "destination" && <Handle type="source" position={Position.Right} id="out" />}
    </div>
  );
}

export const PipelineNode = memo(PipelineNodeInner);

export const nodeTypes: NodeTypes = {
  pipeline: PipelineNode as unknown as NodeTypes["pipeline"],
};
