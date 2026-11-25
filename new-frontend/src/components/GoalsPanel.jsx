import { useState } from "react";

const today = new Date();
const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

export default function GoalsPanel({ goals, loading, canManage, onCreate, onUpdate, onStatus, onShare, mentorView = false }) {
  const [newGoal, setNewGoal] = useState({ title: "", description: "", target_date: "", shared_with_mentor: false });
  const [updates, setUpdates] = useState({});

  const updateForm = (goalId, field, value) => {
    setUpdates((current) => ({
      ...current,
      [goalId]: { note: "", progress_percent: "", ...current[goalId], [field]: value }
    }));
  };

  const submitGoal = async (event) => {
    event.preventDefault();
    const saved = await onCreate({
      ...newGoal,
      target_date: newGoal.target_date || null,
      shared_with_mentor: newGoal.shared_with_mentor
    });
    if (saved) setNewGoal({ title: "", description: "", target_date: "", shared_with_mentor: false });
  };

  const submitUpdate = async (event, goal) => {
    event.preventDefault();
    const form = updates[goal.id] || {};
    if (!form.note?.trim() || form.progress_percent === "") return;
    const saved = await onUpdate(goal.id, {
      note: form.note,
      progress_percent: Number(form.progress_percent)
    });
    if (saved) setUpdates((current) => ({ ...current, [goal.id]: { note: "", progress_percent: "" } }));
  };

  return <section className="space-y-5">
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold text-slate-900">{mentorView ? "Goals shared by mentees" : "Your goals"}</h2>
      <p className="mt-1 text-sm text-slate-500">{mentorView ? "These graduates have shared their goals with you after an accepted mentorship session." : "Create milestones and keep a dated history of your progress."}</p>
      {canManage && <form onSubmit={submitGoal} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Goal title<input required maxLength={180} value={newGoal.title} onChange={(event) => setNewGoal({ ...newGoal, title: event.target.value })} placeholder="Build a portfolio project" className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <label className="text-xs font-bold text-slate-600">Target date<input type="date" min={todayLocal} value={newGoal.target_date} onChange={(event) => setNewGoal({ ...newGoal, target_date: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">What will you do?<textarea maxLength={5000} rows={2} value={newGoal.description} onChange={(event) => setNewGoal({ ...newGoal, description: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" checked={newGoal.shared_with_mentor} onChange={(event) => setNewGoal({ ...newGoal, shared_with_mentor: event.target.checked })} className="h-4 w-4 accent-blue-700"/> Share with mentors I have an accepted or completed session with</label>
        <button className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Add goal</button>
      </form>}
      {!canManage && !mentorView && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">This account’s goals are read-only. Sign in to your graduate account to add or update goals.</p>}
    </div>

    {loading && <p className="text-sm text-slate-500">Loading goals…</p>}
    {!loading && goals.length === 0 && <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">{mentorView ? "No mentees have shared goals with you yet. Graduates can opt in to sharing after you have an accepted or completed session." : "No goals yet. Add a first milestone above to start tracking progress."}</p>}
    {goals.map((goal) => {
      const form = updates[goal.id] || { note: "", progress_percent: "" };
      return <article key={goal.id} className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-extrabold text-slate-900">{goal.title}</h3>{mentorView && <p className="mt-1 text-xs font-semibold text-blue-700">Shared by {goal.mentee_name}</p>}{goal.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{goal.description}</p>}</div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold capitalize text-blue-700">{goal.status}</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{goal.progress_percent}% complete</span><span>{goal.target_date ? `Target ${goal.target_date}` : "No target date"}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${goal.progress_percent}%` }} /></div>
        {canManage && goal.status !== "completed" && <form onSubmit={(event) => submitUpdate(event, goal)} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
          <input required maxLength={2000} value={form.note} onChange={(event) => updateForm(goal.id, "note", event.target.value)} placeholder="Add a progress update" className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" />
          <input required type="number" min={goal.progress_percent} max="100" value={form.progress_percent} onChange={(event) => updateForm(goal.id, "progress_percent", event.target.value)} placeholder="New % (at least current)" className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" />
          <button className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700">Record update</button>
        </form>}
        {canManage && <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={Boolean(goal.shared_with_mentor)} onChange={(event) => onShare(goal.id, event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-700"/> Share this goal with mentors I have an accepted or completed session with</label>}
        {canManage && <div className="mt-3 flex gap-2">{goal.status !== "paused" && goal.status !== "completed" && <button onClick={() => onStatus(goal.id, "paused")} className="text-xs font-bold text-slate-500">Pause goal</button>}{goal.status === "paused" && <button onClick={() => onStatus(goal.id, "active")} className="text-xs font-bold text-blue-700">Resume goal</button>}</div>}
        {goal.updates.length > 0 && <div className="mt-5 border-t border-blue-100 pt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Progress history</h4><ul className="mt-3 space-y-3">{goal.updates.map((update) => <li key={update.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-700">{update.note}<span className="mt-1 block text-xs text-slate-400">{new Date(update.created_at).toLocaleDateString([], { dateStyle: "medium" })}</span></span><span className="shrink-0 text-xs font-bold text-blue-700">{update.progress_percent}%</span></li>)}</ul></div>}
      </article>;
    })}
  </section>;
}
