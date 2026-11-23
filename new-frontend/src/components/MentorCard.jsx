import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, MapPin } from "lucide-react";
import api from "../services/api";

const formatTime = (value) => new Date(value).toLocaleString([], {
  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
});

export default function MentorCard({ mentor, onView, onBook }) {
  const [expanded, setExpanded] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [agenda, setAgenda] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError("");
    api.get(`/users/${mentor.id}/availability`)
      .then(({ data }) => { if (!cancelled) setAvailability(data); })
      .catch(() => { if (!cancelled) setAvailabilityError("Could not load this mentor’s open times. Try again in a moment."); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [expanded, mentor.id]);

  const requestSession = async (event) => {
    event.preventDefault();
    if (!selectedTime || !onBook) return;
    setBooking(true);
    const saved = await onBook({
      mentor_id: mentor.id,
      scheduled_at: selectedTime,
      agenda
    });
    if (saved) {
      setAvailability((current) => current.filter((slot) => slot.starts_at !== selectedTime));
      setSelectedTime("");
      setAgenda("");
    }
    setBooking(false);
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
      <div className="mt-4 flex flex-wrap gap-2">{mentor.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-700">{tag}</span>)}</div>
      {expanded && <div className="mt-4 space-y-4 rounded-xl bg-white/80 p-4">
        <div><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Mentor profile</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mentor.profile_text || "No detailed profile has been added yet."}</p></div>
        <div className="border-t border-blue-100 pt-4">
          <div className="flex items-center gap-2"><CalendarClock size={16} className="text-blue-700"/><h4 className="text-sm font-bold text-slate-800">Available session times</h4></div>
          {availabilityLoading && <p className="mt-3 text-sm text-slate-500">Checking open times…</p>}
          {availabilityError && <p role="alert" className="mt-3 text-sm text-rose-700">{availabilityError}</p>}
          {!availabilityLoading && !availabilityError && availability.length === 0 && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">No open times right now. Check back later or view other mentor matches.</p>}
          {!availabilityLoading && availability.length > 0 && <form onSubmit={requestSession} className="mt-3 space-y-3">
            <label className="block text-xs font-bold text-slate-600">Choose a time<select required value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm font-medium text-slate-700"><option value="">Select an opening</option>{availability.map((slot) => <option key={slot.id} value={slot.starts_at}>{formatTime(slot.starts_at)} · 1 hour</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-600">What would you like to discuss? (optional)<textarea maxLength={2000} rows={2} value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="Share a little context for the mentor" className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm font-medium text-slate-700"/></label>
            <button disabled={booking || !selectedTime} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-100 disabled:cursor-wait disabled:opacity-60">{booking ? "Sending request…" : "Request this session"}</button>
            <p className="text-xs leading-5 text-slate-500">Your request is pending until the mentor accepts it.</p>
          </form>}
        </div>
      </div>}
      <button onClick={() => { setExpanded((current) => !current); onView?.(); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-800">{expanded ? "Hide profile and times" : "View profile and available times"} <ArrowUpRight size={16}/></button>
    </article>
  );
}
