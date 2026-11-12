import { useState } from "react";
import { ArrowUpRight, FileText, Sparkles, Users, CalendarCheck, UploadCloud, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MentorCard from "../components/MentorCard";
import { demoMentors, demoStats } from "../data/demo";

function StatCard({ item, icon: Icon }) {
  return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{item.label}</span><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={18}/></span></div><div className="mt-4 text-3xl font-black tracking-tight text-slate-900">{item.value}</div><div className="mt-1 text-xs font-medium text-blue-600">{item.note}</div></div>;
}

export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [role, setRole] = useState("Graduate");
  const [notice, setNotice] = useState("");
  const titles = { overview: ["Your dashboard", "A snapshot of your mentorship journey."], profile: ["Your profile", "Keep your professional story up to date."], mentors: ["Recommended mentors", "People whose experience aligns with your career goals."], sessions: ["Your sessions", "Manage upcoming mentorship conversations."], settings: ["Settings", "Manage your account preferences."] };
  const [title, subtitle] = titles[active] || titles.overview;

  return <main className="page-bg min-h-screen p-3 sm:p-5 lg:p-6">
    <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar active={active} onNavigate={setActive} role={role}/>
      <section className="min-w-0 px-1 py-2 sm:px-3 lg:px-5 lg:py-3">
        <div className="mb-5 flex justify-end">
          <div className="inline-flex rounded-xl border border-white/80 bg-white/60 p-1 text-xs shadow-sm">
            <button onClick={() => setRole("Graduate")} className={`rounded-lg px-3 py-2 font-bold ${role === "Graduate" ? "bg-blue-700 text-white" : "text-slate-500"}`}>Graduate view</button>
            <button onClick={() => setRole("Mentor")} className={`rounded-lg px-3 py-2 font-bold ${role === "Mentor" ? "bg-blue-700 text-white" : "text-slate-500"}`}>Mentor view</button>
          </div>
        </div>
        <Topbar title={role === "Mentor" && active === "overview" ? "Mentor overview" : title} subtitle={subtitle}/>
        {notice && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
        {active === "overview" && role === "Graduate" && <>
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
            <div className="relative z-10 max-w-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14}/> Your next opportunity starts here</div><h2 className="text-2xl font-black leading-tight sm:text-3xl">The right guidance can change your career.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Discover experienced professionals who can help you turn your ambitions into a clear career path.</p><button onClick={() => setActive("mentors")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-lg hover:bg-blue-50">Explore your matches <ArrowUpRight size={16}/></button></div>
            <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10"/><div className="pointer-events-none absolute -bottom-32 right-36 h-64 w-64 rounded-full bg-sky-300/20 blur-2xl"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">{demoStats.map((s,i) => <StatCard key={s.label} item={s} icon={[FileText,Users,Sparkles][i]}/>)}</div>
          <div className="mt-8 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Top mentor matches</h2><p className="mt-1 text-sm text-slate-500">Based on your skills, experience and career interests.</p></div><button onClick={() => setActive("mentors")} className="hidden items-center gap-1 text-sm font-bold text-blue-700 sm:flex">View all <ChevronRight size={16}/></button></div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">{demoMentors.slice(0,2).map(m => <MentorCard key={m.id} mentor={m} onView={() => setNotice(`${m.name}'s profile preview. Connect the mentor profile endpoint to load live details.`)}/>)}</div>
          <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><UploadCloud size={22}/></div><div><h3 className="font-bold text-slate-900">Update your CV</h3><p className="text-xs text-slate-500">A current CV helps us find more relevant mentors.</p></div></div><button onClick={() => setNotice("Resume upload will be connected to the FastAPI upload endpoint.")} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50">Upload resume</button></div>
        </>}
        {active === "mentors" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Showing 3 sample matches · Demo data only</p><button onClick={() => setNotice("Matching will calculate live scores from graduate and mentor profiles once the NLP service is integrated.")} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Sparkles size={16}/> Refresh matches</button></div><div className="grid gap-4 xl:grid-cols-2">{demoMentors.map(m => <MentorCard key={m.id} mentor={m} onView={() => setNotice(`Profile preview for ${m.name}.`)}/>)}</div></>}
        {active === "profile" && <div className="glass max-w-3xl rounded-2xl p-6"><h2 className="text-lg font-extrabold">Professional profile</h2><p className="mt-1 text-sm text-slate-500">This starter form is ready to connect to your profile API.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{[["Full name","Tillen Otuoma"],["Email","tillen@example.com"],["Education","BSc Informatics and Computer Science"],["Career interest","Software Engineering"],["Skills","React, Python, PostgreSQL"],["Career goals","Build scalable software products"]].map(([label,value]) => <label key={label} className="text-xs font-bold text-slate-600">{label}<input defaultValue={value} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></label>)}</div><button onClick={() => setNotice("Profile form is currently using local demo values. Connect PUT /profiles/me to persist changes.")} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Save changes</button></div>}
        {active === "sessions" && <div className="glass rounded-2xl p-6"><div className="flex items-center gap-3"><CalendarCheck className="text-blue-700"/><h2 className="font-extrabold">No sessions scheduled yet</h2></div><p className="mt-2 text-sm text-slate-500">When you request a session with a mentor, it will appear here.</p><button onClick={() => setActive("mentors")} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Find a mentor <ArrowUpRight size={16}/></button></div>}
        {active === "settings" && <div className="glass max-w-2xl rounded-2xl p-6"><h2 className="font-extrabold">Account preferences</h2><p className="mt-2 text-sm text-slate-500">Authentication, notification and privacy settings will be added during backend integration.</p></div>}
        {active === "overview" && role === "Mentor" && <div className="grid gap-4 sm:grid-cols-3"><StatCard item={{label:"Profile views",value:"18",note:"Demo metric"}} icon={Users}/><StatCard item={{label:"Session requests",value:"04",note:"2 awaiting response"}} icon={CalendarCheck}/><StatCard item={{label:"Availability",value:"Active",note:"Set your weekly hours"}} icon={CalendarCheck}/><div className="glass rounded-2xl p-6 sm:col-span-3"><h2 className="text-xl font-extrabold">Welcome to your mentor workspace</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Complete your expertise, experience and availability profile so graduates can discover you through relevant recommendations.</p><button onClick={() => setActive("profile")} className="mt-5 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Complete mentor profile</button></div></div>}
      </section>
    </div>
  </main>;
}
