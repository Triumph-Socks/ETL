import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useApp } from "../lib/store";

/* ---------- status / severity pills ---------- */

const TONES: Record<string, string> = {
  mint: "text-mint bg-mint/10 border-mint/30",
  cy: "text-cy bg-cy/10 border-cy/30",
  ember: "text-ember bg-ember/10 border-ember/30",
  amber: "text-amberx bg-amberx/10 border-amberx/30",
  err: "text-errx bg-errx/10 border-errx/30",
  dim: "text-mute bg-panel2 border-line",
  peri: "text-peri bg-peri/10 border-peri/30",
};

export function Pill({ tone, children, pulse }: { tone: keyof typeof TONES & string; children: ReactNode; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${TONES[tone] ?? TONES.dim}`}
    >
      {pulse && <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function engineTone(status: string): keyof typeof TONES & string {
  if (status === "running") return "cy";
  if (status === "succeeded") return "mint";
  if (status === "failed") return "err";
  return "dim";
}

/* ---------- toggle switch ---------- */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ?? "toggle"}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ${
        on ? "border-mint/50 bg-mint/25" : "border-line2 bg-panel2"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-200 ${
          on ? "left-[18px] bg-mint" : "left-0.5 bg-dim"
        }`}
      />
    </button>
  );
}

/* ---------- modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-deep/70 p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="max-h-[86vh] w-full overflow-y-auto rounded-xl border border-line2 bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            style={{ maxWidth: width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel/95 px-5 py-3.5 backdrop-blur">
              <h3 className="font-display text-sm font-semibold tracking-wide text-ink">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-md border border-transparent p-1 text-mute transition-colors hover:border-line2 hover:text-ink"
                aria-label="Close dialog"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- form field chrome ---------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-mute">{label}</span>
        {hint && <span className="font-mono text-[10px] text-dim">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line2 bg-panel2 px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-dim focus:border-cy/60 focus:bg-panel3";

/* ---------- code block ---------- */

export function CodeBlock({ code, height }: { code: string; height?: number }) {
  return (
    <div
      className="overflow-auto rounded-lg border border-line bg-deep"
      style={height ? { maxHeight: height } : undefined}
    >
      <pre className="df-code min-w-max px-4 py-3.5">{highlight(code)}</pre>
    </div>
  );
}

function highlight(code: string): ReactNode {
  return code.split("\n").map((line, i) => (
    <div key={i} className="flex">
      <span className="w-8 shrink-0 select-none pr-3 text-right text-[#3a4a66]">{i + 1}</span>
      <span className="whitespace-pre">{tokenize(line)}</span>
    </div>
  ));
}

function tokenize(line: string): ReactNode {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) return <span className="tk-c">{line}</span>;
  const parts: ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")|(\/\/.*$)|\b(model|enum|generator|datasource|provider|export|import|default|from|const|async|await|return|extends|new|type|interface)\b|\b(String|Int|Float|Boolean|BigInt|DateTime|Json|true|false|null)\b|(@[a-zA-Z]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1]) parts.push(<span key={k++} className="tk-s">{m[1]}</span>);
    else if (m[2]) parts.push(<span key={k++} className="tk-c">{m[2]}</span>);
    else if (m[3]) parts.push(<span key={k++} className="tk-k">{m[3]}</span>);
    else if (m[4]) parts.push(<span key={k++} className="tk-t">{m[4]}</span>);
    else if (m[5]) parts.push(<span key={k++} className="tk-a">{m[5]}</span>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

/* ---------- toast host ---------- */

const TOAST_ICON = {
  success: <CheckCircle2 size={16} className="text-mint" />,
  warn: <AlertTriangle size={16} className="text-amberx" />,
  error: <XCircle size={16} className="text-errx" />,
  info: <Info size={16} className="text-cy" />,
};

const TOAST_BAR = {
  success: "bg-mint",
  warn: "bg-amberx",
  error: "bg-errx",
  info: "bg-cy",
};

export function ToastHost() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[340px] flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-lg border border-line2 bg-panel/95 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur"
          >
            <span className={`absolute inset-y-0 left-0 w-[3px] ${TOAST_BAR[t.kind]}`} />
            <span className="mt-0.5 shrink-0">{TOAST_ICON[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] font-semibold leading-tight text-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{t.message}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-dim transition-colors hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- section header ---------- */

export function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-mute">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
