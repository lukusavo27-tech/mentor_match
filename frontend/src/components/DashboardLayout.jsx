import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import UserAvatar from "./UserAvatar";

const pageNames = { dashboard: "Dashboard", profile: "Profile", resume: "Resume", recommendations: "Mentor recommendations", mentors: "Mentor profile", schedule: "Scheduling", goals: "Goals", availability: "Availability", users: "User management", activity: "System activity", settings: "Settings" };

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const role = path.startsWith("/mentor") ? "Mentor" : path.startsWith("/admin") ? "Administrator" : "Mentee";
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem("mentormatch_demo_user")) || {}; } catch { return {}; } }, []);
  const pageKey = path.split("/")[2] || "dashboard";
  const title = pageNames[pageKey] || pageNames.dashboard;
  const dashboardHref = role === "Mentor" ? "/mentor/dashboard" : role === "Administrator" ? "/admin/dashboard" : "/mentee/dashboard";
  const logout = () => { localStorage.removeItem("mentormatch_demo_user"); navigate("/"); };
  return <main className="page-bg min-h-screen p-3 sm:p-5 lg:p-6"><div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><Sidebar role={role} active={pageKey} onLogout={logout}/><section className="min-w-0 px-1 py-2 sm:px-3 lg:px-5 lg:py-3"><div className="mb-4 flex justify-end"><div className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2"><UserAvatar name={user.name || (role === "Mentor" ? "Grace Wanjiku" : "Tillen Otuoma")} size="sm"/><select aria-label="Demo workspace role" value={role} onChange={event => navigate(`/${event.target.value === "Mentor" ? "mentor" : event.target.value === "Administrator" ? "admin" : "mentee"}/dashboard`)} className="bg-transparent text-xs font-bold text-slate-600"><option>Mentee</option><option>Mentor</option><option>Administrator</option></select></div></div><Topbar title={title} subtitle={`Signed in as ${role.toLowerCase()}`}/><Outlet/></section></div></main>;
}
