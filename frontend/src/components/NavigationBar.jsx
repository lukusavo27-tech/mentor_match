import { Link } from "react-router-dom";
import { UserAvatar } from "./index.js";

export default function NavigationBar({ userName = "Tillen Otuoma", dashboardHref = "/mentee/dashboard" }) {
  return <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><Link to="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-700 text-xl font-black text-white">M</span><span className="text-lg font-extrabold text-slate-900">MentorMatch</span></Link><nav aria-label="Main navigation" className="flex items-center gap-3"><Link to={dashboardHref} className="hidden items-center gap-2 text-sm font-semibold text-slate-600 sm:flex"><UserAvatar name={userName} size="sm"/>{userName}</Link><Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-blue-800">Login</Link><Link to="/register" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Get started</Link></nav></header>;
}
