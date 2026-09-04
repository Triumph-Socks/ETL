import { Database, GitFork, Lock, Radio } from "lucide-react";
import { PRISMA_SCHEMA } from "../lib/catalog";
import { CodeBlock, SectionHead } from "../components/ui";

function ArchBox({ x, y, w, h, title, sub, color }: { x: number; y: number; w: number; h: number; title: string; sub: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={`${color}0d`} stroke={`${color}55`} strokeWidth={1.2} />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fill="#e8effa" fontSize="11.5" fontWeight={700} fontFamily="Space Grotesk, sans-serif">
        {title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fill="#8ca0bf" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
        {sub}
      </text>
    </g>
  );
}

function FlowArrow({ d, color }: { d: string; color: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke={`${color}33`} strokeWidth={1.6} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} className="anim-dash" />
    </g>
  );
}

function ArchDiagram() {
  return (
    <svg viewBox="0 0 920 430" className="w-full">
      {/* layer labels */}
      <text x={14} y={22} fill="#5b6b85" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2">CLIENT</text>
      <text x={234} y={22} fill="#5b6b85" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2">CONTROL PLANE</text>
      <text x={474} y={22} fill="#5b6b85" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2">DATA PLANE</text>
      <text x={760} y={22} fill="#5b6b85" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2">SINKS</text>

      {/* client */}
      <ArchBox x={14} y={150} w={180} h={86} title="Next.js Canvas" sub="react-flow · grpc-web" color="#4cc9f0" />

      {/* control */}
      <ArchBox x={234} y={60} w={200} h={70} title="API Gateway" sub="rest · wss · authn/z" color="#9d8cff" />
      <ArchBox x={234} y={160} w={200} h={70} title="Prefect Orchestrator" sub="dag scheduler · retries" color="#ff7849" />
      <ArchBox x={234} y={260} w={200} h={70} title="Wasm Plugin Host" sub="sandbox · sigstore verify" color="#ffc53d" />

      {/* data plane */}
      <ArchBox x={474} y={105} w={210} h={80} title="Rust Workers ×3" sub="vectorized exec · 8GB heap" color="#3dd68c" />
      <ArchBox x={474} y={225} w={210} h={70} title="Kafka Transit" sub="12 partitions · ISR 12/12" color="#f778ba" />

      {/* sinks */}
      <ArchBox x={726} y={60} w={180} h={62} title="Connector Fleet" sub="pg · sf · s3 · stripe" color="#4cc9f0" />
      <ArchBox x={726} y={150} w={180} h={62} title="Warehouses" sub="snowflake · bigquery" color="#9d8cff" />
      <ArchBox x={726} y={240} w={180} h={62} title="Object Storage" sub="s3 · gcs · azure blob" color="#3dd68c" />

      {/* metadata */}
      <ArchBox x={234} y={360} w={450} h={56} title="PostgreSQL Metadata · Prisma ORM" sub="runs · metrics · vault refs (AES-256-GCM)" color="#ff8a5c" />
      <ArchBox x={726} y={360} w={180} h={56} title="Alert Fan-out" sub="slack · pagerduty · wh" color="#ff5c5c" />

      {/* flows */}
      <FlowArrow d="M194,180 C214,180 214,95 234,95" color="#4cc9f0" />
      <FlowArrow d="M194,193 L234,193" color="#4cc9f0" />
      <FlowArrow d="M194,206 C214,206 214,295 234,295" color="#4cc9f0" />
      <FlowArrow d="M334,130 C334,150 474,135 474,135" color="#ff7849" />
      <FlowArrow d="M434,195 L474,160" color="#ff7849" />
      <FlowArrow d="M434,295 C460,295 450,180 474,168" color="#ffc53d" />
      <FlowArrow d="M579,185 L579,225" color="#3dd68c" />
      <FlowArrow d="M684,140 C705,140 705,91 726,91" color="#f778ba" />
      <FlowArrow d="M684,150 C705,150 705,181 726,181" color="#f778ba" />
      <FlowArrow d="M684,260 C705,260 705,271 726,271" color="#f778ba" />
      <FlowArrow d="M579,185 C579,330 459,388 459,388" color="#ff8a5c" />
      <FlowArrow d="M684,388 L726,388" color="#ff5c5c" />
    </svg>
  );
}

export default function BlueprintView() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHead
        title="System Blueprint"
        sub="Reference architecture & metadata schema — the contracts every DataFlow OS deployment is built on"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
        <div className="rounded-xl border border-line bg-panel/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <GitFork size={14} className="text-ember" />
            <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Topology · control + data plane</h3>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[9.5px] text-dim">
              <Radio size={10} className="text-mint" /> live paths
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <ArchDiagram />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-3 font-mono text-[10px] text-dim">
            <span className="flex items-center gap-1.5"><Lock size={10} className="text-mint" /> vault refs sealed AES-256-GCM · keys in KMS</span>
            <span className="flex items-center gap-1.5"><Radio size={10} className="text-cy" /> logs + metrics stream over gRPC-Web @ 200ms flush</span>
            <span className="flex items-center gap-1.5"><Database size={10} className="text-coral" /> Kafka retains 7d replay for backfills</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-panel/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Database size={14} className="text-cy" />
            <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">schema.prisma · metadata plane</h3>
            <span className="ml-auto font-mono text-[9.5px] text-dim">9 models · 4 enums</span>
          </div>
          <div className="min-h-0 flex-1">
            <CodeBlock code={PRISMA_SCHEMA} height={560} />
          </div>
        </div>
      </div>

      {/* contract strip */}
      <div className="mt-4 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel/70 md:grid-cols-[1.25fr_1fr_1fr] md:divide-x md:divide-y-0">
        {[
          {
            k: "01 · Execution contract",
            t: "Exactly-once at the destination",
            d: "Workers checkpoint offsets to Kafka + commit watermarks per stage; destinations apply idempotent upserts keyed by run_id + batch_seq.",
            c: "#3dd68c",
          },
          {
            k: "02 · Telemetry contract",
            t: "StepMetricLog stream",
            d: "Every stage emits structured METRIC frames (rows, heap, cpu, spill) — the same stream that powers the live gauges feeds the historical rollups.",
            c: "#4cc9f0",
          },
          {
            k: "03 · Plugin contract",
            t: "plugin.json v2 + host ABI",
            d: "Manifest declares runtime, node kind and a JSON-Schema config. Host verifies sigstore signatures, then mounts the sandbox with declared permissions only.",
            c: "#ffc53d",
          },
        ].map((b) => (
          <div key={b.k} className="p-4">
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]" style={{ color: b.c }}>{b.k}</p>
            <p className="mt-1.5 font-display text-[14px] font-bold text-ink">{b.t}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-mute">{b.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
