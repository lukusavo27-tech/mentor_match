import { useState } from "react";

const today = new Date();
const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

export default function GoalsPanel({ goals, loading, canManage, onCreate, onUpdate, onStatus }) {
  const [newGoal, setNewGoal] = useState({ title: "", description: "", target_date: "" });
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
      target_date: newGoal.target_date || null
    });
    if (saved) setNewGoal({ title: "", description: "", target_date: "" });
  };

  const submitUpdate = async (event, goal) => {
    event.preventDefault();
    const form = updates[goal.id] || {};
    const saved = await onUpdate(goal.id, {
      note: form.note,
      progress_percent: Number(form.progress_percent)
    });
    if (saved) setUpdates((current) => ({ ...current, [goal.id]: { note: "", progress_percent: "" } }));
  };

  return <section className="space-y-5">
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-extrabold text-slate-900">Mentee goals</h2>
      <p className="mt-1 text-sm text-slate-500">Set a target and record progress as you work toward it.</p>
      {canManage && <form onSubmit={submitGoal} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600">Goal title<input required maxLength={180} value={newGoal.title} onChange={(event) => setNewGoal({ ...newGoal, title: event.target.value })} placeholder="Build a portfolio project" className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <label className="text-xs font-bold text-slate-600">Target date<input type="date" min={todayLocal} value={newGoal.target_date} onChange={(event) => setNewGoal({ ...newGoal, target_date: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">What will you do?<textarea maxLength={5000} rows={2} value={newGoal.description} onChange={(event) => setNewGoal({ ...newGoal, description: event.target.value })} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium" /></label>
        <button className="w-fit rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Add goal</button>
      </form>}
      {!canManage && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">This account’s goals are read-only. Select your own account to add or update goals.</p>}
    </div>

    {loading && <p className="text-sm text-slate-500">Loading goals…</p>}
    {!loading && goals.length === 0 && <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">No goals yet.</p>}
    {goals.map((goal) => {
      const form = updates[goal.id] || { note: "", progress_percent: "" };
      return <article key={goal.id} className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-extrabold text-slate-900">{goal.title}</h3>{goal.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{goal.description}</p>}</div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold capitalize text-blue-700">{goal.status}</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{goal.progress_percent}% complete</span><span>{goal.target_date ? `Target ${goal.target_date}` : "No target date"}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${goal.progress_percent}%` }} /></div>
        {canManage && goal.status !== "completed" && <form onSubmit={(event) => submitUpdate(event, goal)} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
          <input required maxLength={2000} value={form.note} onChange={(event) => updateForm(goal.id, "note", event.target.value)} placeholder="Add a progress update" className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" />
          <input required type="number" min="0" max="100" value={form.progress_percent} onChange={(event) => updateForm(goal.id, "progress_percent", event.target.value)} placeholder="Progress %" className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm" />
          <button className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700">Record update</button>
        </form>}
        {canManage && <div className="mt-3 flex gap-2">{goal.status !== "paused" && goal.status !== "completed" && <button onClick={() => onStatus(goal.id, "paused")} className="text-xs font-bold text-slate-500">Pause goal</button>}{goal.status === "paused" && <button onClick={() => onStatus(goal.id, "active")} className="text-xs font-bold text-blue-700">Resume goal</button>}</div>}
        {goal.updates.length > 0 && <div className="mt-5 border-t border-blue-100 pt-4"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Progress history</h4><ul className="mt-3 space-y-3">{goal.updates.map((update) => <li key={update.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-700">{update.note}</span><span className="shrink-0 text-xs font-bold text-blue-700">{update.progress_percent}%</span></li>)}</ul></div>}
      </article>;
    })}
  </section>;
}
