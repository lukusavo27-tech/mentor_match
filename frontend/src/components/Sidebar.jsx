import { LayoutDashboard, UserRound, Users, CalendarDays, Settings, LogOut, Sparkles } from "lucide-react";

const links = [
  [LayoutDashboard, "Overview", "overview"],
  [UserRound, "My profile", "profile"],
  [Users, "Find mentors", "mentors"],
  [CalendarDays, "Sessions", "sessions"],
  [Settings, "Settings", "settings"]
];

export default function Sidebar({ active = "overview", onNavigate, role = "Graduate" }) {
  return (
    <aside className="glass flex w-full flex-col rounded-3xl p-4 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-64">
      <div className="mb-9 flex items-center gap-3 px-2 pt-2">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-700 text-xl font-black text-white shadow-lg shadow-blue-200">M</div>
        <div><div className="text-lg font-extrabold tracking-tight text-slate-900">MentorMatch</div><div className="text-xs text-slate-500">Your career, connected</div></div>
      </div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">Workspace</div>
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {links.map(([Icon, label, id]) => (
          <button key={id} onClick={() => onNavigate(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active === id ? "bg-blue-700 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
            <Icon size={18}/>{label}
          </button>
        ))}
      </nav>
      <div className="mt-auto hidden rounded-2xl bg-blue-50 p-4 lg:block">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900"><Sparkles size={16}/> Make progress</div>
        <p className="text-xs leading-5 text-blue-800/75">Complete your profile to get more relevant mentor recommendations.</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-200"><div className="h-full w-[85%] rounded-full bg-blue-700"/></div>
        <div className="mt-1 text-right text-[10px] font-bold text-blue-700">85% complete</div>
      </div>
      <button className="mt-4 hidden items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 lg:flex"><LogOut size={18}/> Sign out</button>
      <div className="mt-4 flex items-center gap-3 border-t border-blue-100 pt-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">TO</div>
        <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">Tillen Otuoma</div><div className="text-xs text-slate-500">{role} account</div></div>
      </div>
    </aside>
  );
}
