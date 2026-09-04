import type {
  NodeKind,
  NodeStatus,
  FlowNode,
  FlowEdge,
  Connection,
  AlertPolicy,
  AlertEvent,
  RunRecord,
  PluginDef,
  ConnCategory,
} from "./types";

/* ================= node catalog ================= */

export interface NodeField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "range";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface NodeMeta {
  kind: NodeKind;
  label: string;
  group: string;
  color: string;
  blurb: string;
  configSummary: (c: Record<string, string | number>) => string;
  fields: NodeField[];
  defaults: Record<string, string | number>;
}

export const NODE_META: Record<NodeKind, NodeMeta> = {
  source: {
    kind: "source",
    label: "Source",
    group: "Ingest",
    color: "#4cc9f0",
    blurb: "Pulls batches from warehouses, object storage or APIs with snapshot isolation.",
    configSummary: (c) => `${c.table ?? "query"} · batch ${c.batch_size}`,
    fields: [
      { key: "table", label: "Table / Object", type: "text", hint: "e.g. public.orders" },
      { key: "batch_size", label: "Batch size", type: "number", min: 500, max: 50000, step: 500 },
      { key: "incremental", label: "Mode", type: "select", options: ["snapshot", "incremental", "cdc"] },
      { key: "watermark", label: "Watermark column", type: "text" },
    ],
    defaults: { table: "public.orders", batch_size: 8000, incremental: "cdc", watermark: "updated_at" },
  },
  transform: {
    kind: "transform",
    label: "Transformer",
    group: "Shape",
    color: "#ffc53d",
    blurb: "Vectorized SQL or Python transforms compiled per batch, zero-copy between stages.",
    configSummary: (c) => `${c.language} · ${c.parallelism}× lanes`,
    fields: [
      { key: "language", label: "Runtime", type: "select", options: ["sql", "python", "wasm"] },
      { key: "expression", label: "Expression / plan", type: "text", hint: "SELECT … or fn ref" },
      { key: "parallelism", label: "Parallelism", type: "range", min: 1, max: 16, step: 1 },
    ],
    defaults: { language: "sql", expression: "clean(cast(amount as decimal))", parallelism: 4 },
  },
  join: {
    kind: "join",
    label: "Joiner",
    group: "Shape",
    color: "#9d8cff",
    blurb: "Hash, merge or broadcast joins with spill-to-disk when the build side exceeds heap.",
    configSummary: (c) => `${c.strategy} · ${c.left_key} = ${c.right_key}`,
    fields: [
      { key: "strategy", label: "Strategy", type: "select", options: ["hash", "merge", "broadcast"] },
      { key: "left_key", label: "Left key", type: "text" },
      { key: "right_key", label: "Right key", type: "text" },
      { key: "spill_mb", label: "Spill budget (MB)", type: "number", min: 64, max: 4096, step: 64 },
    ],
    defaults: { strategy: "hash", left_key: "order_id", right_key: "order_id", spill_mb: 512 },
  },
  quality: {
    kind: "quality",
    label: "Quality Gate",
    group: "Govern",
    color: "#3dd68c",
    blurb: "Statistical contract checks — null rate, dup rate, schema drift — with quarantine routing.",
    configSummary: (c) => `${c.metric} < ${c.threshold}%`,
    fields: [
      { key: "metric", label: "Metric", type: "select", options: ["null_rate", "dup_rate", "schema_drift", "freshness"] },
      { key: "threshold", label: "Threshold (%)", type: "range", min: 0.1, max: 10, step: 0.1 },
      { key: "action", label: "On breach", type: "select", options: ["fail_fast", "quarantine", "warn_only"] },
      { key: "sample_size", label: "Sample size", type: "number", min: 1000, max: 100000, step: 1000 },
    ],
    defaults: { metric: "null_rate", threshold: 2, action: "fail_fast", sample_size: 10000 },
  },
  aggregate: {
    kind: "aggregate",
    label: "Aggregator",
    group: "Shape",
    color: "#ff8a5c",
    blurb: "Pre-aggregation rollups with tumbling windows to shrink destination write volume.",
    configSummary: (c) => `${c.fn}(${c.group_by}) · ${c.window}`,
    fields: [
      { key: "group_by", label: "Group by", type: "text" },
      { key: "fn", label: "Function", type: "select", options: ["sum", "avg", "count", "p95", "min_max"] },
      { key: "window", label: "Window", type: "select", options: ["1m", "5m", "1h", "1d"] },
    ],
    defaults: { group_by: "day, region", fn: "sum", window: "1h" },
  },
  destination: {
    kind: "destination",
    label: "Destination",
    group: "Load",
    color: "#f778ba",
    blurb: "Transactional loads with retry, idempotent commits and automatic schema evolution.",
    configSummary: (c) => `${c.table} · ${c.mode}`,
    fields: [
      { key: "table", label: "Target table", type: "text" },
      { key: "mode", label: "Write mode", type: "select", options: ["append", "upsert", "overwrite"] },
      { key: "commit_batch", label: "Commit batch", type: "number", min: 100, max: 20000, step: 100 },
    ],
    defaults: { table: "analytics.orders_daily", mode: "upsert", commit_batch: 5000 },
  },
};

