import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import FormField from "./FormField";
import { ErrorMessage } from "./Feedback";
import { demoPassword, demoUsers } from "../data/demo";

function dashboardForRole(role) {
  if (role === "Administrator") return "/admin/dashboard";
  return role === "Mentor" ? "/mentor/dashboard" : "/mentee/dashboard";
}

export default function AuthForm({ mode }) {
  const registering = mode === "register";
  const [role, setRole] = useState(() => localStorage.getItem("mentormatch_signup_role") || "Mentee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function selectDemoAccount(event) {
    const account = demoUsers.find(user => user.id === event.target.value);
    if (!account) return;
    setEmail(account.email);
    setPassword(demoPassword);
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    if (registering && form.get("password") !== form.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }

    const normalizedEmail = String(form.get("email")).trim().toLowerCase();
    let account;
    if (!registering) {
      account = demoUsers.find(user => user.email === normalizedEmail);
      if (!account || account.password !== form.get("password")) {
        setError("Email or password is incorrect. Choose a demo account below to preview a dashboard.");
        return;
      }
    }

    const accountRole = registering ? role : account.role;
    const name = registering
      ? String(form.get("name")).trim()
      : account.name;
    localStorage.setItem("mentormatch_demo_user", JSON.stringify({ name, email: normalizedEmail, role: accountRole }));
    localStorage.removeItem("mentormatch_signup_role");
    navigate(dashboardForRole(accountRole));
  }

  return (
    <section className="glass mx-auto mt-10 w-full max-w-lg rounded-3xl p-7 sm:p-9">
      <h1 className="text-2xl font-black">{registering ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {registering ? "Join the MentorMatch community." : "Sign in to continue your mentorship journey."}
      </p>

      {!registering && (
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <label htmlFor="demo-account" className="block text-xs font-bold text-blue-900">Preview a demo dashboard</label>
          <select id="demo-account" defaultValue="" onChange={selectDemoAccount} className="mt-2 w-full rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-sm">
            <option value="" disabled>Select a demo account</option>
            {demoUsers.map(user => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
          </select>
          <p className="mt-2 text-xs text-blue-800">Demo password: <code className="font-bold">{demoPassword}</code></p>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        {registering && <FormField id="name" label="Full name" name="name" autoComplete="name" minLength={2} required/>}
        <FormField id="email" label="Email address" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required/>
        <div>
          <label htmlFor="password" className="block text-xs font-bold text-slate-600">Password</label>
          <div className="mt-2 flex rounded-xl border border-blue-100 bg-white">
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} required className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none"/>
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="px-4 text-slate-500">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
        </div>
        {registering && <>
          <FormField id="confirm" label="Confirm password" name="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required/>
          <label htmlFor="role" className="block text-xs font-bold text-slate-600">Account type
            <select id="role" value={role} onChange={event => setRole(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm"><option>Mentee</option><option>Mentor</option></select>
          </label>
        </>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">{registering ? "Create account" : "Login"}</button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        {registering ? "Already have an account?" : "New to MentorMatch?"} <Link className="font-bold text-blue-700" to={registering ? "/login" : "/register"}>{registering ? "Login" : "Register"}</Link>
      </p>
      <p className="mt-4 text-center text-[11px] text-slate-400">Demo accounts are for frontend previews. Authentication will be connected to the backend.</p>
    </section>
  );
}
