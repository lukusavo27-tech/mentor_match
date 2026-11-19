export default function FormField({ label, id, error, hint, as = "input", className = "", ...props }) {
  const Control = as;
  return <div className={className}><label htmlFor={id} className="block text-xs font-bold text-slate-600">{label}<Control id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" {...props}/></label>{error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}{hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}