export const KIND_ORDER: NodeKind[] = ["source", "transform", "join", "quality", "aggregate", "destination"];

export const STATUS_COLOR: Record<NodeStatus, string> = {
  idle: "#5b6b85",
  pending: "#8ca0bf",
  running: "#4cc9f0",
  succeeded: "#3dd68c",
  failed: "#ff5c5c",
  skipped: "#55617a",
};

/* ================= sample pipeline ================= */

function n(
  id: string,
  kind: NodeKind,
  label: string,
  position: { x: number; y: number },
  rows: number,
  durationMs: number,
  config: Record<string, string | number>,
): FlowNode {
  return {
    id,
    type: "pipeline",
    position,
    data: { label, kind, status: "idle", progress: 0, rows, durationMs, config },
  };
}

export function sampleNodes(): FlowNode[] {
  return [
    n("src_pg", "source", "PostgreSQL · orders", { x: 30, y: 110 }, 48210, 2410, { ...NODE_META.source.defaults, table: "public.orders" }),
    n("src_s3", "source", "S3 · returns.parquet", { x: 30, y: 350 }, 12480, 1830, { ...NODE_META.source.defaults, table: "s3://lake/returns/*.parquet", incremental: "incremental", watermark: "dt" }),
    n("t_clean", "transform", "Clean & cast", { x: 300, y: 110 }, 48210, 2090, { ...NODE_META.transform.defaults }),
    n("j_merge", "join", "Join orders ⟕ returns", { x: 565, y: 225 }, 48190, 2860, { ...NODE_META.join.defaults }),
    n("q_gate", "quality", "DQ gate · null rate", { x: 830, y: 225 }, 48190, 1440, { ...NODE_META.quality.defaults, threshold: 2 }),
    n("agg_daily", "aggregate", "Daily rollup", { x: 1095, y: 110 }, 1440, 1920, { ...NODE_META.aggregate.defaults }),
    n("dst_sf", "destination", "Snowflake · marts", { x: 1360, y: 110 }, 1440, 2350, { ...NODE_META.destination.defaults }),
  ];
}

export function sampleEdges(): FlowEdge[] {
  const mk = (id: string, source: string, target: string): FlowEdge => ({
    id,
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
  });
  return [
    mk("e1", "src_pg", "t_clean"),
    mk("e2", "src_s3", "j_merge"),
    mk("e3", "t_clean", "j_merge"),
    mk("e4", "j_merge", "q_gate"),
    mk("e5", "q_gate", "agg_daily"),
    mk("e6", "agg_daily", "dst_sf"),
  ];
}

