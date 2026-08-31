import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Bell, Braces, Cpu, Database, MemoryStick, Plug, Workflow } from "lucide-react";
import { useApp } from "./lib/store";
import type { ViewId } from "./lib/types";
import CanvasView from "./views/CanvasView";
import ObservabilityView from "./views/ObservabilityView";
import ConnectionsView from "./views/ConnectionsView";
import AlertsView from "./views/AlertsView";
import PluginsView from "./views/PluginsView";
import BlueprintView from "./views/BlueprintView";
import { Pill, ToastHost, engineTone } from "./components/ui";

const NAV: { id: ViewId; label: string; icon: typeof Workflow }[] = [
  { id: "canvas", label: "Pipeline Canvas", icon: Workflow },
  { id: "observability", label: "Observability", icon: Activity },
  { id: "connections", label: "Connections", icon: Database },
  { id: "alerts", label: "Alert Matrix", icon: Bell },
  { id: "plugins", label: "Plugin Engine", icon: Plug },
  { id: "blueprint", label: "Blueprint", icon: Braces },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <svg width="30" height="30" viewBox="0 0 32 32" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="#101828" stroke="#2c3d5c" strokeWidth="1" />
        <path d="M6 10h7l5 6 5-6h3" stroke="#ff7849" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 22h7l5-6 5 6h3" stroke="#4cc9f0" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-display text-[15px] font-bold leading-none tracking-tight text-ink">
          DataFlow <span className="text-ember">OS</span>
        </p>
        <p className="mt-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.22em] text-dim">pipeline control plane</p>
      </div>
    </div>
  );
}

function Sidebar() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const alertEvents = useApp((s) => s.alertEvents);
  const connections = useApp((s) => s.connections);
  const engine = useApp((s) => s.engine);

  const firing = alertEvents.filter((e) => e.status === "firing").length;
  const badConns = connections.filter((c) => c.status === "error").length;

  return (
    <aside className="z-10 flex w-[218px] shrink-0 flex-col border-r border-line bg-panel/80 backdrop-blur">
      <Logo />
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          const badge = item.id === "alerts" ? firing : item.id === "connections" ? badConns : 0;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ${
                active ? "bg-panel2 text-ink" : "text-mute hover:bg-panel2/50 hover:text-ink"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ember transition-all duration-200 ${
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                }`}
              />
              <Icon size={15} className={active ? "text-ember" : ""} strokeWidth={2.1} />
              <span className="flex-1 text-[12.5px] font-semibold">{item.label}</span>
              {badge > 0 && (
                <span className={`rounded-full border px-1.5 py-px font-mono text-[9px] font-bold ${
                  item.id === "alerts" ? "border-errx/50 bg-errx/15 text-errx" : "border-amberx/50 bg-amberx/15 text-amberx"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* worker pool card */}
      <div className="mx-3 mb-3 rounded-xl border border-line bg-deep/60 p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-dim">Worker pool</p>
          <Pill tone={engine.status === "running" ? "cy" : "mint"} pulse={engine.status === "running"}>
            {engine.status === "running" ? "busy" : "warm"}
          </Pill>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {["w-01", "w-02", "w-03"].map((w, i) => (
            <div key={w} className="flex items-center gap-2 font-mono text-[10.5px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${engine.status === "running" ? "anim-pulse-dot" : ""}`}
                style={{ background: engine.status === "running" ? "#4cc9f0" : i === 2 ? "#ffc53d" : "#3dd68c" }}
              />
              <span className="text-mute">{w}</span>
              <span className="ml-auto text-dim">
                {engine.status === "running" ? (i === 0 ? "exec" : i === 1 ? "exec" : "spill") : i === 2 ? "gc" : "idle"}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-line px-5 py-3 font-mono text-[9px] tracking-wide text-dim">
        v2.14.0 · build 8f3ac2 · region eu-west-1
      </p>
    </aside>
  );
}

function TopBar() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const series = useApp((s) => s.series);
  const engine = useApp((s) => s.engine);
  const alertEvents = useApp((s) => s.alertEvents);

  const cpu = Math.round(series.cpu[series.cpu.length - 1] ?? 0);
  const ram = Math.round(series.ram[series.ram.length - 1] ?? 0);
  const firing = alertEvents.filter((e) => e.status === "firing").length;
  const label = NAV.find((n) => n.id === view)?.label ?? "";

  return (
    <header className="z-10 flex h-[54px] shrink-0 items-center gap-3 border-b border-line bg-panel/60 px-5 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10.5px] text-dim">dataflow-os</span>
        <span className="text-dim">/</span>
        <h1 className="font-display text-[14px] font-bold tracking-tight text-ink">{label}</h1>
      </div>
      <Pill tone={engineTone(engine.status)} pulse={engine.status === "running"}>
        {engine.status === "running" ? "run live" : engine.status === "idle" ? "cluster idle" : `last run ${engine.status}`}
      </Pill>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-3 rounded-lg border border-line bg-deep/60 px-3 py-1.5 font-mono text-[10.5px] md:flex">
          <span className="flex items-center gap-1.5 text-mute">
            <Cpu size={11} className={cpu > 85 ? "text-errx" : "text-cy"} />
            <span className={cpu > 85 ? "font-bold text-errx" : "font-bold text-ink"}>{cpu}%</span>
          </span>
          <span className="h-3 w-px bg-line2" />
          <span className="flex items-center gap-1.5 text-mute">
            <MemoryStick size={11} className={ram > 84 ? "text-errx" : "text-peri"} />
            <span className={ram > 84 ? "font-bold text-errx" : "font-bold text-ink"}>{ram}%</span>
          </span>
        </div>
        <span className="hidden rounded-lg border border-mint/30 bg-mint/5 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-mint lg:block">
          prod-eu-1
        </span>
        <button
          onClick={() => setView("alerts")}
          className="relative rounded-lg border border-line bg-panel2/70 p-2 text-mute transition-colors hover:border-line2 hover:text-ink"
          aria-label="Open alert matrix"
        >
          <Bell size={15} />
          {firing > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-errx bg-errx/90 px-1 font-mono text-[8.5px] font-bold text-deep">
              {firing}
            </span>
          )}
        </button>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ember/40 bg-ember/10 font-display text-[11px] font-bold text-ember"
          title="ada.k — platform admin"
        >
          AK
        </span>
      </div>
    </header>
  );
}

export default function App() {
  const view = useApp((s) => s.view);

  useEffect(() => {
    useApp.getState().startAmbient();
  }, []);

  return (
    <div className="relative flex h-full overflow-hidden bg-bg font-body text-ink">
      <div className="df-ambient" aria-hidden />
      <Sidebar />
      <div className="z-10 flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              {view === "canvas" && <CanvasView />}
              {view === "observability" && <ObservabilityView />}
              {view === "connections" && <ConnectionsView />}
              {view === "alerts" && <AlertsView />}
              {view === "plugins" && <PluginsView />}
              {view === "blueprint" && <BlueprintView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
