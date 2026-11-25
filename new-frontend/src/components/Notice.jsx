import { useEffect, useState } from "react";
import { X } from "lucide-react";

const styles = {
  error: "border-rose-300 bg-rose-50 text-rose-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-blue-300 bg-blue-50 text-blue-900"
};

export default function Notice({ message, kind = "info", onDismiss, children }) {
  const [visible, setVisible] = useState(Boolean(message || children));
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (message || children) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timeout = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 180);
      return () => window.clearTimeout(timeout);
    }
  }, [message, children, visible]);

  if (!visible) return null;
  const dismiss = () => {
    setClosing(true);
    onDismiss?.();
  };

  return <div role={kind === "error" ? "alert" : "status"} className={`notice-motion mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${closing ? "notice-closing" : "notice-entering"} ${styles[kind] || styles.info}`}>
    <div>{message || children}</div>
    {onDismiss && <button type="button" onClick={dismiss} aria-label="Dismiss message" className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100">
      <X size={16}/>
    </button>}
  </div>;
}