/* ================= connections ================= */

export const CONN_CATEGORIES: { id: ConnCategory; label: string }[] = [
  { id: "rdbms", label: "Databases" },
  { id: "warehouse", label: "Warehouses" },
  { id: "storage", label: "Object Storage" },
  { id: "saas", label: "SaaS APIs" },
  { id: "file", label: "Local Files" },
];

export const seedConnections: Connection[] = [
  { id: "c_pg", name: "pg-orders-primary", category: "rdbms", vendor: "PG", detail: "postgres://prod-cluster-a:5432/orders", status: "healthy", latencyMs: 24, lastTested: Date.now() - 300_000, encryption: "TLS 1.3 · AES-256" },
  { id: "c_my", name: "mysql-events", category: "rdbms", vendor: "MY", detail: "mysql://events.eu-west:3306", status: "healthy", latencyMs: 41, lastTested: Date.now() - 900_000, encryption: "TLS 1.2 · AES-256" },
  { id: "c_sf", name: "snowflake-marts", category: "warehouse", vendor: "SF", detail: "acct XY71230 · MARTS_WH / PUBLIC", status: "healthy", latencyMs: 88, lastTested: Date.now() - 120_000, encryption: "Tri-Secret Secure" },
  { id: "c_bq", name: "bigquery-finance", category: "warehouse", vendor: "BQ", detail: "project finance-dwh · dataset ledger", status: "degraded", latencyMs: 312, lastTested: Date.now() - 1_800_000, encryption: "CMEK · AES-256" },
  { id: "c_s3", name: "s3-datalake-raw", category: "storage", vendor: "S3", detail: "s3://acme-datalake/raw/", status: "healthy", latencyMs: 33, lastTested: Date.now() - 60_000, encryption: "SSE-KMS" },
  { id: "c_az", name: "azure-blob-archive", category: "storage", vendor: "AZ", detail: "acct acmearchive · container cold", status: "untested", latencyMs: null, lastTested: null, encryption: "AES-256 at rest" },
  { id: "c_stripe", name: "stripe-payments", category: "saas", vendor: "ST", detail: "REST v2024-06 · read-only scopes", status: "healthy", latencyMs: 143, lastTested: Date.now() - 240_000, encryption: "OAuth2 · TLS 1.3" },
  { id: "c_sfdc", name: "salesforce-crm", category: "saas", vendor: "SF", detail: "SOQL bulk API · objects: Opportunity", status: "error", latencyMs: null, lastTested: Date.now() - 7_200_000, encryption: "OAuth2 · field-level" },
];

export interface ConnectorType {
  vendor: string;
  category: ConnCategory;
  label: string;
  fields: { key: string; label: string; placeholder: string }[];
}

