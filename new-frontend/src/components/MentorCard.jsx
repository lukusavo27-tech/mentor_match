import { useState } from "react";
import { ArrowUpRight, MapPin, BriefcaseBusiness } from "lucide-react";

export default function MentorCard({ mentor, onView }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="glass rounded-2xl p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/80">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 text-sm font-extrabold text-white">{mentor.initials}</div>
          <div><h3 className="font-bold text-slate-900">{mentor.name}</h3><p className="text-xs text-slate-500">{mentor.role}</p></div>
        </div>
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-center"><div className="text-lg font-black text-blue-700">{mentor.score}%</div><div className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Match</div></div>
      </div>
      {(mentor.company || mentor.experience || mentor.location) && <div className="mt-4 space-y-2 text-xs text-slate-500">{(mentor.company || mentor.experience) && <div className="flex items-center gap-2"><BriefcaseBusiness size={14}/>{[mentor.company, mentor.experience].filter(Boolean).join(" · ")}</div>}{mentor.location && <div className="flex items-center gap-2"><MapPin size={14}/>{mentor.location}</div>}</div>}
      <div className="mt-4 flex flex-wrap gap-2">{mentor.tags.map(tag => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-700">{tag}</span>)}</div>
      <p className="mt-3 text-xs font-medium text-slate-500">Session booking coming soon</p>
      {expanded && <div className="mt-4 rounded-xl bg-white/80 p-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Mentor profile</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mentor.profile_text || "No detailed profile has been added yet."}</p></div>}
      <button onClick={() => { setExpanded((current) => !current); onView?.(); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800">{expanded ? "Hide profile" : "View full profile"} <ArrowUpRight size={16}/></button>
    </article>
  );
}
