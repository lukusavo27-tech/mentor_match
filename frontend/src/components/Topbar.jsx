import { useState } from "react";
import { Bell, Search } from "lucide-react";

export default function Topbar({ title, subtitle }) {
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  let user={};try{user=JSON.parse(localStorage.getItem("mentormatch_demo_user"))||{};}catch{}
  const firstName=user.name?.trim().split(/\s+/)[0]||"Tillen";
  return <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><div className="text-sm font-semibold text-blue-700">Good morning, {firstName} 👋</div><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><div className="relative flex items-center gap-2"><label className="hidden items-center gap-2 rounded-xl border border-white bg-white/70 px-3 py-2.5 text-slate-400 shadow-sm md:flex"><Search size={17}/><input aria-label="Search" className="w-36 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search anything"/></label><button type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(value=>!value)} className="relative rounded-xl border border-white bg-white/70 p-3 text-slate-600 shadow-sm hover:text-blue-700"><Bell size={18}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white"/></button>{notificationsOpen&&<div role="status" className="absolute right-0 top-14 z-20 w-64 rounded-2xl border border-blue-100 bg-white p-4 text-sm shadow-xl"><p className="font-bold text-slate-800">Notifications</p><p className="mt-2 text-xs leading-5 text-slate-500">Notifications will appear here when connected to the backend.</p></div>}</div></header>;
}
