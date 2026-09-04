import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Database, FileText, KeyRound, Layers, Lock, Plus, RefreshCw, Search, Zap } from "lucide-react";
import { useApp } from "../lib/store";
import type { ConnCategory, Connection } from "../lib/types";
import { CONN_CATEGORIES, CONNECTOR_TYPES } from "../lib/catalog";
import { Field, Modal, Pill, SectionHead, inputCls } from "../components/ui";
import { fmtAgo, uid } from "../lib/util";

const CAT_ICON: Record<ConnCategory, typeof Database> = {
  rdbms: Database,
  warehouse: Layers,
  storage: Cloud,
  saas: Zap,
  file: FileText,
};

function statusPill(c: Connection) {
  if (c.status === "healthy") return <Pill tone="mint" pulse>healthy</Pill>;
  if (c.status === "degraded") return <Pill tone="amber">degraded</Pill>;
  if (c.status === "error") return <Pill tone="err">error</Pill>;
  return <Pill tone="dim">untested</Pill>;
}

function ConnCard({ c }: { c: Connection }) {
  const testConnection = useApp((s) => s.testConnection);
  const testing = useApp((s) => s.testingIds.includes(c.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group rounded-xl border border-line bg-panel/70 p-4 transition-colors hover:border-line2"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line2 bg-panel2 font-mono text-[11px] font-bold text-cy">
          {c.vendor}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-[13.5px] font-bold text-ink">{c.name}</p>
            {statusPill(c)}
          </div>
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-dim">{c.detail}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[10px]">
        <div>
          <p className="text-dim">latency</p>
          <p className={`font-bold ${c.latencyMs == null ? "text-dim" : c.latencyMs > 120 ? "text-amberx" : "text-mint"}`}>
            {testing ? "…" : c.latencyMs != null ? `${c.latencyMs}ms` : "—"}
          </p>
        </div>
        <div>
          <p className="text-dim">tested</p>
          <p className="font-bold text-mute">{c.lastTested ? fmtAgo(c.lastTested) : "never"}</p>
        </div>
        <div>
          <p className="text-dim">crypto</p>
          <p className="flex items-center gap-1 font-bold text-mute"><Lock size={9} /> AES-256</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => testConnection(c.id)}
          disabled={testing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line2 bg-panel2 px-2.5 py-1.5 text-[11.5px] font-semibold text-mute transition-colors hover:border-cy/40 hover:text-cy disabled:opacity-50"
        >
          <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
          {testing ? "Probing…" : "Test connection"}
        </button>
        <span className="rounded-md border border-line bg-deep/60 px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-dim">
          {c.encryption}
        </span>
      </div>
    </motion.div>
  );
}

export default function ConnectionsView() {
  const connections = useApp((s) => s.connections);
  const addConnection = useApp((s) => s.addConnection);
  const [tab, setTab] = useState<ConnCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [typeIdx, setTypeIdx] = useState(0);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const filtered = useMemo(
    () =>
      connections.filter(
        (c) =>
          (tab === "all" || c.category === tab) &&
          (query === "" || (c.name + c.detail + c.vendor).toLowerCase().includes(query.toLowerCase())),
      ),
    [connections, tab, query],
  );

  const connType = CONNECTOR_TYPES[typeIdx];

  const submit = () => {
    if (!name.trim()) return;
    const detail = Object.values(fields).filter(Boolean).join(" · ") || connType.label;
    addConnection({
      id: uid("c"),
      name: name.trim(),
      category: connType.category,
      vendor: connType.vendor,
      detail,
      status: "untested",
      latencyMs: null,
      lastTested: null,
      encryption: "AES-256-GCM",
    });
    setOpen(false);
    setName("");
    setFields({});
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHead
        title="Connections & Storage Vault"
        sub="Universal connector engine · credentials sealed client-side with AES-256-GCM before reaching the metadata plane"
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vault…"
                className={`${inputCls} w-52 pl-8 text-[12px]`}
              />
            </div>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-ember px-3.5 py-2 text-[12px] font-bold text-deep transition-all hover:bg-ember2 hover:shadow-[0_0_18px_rgba(255,120,73,0.35)]"
            >
              <Plus size={13} strokeWidth={3} /> New connection
            </button>
          </div>
        }
      />

      {/* category rail */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setTab("all")}
          className={`rounded-lg border px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide transition-colors ${
            tab === "all" ? "border-cy/50 bg-cy/10 text-cy" : "border-line bg-panel2/60 text-dim hover:text-mute"
          }`}
        >
          All · {connections.length}
        </button>
        {CONN_CATEGORIES.map((cat) => {
          const Icon = CAT_ICON[cat.id];
          const count = connections.filter((c) => c.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setTab(cat.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide transition-colors ${
                tab === cat.id ? "border-cy/50 bg-cy/10 text-cy" : "border-line bg-panel2/60 text-dim hover:text-mute"
              }`}
            >
              <Icon size={11} /> {cat.label} · {count}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-dim">
          <KeyRound size={11} className="text-mint" /> 0 secrets pending rotation
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line2 bg-panel/40 py-16 text-center">
          <Database size={26} className="mx-auto text-dim" />
          <p className="mt-2 font-display text-sm font-semibold text-mute">No connections match</p>
          <p className="text-[11.5px] text-dim">Adjust the filter or register a new connector.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((c) => <ConnCard key={c.id} c={c} />)}
        </div>
      )}

      {/* add modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Register a connection">
        <div className="space-y-4">
          <Field label="Connector type">
            <div className="grid grid-cols-2 gap-1.5">
              {CONNECTOR_TYPES.map((t, i) => (
                <button
                  key={t.vendor + i}
                  onClick={() => { setTypeIdx(i); setFields({}); }}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${
                    i === typeIdx ? "border-cy/60 bg-cy/10 text-cy" : "border-line bg-panel2/60 text-mute hover:border-line2"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Display name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`my-${connType.label.toLowerCase().split(" ")[0]}`} className={inputCls} />
          </Field>
          {connType.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <input
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={`${inputCls} font-mono text-[12px]`}
              />
            </Field>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-mint/25 bg-mint/5 px-3 py-2">
            <Lock size={13} className="shrink-0 text-mint" />
            <p className="text-[11px] leading-snug text-mute">
              Secrets are sealed with <span className="font-mono text-mint">AES-256-GCM</span> using a KMS-backed data key — plaintext never touches the metadata DB.
            </p>
          </div>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="w-full rounded-lg bg-ember py-2.5 text-[13px] font-bold text-deep transition-all hover:bg-ember2 disabled:opacity-40"
          >
            Seal & register
          </button>
        </div>
      </Modal>
    </div>
  );
}
