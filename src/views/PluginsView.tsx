import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Box, Braces, Container, Download, FileCode2, Plug, Settings2, ShieldCheck } from "lucide-react";
import { useApp } from "../lib/store";
import type { PluginDef } from "../lib/types";
import { PLUGIN_MANIFEST, PLUGIN_SDK_SNIPPET } from "../lib/catalog";
import { CodeBlock, Pill, SectionHead } from "../components/ui";

const RUNTIME_META: Record<PluginDef["runtime"], { label: string; icon: typeof Box; cls: string }> = {
  wasm: { label: "Wasm", icon: Box, cls: "border-cy/40 bg-cy/10 text-cy" },
  docker: { label: "Docker", icon: Container, cls: "border-peri/40 bg-peri/10 text-peri" },
  typescript: { label: "TS worker", icon: FileCode2, cls: "border-amberx/40 bg-amberx/10 text-amberx" },
};

export default function PluginsView() {
  const plugins = useApp((s) => s.plugins);
  const togglePlugin = useApp((s) => s.togglePlugin);
  const configs = useApp((s) => s.pluginConfigs);
  const savePluginConfig = useApp((s) => s.savePluginConfig);

  const [selectedId, setSelectedId] = useState<string>(plugins[0]?.id ?? "");
  const [tab, setTab] = useState<"manifest" | "form" | "sdk">("form");
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const selected = useMemo(() => plugins.find((p) => p.id === selectedId) ?? plugins[0], [plugins, selectedId]);

  const formValues = useMemo(() => {
    const base: Record<string, unknown> = {};
    if (selected) {
      for (const [k, v] of Object.entries(selected.configSchema.properties)) {
        base[k] = configs[selected.id]?.[k] ?? draft[k] ?? v.default;
      }
    }
    return base;
  }, [selected, configs, draft]);

  if (!selected) return null;
  const rt = RUNTIME_META[selected.runtime];
  const RtIcon = rt.icon;

  const setVal = (k: string, v: unknown) => setDraft((p) => ({ ...p, [k]: v }));

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHead
        title="Plugin Engine & SDK"
        sub="Third-party nodes hot-registered via plugin.json manifests — Wasm sandboxes, Dockerized gRPC sidecars or native TS workers"
        right={
          <Pill tone="ember">
            <Plug size={10} /> {plugins.filter((p) => p.installed).length} active
          </Pill>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_460px]">
        {/* registry */}
        <div className="grid grid-cols-1 content-start gap-3 md:grid-cols-2">
          {plugins.map((p) => {
            const m = RUNTIME_META[p.runtime];
            const Icon = m.icon;
            const isSel = p.id === selected.id;
            return (
              <motion.button
                key={p.id}
                layout
                whileHover={{ y: -2 }}
                onClick={() => { setSelectedId(p.id); setDraft({}); setTab("form"); }}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSel ? "border-ember/50 bg-panel shadow-glow-ember" : "border-line bg-panel/70 hover:border-line2"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${m.cls}`}>
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="font-display text-[13.5px] font-bold leading-tight text-ink">{p.name}</p>
                      <p className="font-mono text-[9.5px] text-dim">{p.author} · v{p.version}</p>
                    </div>
                  </div>
                  {p.installed ? <Pill tone="mint">installed</Pill> : <Pill tone="dim">available</Pill>}
                </div>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-mute">{p.description}</p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="flex items-center gap-1 font-mono text-[10px] text-dim">
                    <Download size={10} /> {p.downloads}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); togglePlugin(p.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); togglePlugin(p.id); } }}
                    className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                      p.installed
                        ? "border-line2 bg-panel2 text-mute hover:border-errx/40 hover:text-errx"
                        : "border-mint/40 bg-mint/10 text-mint hover:bg-mint/20"
                    }`}
                  >
                    {p.installed ? "Disable" : "Install"}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* detail panel */}
        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-panel/70">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
            <RtIcon size={15} className="text-ember" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[13px] font-bold text-ink">{selected.name}</p>
              <p className="font-mono text-[9.5px] text-dim">plugin.json · schema v2 · node kind: {selected.kind}</p>
            </div>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${rt.cls}`}>{rt.label}</span>
          </div>

          <div className="flex gap-1 border-b border-line px-3 pt-2">
            {([
              { id: "form", label: "Config form", icon: <Settings2 size={11} /> },
              { id: "manifest", label: "plugin.json", icon: <Braces size={11} /> },
              { id: "sdk", label: "TS SDK", icon: <FileCode2 size={11} /> },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide transition-colors ${
                  tab === t.id ? "border-ember text-ember" : "border-transparent text-dim hover:text-mute"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "form" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-cy/25 bg-cy/5 px-3 py-2">
                  <ShieldCheck size={13} className="shrink-0 text-cy" />
                  <p className="text-[10.5px] leading-snug text-mute">
                    This form is <span className="font-semibold text-cy">auto-rendered from configSchema</span> in the manifest — no UI code shipped per plugin.
                  </p>
                </div>
                {Object.entries(selected.configSchema.properties).map(([key, field]) => {
                  const required = selected.configSchema.required.includes(key);
                  const val = formValues[key];
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-mute">
                          {field.title}
                          {required && <span className="ml-1 text-ember">*</span>}
                        </span>
                        <span className="font-mono text-[9px] text-dim">{field.type}</span>
                      </div>
                      {field.type === "enum" ? (
                        <div className="flex flex-wrap gap-1.5">
                          {field.enum?.map((o) => (
                            <button
                              key={o}
                              onClick={() => setVal(key, o)}
                              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                                val === o ? "border-ember/60 bg-ember/10 text-ember" : "border-line bg-panel2/60 text-mute hover:border-line2"
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      ) : field.type === "boolean" ? (
                        <button
                          onClick={() => setVal(key, !val)}
                          className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-[11.5px] font-semibold transition-colors ${
                            val ? "border-mint/50 bg-mint/10 text-mint" : "border-line bg-panel2/60 text-mute"
                          }`}
                        >
                          {String(val ?? field.default)}
                        </button>
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          step="any"
                          value={Number(val ?? 0)}
                          onChange={(e) => setVal(key, Number(e.target.value))}
                          className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-cy/60"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(val ?? "")}
                          onChange={(e) => setVal(key, e.target.value)}
                          className="w-full rounded-lg border border-line2 bg-panel2 px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-cy/60"
                        />
                      )}
                      {field.description && <p className="mt-1 text-[10.5px] leading-snug text-dim">{field.description}</p>}
                    </div>
                  );
                })}
                <button
                  onClick={() => savePluginConfig(selected.id, formValues)}
                  className="w-full rounded-lg bg-ember py-2.5 text-[12.5px] font-bold text-deep transition-all hover:bg-ember2 hover:shadow-[0_0_18px_rgba(255,120,73,0.35)]"
                >
                  Commit config to workers
                </button>
              </div>
            )}
            {tab === "manifest" && <CodeBlock code={PLUGIN_MANIFEST} />}
            {tab === "sdk" && (
              <div className="space-y-3">
                <CodeBlock code={PLUGIN_SDK_SNIPPET} />
                <div className="rounded-lg border border-line bg-deep/60 p-3">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-dim">Publish</p>
                  <pre className="df-code mt-1.5 whitespace-pre-wrap">{"$ dataflow plugin validate ./plugin.json\n$ dataflow plugin sign --key sigstore\n$ dataflow plugin publish --registry cloud"}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
