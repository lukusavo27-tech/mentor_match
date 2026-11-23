import { useState } from "react";
import { Bell } from "lucide-react";

export default function Topbar({ title, subtitle, sessions = [], role = "Graduate", onNavigate }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const hasPending = sessions.some((session) => session.status === "pending");

  return (
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="Show session notifications"
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen((open) => !open)}
          className="relative rounded-xl border border-white bg-white/70 p-3 text-slate-600 shadow-sm hover:text-blue-700"
        >
          <Bell size={18} />
          {hasPending && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-blue-100 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Sessions</h2>
              <button
                type="button"
                onClick={() => { setNotificationsOpen(false); onNavigate?.("sessions"); }}
                className="text-xs font-bold text-blue-700"
              >View all</button>
            </div>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No session activity yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sessions.slice(0, 4).map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => { setNotificationsOpen(false); onNavigate?.("sessions"); }}
                      className="w-full rounded-xl bg-blue-50/70 p-3 text-left hover:bg-blue-50"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {(role === "Mentor" ? session.mentee_name : session.mentor_name)} · {session.status}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {new Date(session.scheduled_at).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