export const CONNECTOR_TYPES: ConnectorType[] = [
  { vendor: "PG", category: "rdbms", label: "PostgreSQL", fields: [{ key: "host", label: "Host", placeholder: "db.internal:5432" }, { key: "db", label: "Database", placeholder: "orders" }, { key: "user", label: "User", placeholder: "etl_reader" }] },
  { vendor: "MY", category: "rdbms", label: "MySQL", fields: [{ key: "host", label: "Host", placeholder: "mysql:3306" }, { key: "db", label: "Database", placeholder: "events" }] },
  { vendor: "OR", category: "rdbms", label: "Oracle", fields: [{ key: "host", label: "TNS / Host", placeholder: "orcl-prod:1521" }, { key: "sid", label: "SID", placeholder: "ORCL" }] },
  { vendor: "SF", category: "warehouse", label: "Snowflake", fields: [{ key: "acct", label: "Account", placeholder: "XY71230.eu-west" }, { key: "wh", label: "Warehouse", placeholder: "MARTS_WH" }] },
  { vendor: "BQ", category: "warehouse", label: "BigQuery", fields: [{ key: "project", label: "Project", placeholder: "finance-dwh" }, { key: "dataset", label: "Dataset", placeholder: "ledger" }] },
  { vendor: "DB", category: "warehouse", label: "Databricks", fields: [{ key: "host", label: "Workspace", placeholder: "adb-xxx.azuredatabricks.net" }, { key: "catalog", label: "Catalog", placeholder: "unity" }] },
  { vendor: "S3", category: "storage", label: "Amazon S3", fields: [{ key: "bucket", label: "Bucket", placeholder: "s3://acme-datalake" }, { key: "prefix", label: "Prefix", placeholder: "raw/" }] },
  { vendor: "GC", category: "storage", label: "Google Cloud Storage", fields: [{ key: "bucket", label: "Bucket", placeholder: "gs://acme-raw" }] },
  { vendor: "ST", category: "saas", label: "Stripe", fields: [{ key: "key", label: "API key", placeholder: "rk_live_••••" }] },
  { vendor: "FL", category: "file", label: "Local file (CSV · Parquet · JSON · XLSX)", fields: [{ key: "path", label: "Path / glob", placeholder: "~/uploads/*.parquet" }] },
];

/* ================= alerts ================= */

export const ALERT_TRIGGERS = [
  "pipeline.failed",
  "memory.spike",
  "throughput.drop",
  "quality.breach",
  "run.duration_exceeded",
  "connection.lost",
];

export const ALERT_CHANNELS = ["slack", "pagerduty", "webhook", "email"];

export const seedPolicies: AlertPolicy[] = [
  { id: "p1", name: "Prod pipeline failure", trigger: "pipeline.failed", condition: "status == failed", channels: ["slack", "pagerduty"], severity: "critical", enabled: true },
  { id: "p2", name: "Heap pressure", trigger: "memory.spike", condition: "ram_pct > 85 for 60s", channels: ["slack"], severity: "warning", enabled: true },
  { id: "p3", name: "Throughput collapse", trigger: "throughput.drop", condition: "rows_s < 2k for 30s", channels: ["webhook"], severity: "warning", enabled: true },
  { id: "p4", name: "DQ contract breach", trigger: "quality.breach", condition: "metric > threshold", channels: ["slack", "email"], severity: "critical", enabled: true },
  { id: "p5", name: "Slow run SLA", trigger: "run.duration_exceeded", condition: "duration > 45m", channels: ["email"], severity: "info", enabled: false },
];

export const seedAlertEvents: AlertEvent[] = [
  { id: "ae1", ts: Date.now() - 42 * 60_000, severity: "critical", policy: "DQ contract breach", message: "q_gate: dup_rate 3.4% exceeded 2.0% on run-8397 — 1,204 rows quarantined", channels: ["slack", "email"], status: "resolved" },
  { id: "ae2", ts: Date.now() - 3 * 3600_000, severity: "warning", policy: "Heap pressure", message: "Worker w-02 heap at 88% during j_merge build phase — backpressure engaged", channels: ["slack"], status: "resolved" },
  { id: "ae3", ts: Date.now() - 26 * 3600_000, severity: "critical", policy: "Prod pipeline failure", message: "run-8381 failed at dst_sf: Snowflake warehouse suspended (auto-resume 41s)", channels: ["slack", "pagerduty"], status: "resolved" },
];

/* ================= run history ================= */

