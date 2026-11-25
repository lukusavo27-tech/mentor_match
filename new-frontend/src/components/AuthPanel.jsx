import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { demoAccounts, demoLoginPassword } from "../data/demo";
import api from "../services/api";
import Notice from "./Notice";

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

const demoLoginAccounts = [
  ...demoAccounts.filter((account) => account.role === "graduate").slice(0, 2),
  ...demoAccounts.filter((account) => account.role === "mentor").slice(0, 2)
];
const showDemoAccounts = import.meta.env.DEV;

export default function AuthPanel({ onAuthenticated, adminRoute = false }) {
  const location = useLocation();
  const [mode, setMode] = useState(() => location.pathname === "/register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(() => new URLSearchParams(location.search).get("role") === "mentor" ? "mentor" : "graduate");
  const [demoAccountId, setDemoAccountId] = useState("");
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
    setDemoAccountId(accountId);
    const account = demoAccounts.find((item) => item.id === accountId);
    setEmail(account?.email || "");
    setPassword(account ? demoLoginPassword : "");
    setNotice("");
  };

  return <main className="page-bg grid min-h-screen place-items-center p-4">
    <section className="glass w-full max-w-md rounded-3xl p-6 shadow-xl sm:p-8">
      <div className="mb-6">
        <Link to="/" className="text-xs font-bold text-blue-700 hover:underline">← Back to MentorMatch</Link>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700">MentorMatch</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">{adminRoute ? "Administrator sign in" : mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{adminRoute
          ? "Sign in with the administrator credentials provisioned for this installation. Admin accounts cannot be created through public registration."
          : mode === "login"
            ? "Use the email and password you chose when registering. Demo accounts are optional."
            : "Create a graduate or mentor account to use MentorMatch."}</p>
      </div>

      {showDemoAccounts && mode === "login" && !adminRoute && <details className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <summary className="cursor-pointer text-sm font-bold text-blue-800">Use a demo account instead</summary>
        <label className="mt-3 block text-xs font-bold text-slate-600">Sample account
          <select disabled={submitting} value={demoAccountId} onChange={(event) => selectDemo(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60">
            <option value="">Choose a sample account</option>
            {demoLoginAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.role}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-600">Shared demo password: <span className="font-bold">{demoLoginPassword}</span></p>
      </details>}

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
        {notice && <Notice message={notice} kind="error" onDismiss={() => setNotice("")}/>}
        <button disabled={submitting} className="w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 disabled:cursor-wait disabled:opacity-60">{submitting ? (slow ? "Waking the server…" : mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</button>
        {submitting && <p role="status" className="text-center text-xs leading-5 text-slate-500">{slow ? "The API can take up to a minute to wake after inactivity. You can keep this page open." : "Connecting to MentorMatch…"}</p>}
      </form>
      {mode === "login" && <p className="mt-5 text-center text-sm text-slate-600">{adminRoute ? "Not an administrator?" : "Need administrator access?"}{" "}
        <Link to={adminRoute ? "/login" : "/admin"} className="font-bold text-blue-700 hover:underline">{adminRoute ? "Regular user sign in" : "Administrator sign in"}</Link>
      </p>}
      {!adminRoute && <button disabled={submitting} onClick={() => { setMode(mode === "login" ? "register" : "login"); setNotice(""); }} className="mt-4 w-full text-sm font-bold text-blue-700 disabled:opacity-50">
        {mode === "login" ? "New to MentorMatch? Create an account" : "Already have an account? Sign in"}
      </button>}
    </section>
  </main>;
}
