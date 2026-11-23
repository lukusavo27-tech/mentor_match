import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import api from "../services/api";

const dateTime = (value) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function SessionsPanel({ role, userId, isDemoAccount = false, mentors = [], slots = [], sessions = [], onAddAvailability, onRemoveAvailability, onBook, onStatus, canManage }) {
  const [window, setWindow] = useState({ starts_at: "", ends_at: "" });
  const [mentorId, setMentorId] = useState(mentors[0]?.id || "");
  const [mentorSlots, setMentorSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [agenda, setAgenda] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedMentor = useMemo(() => mentors.find((mentor) => mentor.id === mentorId), [mentors, mentorId]);
  useEffect(() => {
    if (!mentorId && mentors.length) refreshSlots(mentors[0].id);
  }, [mentors, mentorId]);
  const refreshSlots = async (id) => {
    setMentorId(id);
    setSelectedSlot("");
    if (!id) return setMentorSlots([]);
    setSlotLoading(true);
    try {
      const { data } = await api.get(`/users/${id}/availability`);
      setMentorSlots(data);
    } catch { setMentorSlots([]); }
    finally { setSlotLoading(false); }
  };
  const submitAvailability = async (event) => {
    event.preventDefault(); setBusy(true);
    const ok = await onAddAvailability({ starts_at: new Date(window.starts_at).toISOString(), ends_at: new Date(window.ends_at).toISOString() });
    if (ok) setWindow({ starts_at: "", ends_at: "" });
    setBusy(false);
  };
  const book = async (event) => {
    event.preventDefault(); if (!selectedSlot || !selectedMentor) return;
    setBusy(true);
    const ok = await onBook({ mentor_id: mentorId, scheduled_at: selectedSlot, agenda });
    if (ok) { setAgenda(""); setSelectedSlot(""); await refreshSlots(mentorId); }
    setBusy(false);
  };

  return <section className="space-y-5">
    {role === "Mentor" ? <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Your availability</h2>
      <p className="mt-1 text-sm text-slate-500">Add one-hour openings. Graduates can request these times, and you decide whether to accept.</p>
      {isDemoAccount && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">These are sample demo openings. Remove or adjust them to match your real schedule.</p>}
      {canManage && <form onSubmit={submitAvailability} className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-bold text-slate-600">Starts<input required type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000).toISOString().slice(0, 16)} value={window.starts_at} onChange={(e) => { const starts_at = e.target.value; const end = starts_at ? new Date(new Date(starts_at).getTime() + 3600000) : null; setWindow({ starts_at, ends_at: end ? new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "" }); }} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Ends<input required type="datetime-local" min={window.starts_at} value={window.ends_at} onChange={(e) => setWindow((current) => ({ ...current, ends_at: e.target.value }))} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm" /></label>
        <button disabled={busy} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">Add opening</button>
      </form>}
      <div className="mt-6 space-y-2">{slots.length === 0 && <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">No upcoming openings. Add a time above to let graduates request a session.</p>}{slots.map((slot) => <div key={slot.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-4 py-3"><span className="text-sm font-semibold text-slate-700">{dateTime(slot.starts_at)} – {new Date(slot.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{canManage && <button title="Remove availability" onClick={() => onRemoveAvailability(slot.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>}</div>)}</div>
    </div> : <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Request a mentoring session</h2>
      <p className="mt-1 text-sm text-slate-500">Choose an opening a mentor has shared. Your request stays pending until they respond.</p>
      <p className="mt-2 text-xs text-slate-500">Demo mentors may have sample openings; session requests are for trying the booking flow.</p>
      {mentors.length === 0 ? <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No mentor matches are available yet. Complete your profile to discover mentors.</p> : <form onSubmit={book} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Mentor<select value={mentorId} onChange={(e) => refreshSlots(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm">{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Available time<select required value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm"><option value="">{slotLoading ? "Loading times…" : mentorSlots.length ? "Choose a time" : "No openings listed"}</option>{mentorSlots.map((slot) => <option key={slot.id} value={slot.starts_at}>{dateTime(slot.starts_at)} (1 hour)</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">What would you like to discuss?<textarea maxLength={2000} rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" /></label>
        <button disabled={busy || !selectedSlot} className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Request session"}</button>
      </form>}
    </div>}

    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Your sessions</h2>
      <div className="mt-4 space-y-3">{sessions.length === 0 && <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">No sessions yet.</p>}{sessions.map((session) => {
        const isMentor = role === "Mentor";
        const canRespond = isMentor && session.status === "pending";
        const canCancel = session.status === "pending" || session.status === "accepted";
        return <article key={session.id} className="rounded-xl border border-blue-100 bg-white/75 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{isMentor ? session.mentee_name : session.mentor_name}</p><p className="mt-1 text-sm text-slate-500">{dateTime(session.scheduled_at)} · 1 hour</p>{session.agenda && <p className="mt-2 text-sm text-slate-600">{session.agenda}</p>}</div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-700">{session.status}</span></div>
          {(canRespond || canCancel) && <div className="mt-4 flex gap-2">{canRespond && <><button onClick={() => onStatus(session.id, "accepted")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Accept</button><button onClick={() => onStatus(session.id, "declined")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Decline</button></>}{canCancel && <button onClick={() => onStatus(session.id, "cancelled")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancel session</button>}</div>}
          {isMentor && session.status === "accepted" && <button onClick={() => onStatus(session.id, "completed")} className="mt-3 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">Mark completed</button>}
        </article>;
      })}</div>
    </div>
  </section>;
}
