import { useState } from "react";
import { ArrowUpRight, MapPin, BriefcaseBusiness } from "lucide-react";

function getSuggestedTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function MentorCard({ mentor, onView, onRequestSession }) {
  const [expanded, setExpanded] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [agenda, setAgenda] = useState("");
  const [requesting, setRequesting] = useState(false);

  const submitRequest = async (event) => {
    event.preventDefault();
    setRequesting(true);
    try {
      const saved = await onRequestSession(mentor, {
        scheduled_at: new Date(scheduledAt).toISOString(),
        agenda,
      });
      if (saved) {
        setRequestOpen(false);
        setScheduledAt("");
        setAgenda("");
      }
    } finally {
      setRequesting(false);
    }
  };

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
      {expanded && <div className="mt-4 rounded-xl bg-white/80 p-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Mentor profile</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mentor.profile_text || "No detailed profile has been added yet."}</p></div>}
      <button onClick={() => { setExpanded((current) => !current); onView?.(); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800">{expanded ? "Hide profile" : "View full profile"} <ArrowUpRight size={16}/></button>
      {onRequestSession && !requestOpen && <button type="button" onClick={() => setRequestOpen(true)} className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">Request a session</button>}
      {onRequestSession && requestOpen && <form onSubmit={submitRequest} className="mt-4 space-y-3 rounded-xl bg-white/80 p-4">
        <h4 className="text-sm font-bold text-slate-900">Request a session with {mentor.name}</h4>
        <label className="block text-xs font-bold text-slate-600">Suggested time
          <input required type="datetime-local" min={getSuggestedTime()} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-bold text-slate-600">What would you like to discuss?
          <textarea maxLength={2000} rows={2} value={agenda} onChange={(event) => setAgenda(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm" />
        </label>
        <div className="flex gap-2">
          <button disabled={requesting} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{requesting ? "Sending…" : "Send request"}</button>
          <button type="button" onClick={() => setRequestOpen(false)} className="rounded-xl border border-blue-100 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
        </div>
      </form>}
    </article>
  );
}
