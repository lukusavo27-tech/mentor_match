import { useEffect, useState } from "react";
import { Search, ShieldCheck, Users, UserRound, Clock3, UserCheck, UserX } from "lucide-react";
import api from "../services/api";
import Notice from "./Notice";
import { getApiErrorMessage } from "../services/apiError";

const emptySummary = {
  total_users: 0,
  active_users: 0,
  suspended_users: 0,
  graduates: 0,
  mentors: 0,
  pending_sessions: 0
};

export default function AdminPanel({ currentUserId }) {
  const [summary, setSummary] = useState(emptySummary);
  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice && !error) return undefined;
    const timeout = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [notice, error]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = { search, offset, limit: 20 };
    if (role) params.role = role;
    if (status) params.is_active = status === "active";
    Promise.all([
      api.get("/admin/summary"),
      api.get("/admin/users", { params })
    ])
      .then(([summaryResponse, usersResponse]) => {
        if (!cancelled) {
          // Keep valid summary counts visible even if this backend's accounts
          // endpoint has a response shape the current UI does not recognize.
          setSummary(summaryResponse.data);
          const payload = usersResponse.data;
          const accountRows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.users)
              ? payload.users
              : Array.isArray(payload?.items)
                ? payload.items
                : null;
          if (!accountRows) {
            setUsers([]);
            const responseShape = payload === null
              ? "an empty response"
              : Array.isArray(payload)
                ? "an array"
                : typeof payload === "object"
                  ? `an object with fields: ${Object.keys(payload).join(", ") || "none"}`
                  : typeof payload;
            setError(`Could not read account records: /admin/users returned ${responseShape}. The current backend should return a list or an object containing users/items. Check the backend URL and version.`);
            return;
          }
          setUsers(accountRows);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setNotice("");
          setError(getApiErrorMessage(requestError, "Could not load admin data."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [search, role, status, offset, revision]);

  const applySearch = (event) => {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const updateStatus = async (user) => {
    if (!user.is_active && !window.confirm(`Reactivate ${user.name}'s account?`)) return;
    if (user.is_active && !window.confirm(`Suspend ${user.name}'s account? They will be signed out and unable to sign in.`)) return;
    try {
      await api.patch(`/admin/users/${user.id}/status`, { is_active: !user.is_active });
      setError("");
      setNotice(user.is_active ? "Account suspended." : "Account reactivated.");
      setRevision((value) => value + 1);
    } catch (requestError) {
      setNotice("");
      setError(getApiErrorMessage(requestError, "Could not update the account."));
    }
  };

  const deleteUser = async (user) => {
    const confirmed = window.confirm(
      `Permanently delete ${user.name} (${user.email}) and their profile, goals, sessions, availability, and recommendations? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      setError("");
      setNotice("Account and related records deleted.");
      setRevision((value) => value + 1);
    } catch (requestError) {
      setNotice("");
      setError(getApiErrorMessage(requestError, "Could not delete the account."));
    }
  };

  const stats = [
    ["Users", summary.total_users, Users],
    ["Active", summary.active_users, UserCheck],
    ["Suspended", summary.suspended_users, UserX],
    ["Graduates", summary.graduates, UserRound],
    ["Mentors", summary.mentors, ShieldCheck],
    ["Pending requests", summary.pending_sessions, Clock3]
  ];
  const userRows = Array.isArray(users) ? users : [];

  return <section className="space-y-5">
    <div>
      <h2 className="text-xl font-extrabold text-slate-900">Administration</h2>
      <p className="mt-1 text-sm text-slate-500">Review platform activity and manage graduate, mentor, and administrator accounts.</p>
    </div>
    {notice && <Notice message={notice} kind="success" onDismiss={() => setNotice("")}/>}
    {error && <Notice message={error} kind="error" onDismiss={() => setError("")}/>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {stats.map(([label, value, Icon]) => <article key={label} className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
          {label}<Icon size={18} className="text-blue-700"/>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900">{loading ? "…" : value}</p>
      </article>)}
    </div>
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">Accounts</h3>
          <p className="mt-1 text-xs text-slate-500">{summary.active_users} active · {summary.suspended_users} suspended</p>
        </div>
        <form onSubmit={applySearch} className="flex min-w-[240px] flex-1 gap-2 sm:max-w-sm">
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Search name or email" className="min-w-0 flex-1 rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm"/>
          <button aria-label="Search users" className="rounded-xl bg-blue-700 px-3 text-white"><Search size={17}/></button>
        </form>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={role} onChange={(event) => { setRole(event.target.value); setOffset(0); }} aria-label="Filter by account type" className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm">
          <option value="">All account types</option><option value="graduate">Graduate</option><option value="mentor">Mentor</option><option value="admin">Administrator</option>
        </select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }} aria-label="Filter by account status" className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>
      {loading && <p className="py-6 text-sm text-slate-500">Loading accounts…</p>}
      {!loading && userRows.length === 0 && !error && <p className="py-6 text-sm text-slate-500">No accounts match these filters.</p>}
      {!loading && userRows.length > 0 && <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-blue-100 text-xs uppercase text-slate-500"><tr><th className="py-3 pr-3">Account</th><th className="py-3 pr-3">Type</th><th className="py-3 pr-3">Status</th><th className="py-3 pr-3">Created</th><th className="py-3">Actions</th></tr></thead>
          <tbody>{userRows.map((user) => <tr key={user.id} className="border-b border-blue-50 last:border-0">
            <td className="py-3 pr-3"><p className="font-bold text-slate-800">{user.name}{user.is_admin && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">ADMIN</span>}</p><p className="text-xs text-slate-500">{user.email}</p></td>
            <td className="py-3 pr-3 capitalize text-slate-600">{user.is_admin ? "Administrator" : user.role}</td>
            <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{user.is_active ? "Active" : "Suspended"}</span></td>
            <td className="py-3 pr-3 text-xs text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
            <td className="py-3"><div className="flex gap-2">
              <button disabled={user.id === currentUserId} onClick={() => updateStatus(user)} className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-40">{user.is_active ? "Suspend" : "Reactivate"}</button>
              <button disabled={user.id === currentUserId} onClick={() => deleteUser(user)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40">Delete</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-4 flex justify-end gap-2">
        <button disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - 20))} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">Previous</button>
        <button disabled={userRows.length < 20 || loading} onClick={() => setOffset((value) => value + 20)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40">Next</button>
      </div>
    </div>
  </section>;
}
