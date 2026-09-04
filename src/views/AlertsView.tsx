import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Plus, Send, Trash2, Webhook } from "lucide-react";
import { useApp } from "../lib/store";
import type { AlertSeverity } from "../lib/types";
import { ALERT_CHANNELS, ALERT_TRIGGERS } from "../lib/catalog";
import { Field, Modal, Pill, SectionHead, Toggle, inputCls } from "../components/ui";
import { fmtAgo } from "../lib/util";

function sevPill(s: AlertSeverity) {
  if (s === "critical") return <Pill tone="err">critical</Pill>;
  if (s === "warning") return <Pill tone="amber">warning</Pill>;
  return <Pill tone="cy">info</Pill>;
}

const CHANNEL_STYLE: Record<string, string> = {
  slack: "border-peri/40 bg-peri/10 text-peri",
  pagerduty: "border-errx/40 bg-errx/10 text-errx",
  webhook: "border-cy/40 bg-cy/10 text-cy",
  email: "border-amberx/40 bg-amberx/10 text-amberx",
};

export default function AlertsView() {
  const policies = useApp((s) => s.policies);
  const events = useApp((s) => s.alertEvents);
  const togglePolicy = useApp((s) => s.togglePolicy);
  const deletePolicy = useApp((s) => s.deletePolicy);
  const sendTestAlert = useApp((s) => s.sendTestAlert);
  const addPolicy = useApp((s) => s.addPolicy);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(ALERT_TRIGGERS[0]);
  const [condition, setCondition] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("warning");
  const [channels, setChannels] = useState<string[]>(["slack"]);

  const firing = events.filter((e) => e.status === "firing").length;

  const submit = () => {
    if (!name.trim()) return;
    addPolicy({
      id: `p_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      trigger,
      condition: condition.trim() || "always true",
      channels: channels.length ? channels : ["slack"],
      severity,
      enabled: true,
    });
    setOpen(false);
    setName("");
    setCondition("");
    setChannels(["slack"]);
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <SectionHead
        title="Notification & Alert Matrix"
        sub="Event-driven rules over pipeline failures, memory spikes, throughput drops and DQ breaches"
        right={
          <div className="flex items-center gap-2">
            <Pill tone={firing > 0 ? "err" : "mint"} pulse={firing > 0}>
              {firing > 0 ? `${firing} firing` : "all clear"}
            </Pill>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-ember px-3.5 py-2 text-[12px] font-bold text-deep transition-all hover:bg-ember2 hover:shadow-[0_0_18px_rgba(255,120,73,0.35)]"
            >
              <Plus size={13} strokeWidth={3} /> New policy
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* policy matrix */}
        <div className="overflow-hidden rounded-xl border border-line bg-panel/70">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Bell size={14} className="text-ember" />
            <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Trigger policies</h3>
            <span className="ml-auto font-mono text-[10px] text-dim">{policies.filter((p) => p.enabled).length}/{policies.length} armed</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left font-mono text-[9.5px] uppercase tracking-wider text-dim">
                  <th className="px-4 py-2 font-semibold">Policy</th>
                  <th className="px-3 py-2 font-semibold">Trigger</th>
                  <th className="px-3 py-2 font-semibold">Condition</th>
                  <th className="px-3 py-2 font-semibold">Channels</th>
                  <th className="px-3 py-2 font-semibold">Severity</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className={`border-t border-line/70 transition-colors hover:bg-panel2/40 ${p.enabled ? "" : "opacity-45"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Toggle on={p.enabled} onChange={() => togglePolicy(p.id)} label={`Toggle ${p.name}`} />
                        <span className="text-[12.5px] font-semibold text-ink">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded border border-line2 bg-deep/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cy">{p.trigger}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-mute">{p.condition}</td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        {p.channels.map((ch) => (
                          <span key={ch} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${CHANNEL_STYLE[ch] ?? CHANNEL_STYLE.webhook}`}>
                            {ch}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-3">{sevPill(p.severity)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => sendTestAlert(p.id)}
                          className="rounded-md border border-line bg-panel2/70 p-1.5 text-mute transition-colors hover:border-cy/40 hover:text-cy"
                          title="Send test alert"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          onClick={() => deletePolicy(p.id)}
                          className="rounded-md border border-line bg-panel2/70 p-1.5 text-mute transition-colors hover:border-errx/40 hover:text-errx"
                          title="Delete policy"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-line bg-deep/40 px-4 py-2.5">
            <Webhook size={12} className="text-dim" />
            <p className="font-mono text-[10px] text-dim">
              Dispatch fan-out p50 240ms · retries 3× exponential · dead-letter after 5 min
            </p>
          </div>
        </div>

        {/* live feed */}
        <div className="rounded-xl border border-line bg-panel/70">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <BellRing size={14} className="text-cy" />
            <h3 className="font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">Alert stream</h3>
            <span className="anim-pulse-dot ml-auto h-1.5 w-1.5 rounded-full bg-cy" />
          </div>
          <div className="max-h-[560px] overflow-y-auto p-3">
            {events.length === 0 && (
              <p className="py-10 text-center text-[11.5px] text-dim">No alert events — the matrix is quiet.</p>
            )}
            <div className="space-y-2.5">
              {events.map((ev) => (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-lg border p-3 ${
                    ev.severity === "critical" ? "border-errx/30 bg-errx/5" : ev.severity === "warning" ? "border-amberx/25 bg-amberx/5" : "border-line bg-panel2/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] font-bold text-ink">{ev.policy}</span>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase ${
                        ev.status === "firing" ? "anim-pulse-dot border-errx/50 bg-errx/15 text-errx" : "border-line2 bg-panel2 text-dim"
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-mute">{ev.message}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex gap-1">
                      {ev.channels.map((ch) => (
                        <span key={ch} className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase ${CHANNEL_STYLE[ch] ?? CHANNEL_STYLE.webhook}`}>
                          {ch}
                        </span>
                      ))}
                    </span>
                    <span className="font-mono text-[9.5px] text-dim">{fmtAgo(ev.ts)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* composer */}
      <Modal open={open} onClose={() => setOpen(false)} title="Arm a new alert policy">
        <div className="space-y-4">
          <Field label="Policy name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nightly SLA breach" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger event">
              <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className={inputCls}>
                {ALERT_TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)} className={inputCls}>
                <option value="critical">critical</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </Field>
          </div>
          <Field label="Condition expression" hint="CEL syntax">
            <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="ram_pct > 85 for 60s" className={`${inputCls} font-mono text-[12px]`} />
          </Field>
          <Field label="Dispatch channels">
            <div className="flex flex-wrap gap-1.5">
              {ALERT_CHANNELS.map((ch) => {
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => setChannels((p) => (on ? p.filter((c) => c !== ch) : [...p, ch]))}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase transition-colors ${
                      on ? CHANNEL_STYLE[ch] : "border-line bg-panel2/60 text-dim hover:text-mute"
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </Field>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="w-full rounded-lg bg-ember py-2.5 text-[13px] font-bold text-deep transition-all hover:bg-ember2 disabled:opacity-40"
          >
            Arm policy
          </button>
        </div>
      </Modal>
    </div>
  );
}