export const seedRuns: RunRecord[] = [
  { id: "run-8404", pipeline: "orders_analytics", startedAt: Date.now() - 14 * 60_000, durationMs: 11_240, rows: 48_190, peakCpu: 71, peakRam: 74, status: "succeeded" },
  { id: "run-8403", pipeline: "orders_analytics", startedAt: Date.now() - 44 * 60_000, durationMs: 10_820, rows: 47_611, peakCpu: 66, peakRam: 69, status: "succeeded" },
  { id: "run-8402", pipeline: "orders_analytics", startedAt: Date.now() - 74 * 60_000, durationMs: 13_905, rows: 48_002, peakCpu: 83, peakRam: 87, status: "succeeded" },
  { id: "run-8401", pipeline: "orders_analytics", startedAt: Date.now() - 104 * 60_000, durationMs: 6_410, rows: 21_330, peakCpu: 58, peakRam: 81, status: "failed" },
  { id: "run-8400", pipeline: "orders_analytics", startedAt: Date.now() - 134 * 60_000, durationMs: 10_110, rows: 46_875, peakCpu: 62, peakRam: 66, status: "succeeded" },
  { id: "run-8399", pipeline: "orders_analytics", startedAt: Date.now() - 164 * 60_000, durationMs: 9_980, rows: 46_902, peakCpu: 60, peakRam: 64, status: "succeeded" },
  { id: "run-8398", pipeline: "orders_analytics", startedAt: Date.now() - 194 * 60_000, durationMs: 12_470, rows: 47_433, peakCpu: 77, peakRam: 79, status: "succeeded" },
  { id: "run-8397", pipeline: "orders_analytics", startedAt: Date.now() - 224 * 60_000, durationMs: 7_215, rows: 19_080, peakCpu: 55, peakRam: 62, status: "failed" },
];

/* ================= plugins ================= */

export const seedPlugins: PluginDef[] = [
  {
    id: "pl_pii", name: "PII Redactor", author: "dataflow-labs", version: "2.4.1", runtime: "wasm", kind: "transform",
    description: "Streaming PII detection & tokenization (email, PAN, IBAN) with format-preserving encryption. Runs sandboxed in Wasm — no data leaves the worker.",
    installed: true, downloads: "48.2k",
    configSchema: {
      title: "PII Redactor config", required: ["strategy"],
      properties: {
        strategy: { type: "enum", title: "Redaction strategy", enum: ["tokenize", "mask", "hash_sha256", "drop_row"], default: "tokenize", description: "What to do with detected PII values." },
        entities: { type: "string", title: "Entity types", default: "email,pan,iban,phone", description: "Comma-separated detector list." },
        sample_rate: { type: "number", title: "Audit sample rate", default: 0.02, description: "Fraction of rows written to the audit sink." },
        fail_open: { type: "boolean", title: "Fail open", default: false, description: "Pass rows through if the detector panics." },
      },
    },
  },
  {
    id: "pl_geo", name: "Geo Enricher", author: "atlas-io", version: "1.9.0", runtime: "docker", kind: "transform",
    description: "Reverse-geocode lat/lng pairs against a bundled MaxMind DB inside a gRPC sidecar container. Cached with an LRU of 250k keys.",
    installed: true, downloads: "21.7k",
    configSchema: {
      title: "Geo Enricher config", required: ["lat_field", "lng_field"],
      properties: {
        lat_field: { type: "string", title: "Latitude field", default: "lat" },
        lng_field: { type: "string", title: "Longitude field", default: "lng" },
        output: { type: "enum", title: "Output granularity", enum: ["country", "city", "postal"], default: "city" },
        cache_ttl_s: { type: "number", title: "Cache TTL (s)", default: 86400 },
      },
    },
  },
  {
    id: "pl_drift", name: "Schema Drift Sentinel", author: "dataflow-labs", version: "0.8.3", runtime: "typescript", kind: "quality",
    description: "Fingerprints column sets & type distributions per batch; raises quality.breach events on drift beyond a Jensen–Shannon threshold.",
    installed: false, downloads: "9.4k",
    configSchema: {
      title: "Drift Sentinel config", required: ["js_threshold"],
      properties: {
        js_threshold: { type: "number", title: "JS-divergence threshold", default: 0.15, description: "0 = any drift fails the gate." },
        ignore: { type: "string", title: "Ignored columns", default: "_loaded_at,_batch_id" },
      },
    },
  },
  {
    id: "pl_kafka", name: "Kafka Sink Pro", author: "streamware", version: "3.1.2", runtime: "docker", kind: "destination",
    description: "Exactly-once Kafka producer with schema-registry integration, DLQ routing and per-partition commit watermarking.",
    installed: false, downloads: "36.0k",
    configSchema: {
      title: "Kafka Sink config", required: ["topic"],
      properties: {
        topic: { type: "string", title: "Topic", default: "marts.orders" },
        key_field: { type: "string", title: "Key field", default: "order_id" },
        delivery: { type: "enum", title: "Delivery guarantee", enum: ["at_least_once", "exactly_once"], default: "exactly_once" },
      },
    },
  },
  {
    id: "pl_llm", name: "LLM Classifier", author: "cortex.dev", version: "0.4.0", runtime: "wasm", kind: "transform",
    description: "Quantized transformer inference for text classification & sentiment at the edge of your pipeline. Batched ONNX runtime, p95 < 8ms.",
    installed: false, downloads: "12.9k",
    configSchema: {
      title: "LLM Classifier config", required: ["model", "field"],
      properties: {
        model: { type: "enum", title: "Model", enum: ["sentiment-mini", "intent-8", "pii-nano"], default: "sentiment-mini" },
        field: { type: "string", title: "Input field", default: "review_text" },
        batch: { type: "number", title: "Inference batch", default: 64 },
      },
    },
  },
  {
    id: "pl_dedup", name: "Fuzzy Dedupe", author: "gridline", version: "1.2.7", runtime: "typescript", kind: "join",
    description: "Blocking + Jaro-Winkler entity resolution for CRM-style joins where keys are unreliable. Emits match-confidence scores.",
    installed: false, downloads: "7.1k",
    configSchema: {
      title: "Fuzzy Dedupe config", required: ["confidence"],
      properties: {
        confidence: { type: "number", title: "Min confidence", default: 0.87, description: "Pairs below this are rejected." },
        block_on: { type: "string", title: "Blocking key", default: "lower(last_name)" },
      },
    },
  },
];

