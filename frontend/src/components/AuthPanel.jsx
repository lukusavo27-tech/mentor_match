import { useState } from "react";
import { demoAccounts, demoLoginPassword } from "../data/demo";
import api from "../services/api";

function describeAuthError(error) {
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "The API took too long to respond. It may still be waking up; please try again.";
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item.msg).filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  if (!error.response) return "Could not reach the API. Check its URL and CORS settings.";
  return "The request failed (" + error.response.status + "). Check the details and try again.";
}

const firstDemoMentee = demoAccounts.find((account) => account.role === "graduate");

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(firstDemoMentee.email);
  const [password, setPassword] = useState(demoLoginPassword);
  const [role, setRole] = useState("graduate");
  const [demoAccountId, setDemoAccountId] = useState(firstDemoMentee.id);
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSlow(false);
    setNotice("");
    const slowTimer = window.setTimeout(() => setSlow(true), 7000);
    try {
      const response = mode === "login"
        ? await api.post("/auth/login", { email, password }, { timeout: 60000 })
        : await api.post("/auth/register", { name, email, password, role }, { timeout: 60000 });
      onAuthenticated(response.data);
    } catch (error) {
      setNotice(describeAuthError(error));
    } finally {
      window.clearTimeout(slowTimer);
      setSubmitting(false);
      setSlow(false);
    }
  };

  const selectDemo = (accountId) => {
    const account = demoAccounts.find((item) => item.id === accountId);
    if (!account) return;
    setDemoAccountId(accountId);
    setEmail(account.email);
    setPassword(demoLoginPassword);
    setNotice("");
  };

  return <main className="page-bg grid min-h-screen place-items-center p-4">
    <section className="glass w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MentorMatch</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage your profile and explore mentor matches.</p>
      </div>

      {mode === "login" && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <label className="text-xs font-bold text-slate-600">Try a demo account
          <select disabled={submitting} value={demoAccountId} onChange={(event) => selectDemo(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60">
            {demoAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.role}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">Development demo password: <span className="font-bold">{demoLoginPassword}</span></p>
      </div>}

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && <>
          <label className="block text-xs font-bold text-slate-600">Full name
            <input required minLength={1} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" disabled={submitting} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60" />
          </label>
          <label className="block text-xs font-bold text-slate-600">I am a
            <select value={role} onChange={(event) => setRole(event.target.value)} disabled={submitting} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 disabled:opacity-60">
              <option value="graduate">Graduate / mentee</option>
              <option value="mentor">Mentor</option>
            </select>
          </label>
        </>}
        <label className="block text-xs font-bold text-slate-600">Email
          <input required type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" disabled={submitting} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60" />
        </label>
        <label className="block text-xs font-bold text-slate-600">Password
          <input required type="password" minLength={mode === "register" ? 10 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={submitting} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60" />
        </label>
        {notice && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{notice}</p>}
        <button disabled={submitting} className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 disabled:cursor-wait disabled:opacity-60">{submitting ? (slow ? "Waking the server…" : mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</button>
        {submitting && <p role="status" className="text-center text-xs leading-5 text-slate-500">{slow ? "The API can take up to a minute to wake after inactivity. You can keep this page open." : "Connecting to MentorMatch…"}</p>}
      </form>
      <button disabled={submitting} onClick={() => { setMode(mode === "login" ? "register" : "login"); setNotice(""); }} className="mt-5 w-full text-sm font-bold text-blue-700 disabled:opacity-50">
        {mode === "login" ? "New to MentorMatch? Create an account" : "Already have an account? Sign in"}
      </button>
    </section>
  </main>;
}
