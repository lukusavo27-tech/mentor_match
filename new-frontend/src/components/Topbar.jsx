export default function Topbar({ title, subtitle }) {
  return (
    <header className="mb-7">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </header>
  );
}
