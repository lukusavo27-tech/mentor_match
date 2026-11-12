import { ArrowUpRight, MapPin, BriefcaseBusiness } from "lucide-react";

export default function MentorCard({ mentor, onView }) {
  return (
    <article className="glass rounded-2xl p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 text-sm font-extrabold text-white">{mentor.initials}</div>
          <div><h3 className="font-bold text-slate-900">{mentor.name}</h3><p className="text-xs text-slate-500">{mentor.role}</p></div>
        </div>
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-center"><div className="text-lg font-black text-blue-700">{mentor.score}%</div><div className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Match</div></div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-500"><div className="flex items-center gap-2"><BriefcaseBusiness size={14}/>{mentor.company} · {mentor.experience}</div><div className="flex items-center gap-2"><MapPin size={14}/>{mentor.location}</div></div>
      <div className="mt-4 flex flex-wrap gap-2">{mentor.tags.map(tag => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-700">{tag}</span>)}</div>
      <button onClick={onView} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800">View profile <ArrowUpRight size={16}/></button>
    </article>
  );
}