/* ================= blueprint strings ================= */

export const PRISMA_SCHEMA = `// schema.prisma — DataFlow OS metadata plane
generator client {
  provider = "prisma-client-py"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum NodeKind      { SOURCE TRANSFORM JOIN QUALITY AGGREGATE DESTINATION CUSTOM }
enum RunStatus     { QUEUED RUNNING SUCCEEDED FAILED ABORTED }
enum LogLevel      { INFO WARN ERROR METRIC }
enum PluginRuntime { WASM DOCKER TYPESCRIPT }

model Pipeline {
  id          String      @id @default(cuid())
  name        String      @unique
  description String?
  version     Int         @default(1)
  nodes       NodeDefinition[]
  edges       EdgeConnection[]
  runs        ExecutionRun[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model NodeDefinition {
  id         String   @id @default(cuid())
  pipelineId String
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  kind       NodeKind
  label      String
  positionX  Float
  positionY  Float
  config     Json     // config rendered from plugin JSON-schema
  pluginId   String?
  plugin     PluginExtension? @relation(fields: [pluginId], references: [id])
  steps      StepMetricLog[]
  @@index([pipelineId, kind])
}

model EdgeConnection {
  id           String   @id @default(cuid())
  pipelineId   String
  sourceNodeId String
  targetNodeId String
  sourceHandle String   @default("out")
  targetHandle String   @default("in")
  @@unique([sourceNodeId, targetNodeId])
}

model DataSource {
  id             String   @id @default(cuid())
  name           String   @unique
  category       String   // rdbms | warehouse | storage | saas | file
  connector      String
  settings       Json
  credentialRef  String   // AES-256-GCM ciphertext, key in KMS
  lastTestedAt   DateTime?
  lastLatencyMs  Int?
}

model DestinationConfig {
  id           String @id @default(cuid())
  dataSourceId String @unique
  writeMode    String // append | upsert | overwrite
  commitBatch  Int    @default(5000)
}

model ExecutionRun {
  id          String    @id @default(cuid())
  pipelineId  String
  pipeline    Pipeline  @relation(fields: [pipelineId], references: [id])
  status      RunStatus @default(QUEUED)
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  rowsIn      BigInt    @default(0)
  rowsOut     BigInt    @default(0)
  peakCpuPct  Float     @default(0)
  peakRamPct  Float     @default(0)
  steps       StepMetricLog[]
  @@index([pipelineId, startedAt(sort: Desc)])
}

model StepMetricLog {
  id         String   @id @default(cuid())
  runId      String
  run        ExecutionRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  nodeId     String
  node       NodeDefinition @relation(fields: [nodeId], references: [id])
  level      LogLevel
  message    String
  rowsDelta  BigInt   @default(0)
  cpuPct     Float?
  heapMb     Float?
  loggedAt   DateTime @default(now())
  @@index([runId, loggedAt])
}

model AlertPolicy {
  id        String   @id @default(cuid())
  name      String
  trigger   String   // pipeline.failed | memory.spike | ...
  condition String
  channels  String[] // slack | pagerduty | webhook | email
  severity  String
  enabled   Boolean  @default(true)
}

model PluginExtension {
  id           String        @id @default(cuid())
  slug         String        @unique
  version      String
  runtime      PluginRuntime
  manifest     Json          // full plugin.json incl. configSchema
  nodes        NodeDefinition[]
  installedAt  DateTime      @default(now())
}`;

