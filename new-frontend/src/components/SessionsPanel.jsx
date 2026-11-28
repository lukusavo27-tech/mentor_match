import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import api from "../services/api";

const dateTime = (value) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function SessionsPanel({ role, userId, isDemoAccount = false, mentors = [], slots = [], sessions = [], onAddAvailability, onRemoveAvailability, onBook, onStatus, onOptOut, canManage }) {
  const [window, setWindow] = useState({ starts_at: "", ends_at: "" });
  const [mentorId, setMentorId] = useState(mentors[0]?.id || "");
  const [mentorSlots, setMentorSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [agenda, setAgenda] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [slotRevision, setSlotRevision] = useState(0);
  const [updatingSessionId, setUpdatingSessionId] = useState("");

  const selectedMentor = useMemo(() => mentors.find((mentor) => mentor.id === mentorId), [mentors, mentorId]);
  useEffect(() => {
    if (!mentorId) {
      if (mentors.length) setMentorId(mentors[0].id);
      else setMentorSlots([]);
      return undefined;
    }
    let cancelled = false;
    setSlotLoading(true);
    setSlotError("");
    api.get(`/users/${mentorId}/availability`)
      .then(({ data }) => { if (!cancelled) setMentorSlots(data); })
      .catch(() => { if (!cancelled) { setMentorSlots([]); setSlotError("Could not load this mentor’s openings. Check the connection and try again."); } })
      .finally(() => { if (!cancelled) setSlotLoading(false); });
    return () => { cancelled = true; };
  }, [mentorId, slotRevision]);
  const chooseMentor = (id) => {
    setMentorId(id);
    setSelectedSlot("");
  };
  const refreshSlots = () => setSlotRevision((revision) => revision + 1);
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
    if (ok) { setAgenda(""); setSelectedSlot(""); refreshSlots(); }
    setBusy(false);
  };
  const updateSessionStatus = async (sessionId, status) => {
    setUpdatingSessionId(sessionId);
    try {
      await onStatus(sessionId, status);
    } finally {
      setUpdatingSessionId("");
    }
  };
  const optOut = async (session) => {
    setUpdatingSessionId(session.id);
    try {
      await onOptOut(session);
    } finally {
      setUpdatingSessionId("");
    }
  };

  return <section className="space-y-5">
    {role === "Mentor" ? <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Your availability</h2>
      <p className="mt-1 text-sm text-slate-500">Add one-hour openings. Graduates can request these times, and you decide whether to accept.</p>
      {canManage && <p className="mt-2 text-xs text-slate-600">Openings cannot overlap other openings. If a time conflicts, choose another hour or remove the existing opening first.</p>}
      {isDemoAccount && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">These are sample demo openings. Remove or adjust them to match your real schedule.</p>}
      {canManage && <form onSubmit={submitAvailability} className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-bold text-slate-600">Starts<input required type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 60000).toISOString().slice(0, 16)} value={window.starts_at} onChange={(e) => { const starts_at = e.target.value; const end = starts_at ? new Date(new Date(starts_at).getTime() + 3600000) : null; setWindow({ starts_at, ends_at: end ? new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "" }); }} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Ends (one hour later)<input type="datetime-local" value={window.ends_at} readOnly aria-readonly="true" className="mt-2 w-full rounded-xl border border-blue-100 bg-slate-50 px-3 py-3 text-sm text-slate-600" /></label>
        <button disabled={busy} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">Add opening</button>
      </form>}
      <div className="mt-6 space-y-2">{slots.length === 0 && <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">No upcoming openings. Add a time above to let graduates request a session.</p>}{slots.map((slot) => <div key={slot.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-4 py-3"><span className="text-sm font-semibold text-slate-700">{dateTime(slot.starts_at)} – {new Date(slot.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{canManage && <button title="Remove availability" onClick={() => onRemoveAvailability(slot.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>}</div>)}</div>
    </div> : <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold">Request a mentoring session</h2>
      <p className="mt-1 text-sm text-slate-500">Choose an opening a mentor has shared. Your request stays pending until they respond.</p>
      <p className="mt-2 text-xs text-slate-500">Demo mentors may have sample openings; session requests are for trying the booking flow.</p>
      {slotError && <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-900"><span>{slotError} <button type="button" onClick={refreshSlots} className="font-bold underline">Retry</button></span><button type="button" onClick={() => setSlotError("")} aria-label="Dismiss message" className="shrink-0 rounded p-1 hover:bg-rose-100"><X size={16}/></button></div>}
      {mentors.length === 0 ? <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No mentor matches are available yet. Complete your profile to discover mentors.</p> : <form onSubmit={book} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Mentor<select value={mentorId} onChange={(e) => chooseMentor(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm">{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Available time<select required disabled={slotLoading || Boolean(slotError) || mentorSlots.length === 0} value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm"><option value="">{slotLoading ? "Loading times…" : mentorSlots.length ? "Choose a time" : "No openings available"}</option>{mentorSlots.map((slot) => <option key={slot.id} value={slot.starts_at}>{dateTime(slot.starts_at)} (1 hour)</option>)}</select></label>
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
        const statusLabel = session.status === "pending"
          ? isMentor ? "New request" : "Awaiting mentor response"
          : session.status === "accepted" ? "Confirmed" : session.status;
        const updating = updatingSessionId === session.id;
        return <article key={session.id} className="rounded-xl border border-blue-100 bg-white/75 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{isMentor ? session.mentee_name : session.mentor_name}</p><p className="mt-1 text-sm text-slate-500">{dateTime(session.scheduled_at)} · 1 hour</p>{session.agenda && <p className="mt-2 text-sm text-slate-600">{session.agenda}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${session.status === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700"}`}>{statusLabel}</span></div>
          {session.status === "accepted" && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">This session is confirmed. Please coordinate the meeting link or location separately; MentorMatch does not send calendar invitations.</p>}
          {session.mentor_opted_out && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{isMentor ? "You opted out of this mentee. Future requests and goal sharing are disabled." : "This mentor opted out of the mentorship. Future requests and goal sharing are disabled."}</p>}
          {["accepted", "completed"].includes(session.status) && (session.mentor_email || session.mentor_phone_number) && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-900">You can now contact {isMentor ? session.mentee_name : session.mentor_name}</p><div className="mt-2 flex flex-wrap gap-2">{(isMentor ? session.mentee_email : session.mentor_email) && <a href={`mailto:${isMentor ? session.mentee_email : session.mentor_email}`} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-blue-800">Email</a>}{(isMentor ? session.mentee_phone_number : session.mentor_phone_number) && <a target="_blank" rel="noreferrer" href={`https://wa.me/${(isMentor ? session.mentee_phone_number : session.mentor_phone_number).replace(/\D/g, "")}`} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-800">WhatsApp</a>}</div></div>}
          {(canRespond || canCancel) && <div className="mt-4 flex gap-2">{canRespond && <><button disabled={updating} onClick={() => updateSessionStatus(session.id, "accepted")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{updating ? "Saving…" : "Accept"}</button><button disabled={updating} onClick={() => updateSessionStatus(session.id, "declined")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">Decline</button></>}{canCancel && <button disabled={updating} onClick={() => updateSessionStatus(session.id, "cancelled")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">Cancel session</button>}</div>}
          {isMentor && !session.mentor_opted_out && ["accepted", "completed"].includes(session.status) && <button disabled={updating} onClick={() => optOut(session)} className="mt-3 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">{updating ? "Saving…" : "Opt out of this mentee"}</button>}
          {isMentor && session.status === "accepted" && <button disabled={updating} onClick={() => updateSessionStatus(session.id, "completed")} className="mt-3 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">{updating ? "Saving…" : "Mark completed"}</button>}
        </article>;
      })}</div>
    </div>
  </section>;
}
