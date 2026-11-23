import { useState } from "react";

function localDateTimeMinimum() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function SessionsPanel({ sessions, loading, role, mentors, canManage, onRequest, onStatus }) {
  const [request, setRequest] = useState({ mentor_id: "", scheduled_at: "", agenda: "" });

  const submitRequest = async (event) => {
    event.preventDefault();
    const saved = await onRequest({
      ...request,
      scheduled_at: new Date(request.scheduled_at).toISOString()
    });
    if (saved) setRequest({ mentor_id: "", scheduled_at: "", agenda: "" });
  };

  return <section className="space-y-5">
    {role === "Graduate" && <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Request a session</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a mentor and suggest a time. The request stays pending until they respond.</p>
      {canManage ? <form onSubmit={submitRequest} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Mentor<select required value={request.mentor_id} onChange={(event) => setRequest({ ...request, mentor_id: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm"><option value="">Choose a mentor</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">Suggested time<input required type="datetime-local" min={localDateTimeMinimum()} value={request.scheduled_at} onChange={(event) => setRequest({ ...request, scheduled_at: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">Agenda<textarea maxLength={2000} rows={2} value={request.agenda} onChange={(event) => setRequest({ ...request, agenda: event.target.value })} placeholder="What would you like to discuss?" className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" /></label>
        <button disabled={!mentors.length} className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Send session request</button>
      </form> : <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Select your own mentee account to request a session.</p>}
    </div>}

    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold text-slate-900">{role === "Mentor" ? "Session requests" : "Your sessions"}</h2>
      {loading && <p className="mt-4 text-sm text-slate-500">Loading sessions…</p>}
      {!loading && sessions.length === 0 && <p className="mt-4 text-sm text-slate-500">No sessions yet.</p>}
      <div className="mt-4 space-y-3">{sessions.map((session) => <article key={session.id} className="rounded-2xl border border-blue-100 bg-white/75 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{role === "Mentor" ? session.mentee_name : session.mentor_name}</h3><p className="mt-1 text-sm text-slate-500">{new Date(session.scheduled_at).toLocaleString()}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold capitalize text-blue-700">{session.status}</span></div>
        {session.agenda && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{session.agenda}</p>}
        {canManage && <div className="mt-4 flex flex-wrap gap-3">{role === "Mentor" && session.status === "pending" && <><button onClick={() => onStatus(session.id, "accepted")} className="text-xs font-bold text-blue-700">Accept</button><button onClick={() => onStatus(session.id, "declined")} className="text-xs font-bold text-rose-600">Decline</button></>}{role === "Mentor" && session.status === "accepted" && <button onClick={() => onStatus(session.id, "completed")} className="text-xs font-bold text-blue-700">Mark completed</button>}{role === "Graduate" && ["pending", "accepted"].includes(session.status) && <button onClick={() => onStatus(session.id, "cancelled")} className="text-xs font-bold text-rose-600">Cancel request</button>}</div>}
      </article>)}</div>
    </div>
  </section>;
}
