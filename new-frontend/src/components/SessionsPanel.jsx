import { CalendarClock } from "lucide-react";

export default function SessionsPanel() {
  return (
    <section className="glass max-w-3xl rounded-2xl p-6 sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <CalendarClock size={22} />
      </div>
      <h2 className="mt-5 text-xl font-extrabold text-slate-900">
        Sessions and availability are coming soon
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Mentor availability and session booking are not active yet. We are preparing a clearer scheduling flow so graduates can choose times mentors have actually opened.
      </p>
    </section>
  );
}