export const PLUGIN_MANIFEST = `{
  "$schema": "https://sdk.dataflow.dev/plugin.v2.json",
  "slug": "pii-redactor",
  "name": "PII Redactor",
  "version": "2.4.1",
  "author": "dataflow-labs",
  "runtime": "wasm",              // wasm | docker | typescript
  "entry": {
    "wasm": "dist/pii_redactor.wasm",
    "abi": "dataflow-transform@2" // host ABI contract
  },
  "node": {
    "kind": "transform",
    "label": "PII Redactor",
    "category": "Governance",
    "icon": "shield",
    "inputs": 1,
    "outputs": 1
  },
  "configSchema": {               // JSON Schema → auto-rendered form
    "type": "object",
    "required": ["strategy"],
    "properties": {
      "strategy": {
        "type": "string",
        "title": "Redaction strategy",
        "enum": ["tokenize", "mask", "hash_sha256", "drop_row"],
        "default": "tokenize"
      },
      "entities": {
        "type": "string",
        "title": "Entity types",
        "default": "email,pan,iban,phone"
      },
      "sample_rate": { "type": "number", "title": "Audit sample rate",
                       "default": 0.02, "minimum": 0, "maximum": 1 },
      "fail_open": { "type": "boolean", "title": "Fail open",
                     "default": false }
    }
  },
  "telemetry": {
    "metrics": ["rows_redacted", "detector_latency_ms"],
    "logs": true
  },
  "permissions": {
    "network": false,             // wasm sandbox is offline by default
    "fs": "scratch",
    "maxHeapMb": 256
  }
}`;

export const PLUGIN_SDK_SNIPPET = `// my-plugin/src/index.ts — register a custom transform
import { definePlugin, TransformContext } from "@dataflow/sdk";

export default definePlugin({
  slug: "geo-enricher",
  version: "1.0.0",

  // hot path — executed per micro-batch inside the worker
  async transform(batch, ctx: TransformContext) {
    const hits = await ctx.lookup("geocache", batch.col("lat"));
    return batch.withColumn("city", hits.map(h => h.city));
  },

  // emitted to the StepMetricLog stream automatically
  metrics: (ctx) => ({
    cache_hit_rate: ctx.counter("hits") / ctx.counter("total"),
  }),
});`;
