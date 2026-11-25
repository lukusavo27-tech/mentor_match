import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Target, UserRound, Users } from "lucide-react";

const steps = [
  [UserRound, "Build your profile", "Describe your experience, interests, and career goals."],
  [Sparkles, "Find relevant mentors", "Explore professionals ranked by shared skills and career direction."],
  [Target, "Make steady progress", "Set milestones, record updates, and request mentorship sessions."],
];

export default function LandingPage() {
  return <main className="page-bg min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-lg font-black text-white">M</span><span className="text-lg font-extrabold text-slate-900">MentorMatch</span></Link>
      <nav className="flex items-center gap-3"><Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-white/70">Sign in</Link><Link to="/register" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Create account</Link></nav>
    </header>
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:py-20">
      <div><div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-blue-700"><Sparkles size={15}/> Career growth, together</div><h1 className="mt-6 text-4xl font-black leading-tight text-slate-900 sm:text-6xl">Find the mentor who helps you move forward.</h1><p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Connect with experienced professionals whose skills and career experience align with your ambitions. Turn advice into goals and measurable progress.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/register?role=graduate" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white">Get started <ArrowRight size={17}/></Link><Link to="/register?role=mentor" className="rounded-xl border border-blue-200 bg-white/80 px-5 py-3.5 text-sm font-bold text-blue-800">Join as a mentor</Link></div><p className="mt-4 text-xs text-slate-500">Create an account as a graduate or mentor. Matching is a guide to help start the conversation.</p></div>
      <div className="glass rounded-3xl p-7 sm:p-9"><h2 className="text-xl font-extrabold text-slate-900">A clearer path to your next step</h2><div className="mt-6 space-y-5">{steps.map(([Icon,title,description],index)=><div key={title} className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={19}/></span><div><h3 className="font-bold text-slate-900">{index+1}. {title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div>)}</div><div className="mt-8 grid gap-4 border-t border-blue-100 pt-5 sm:grid-cols-2"><div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound size={16}/> For graduates</h3><p className="mt-1 text-xs leading-5 text-slate-500">Get career direction, relevant connections, and accountability.</p></div><div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Users size={16}/> For mentors</h3><p className="mt-1 text-xs leading-5 text-slate-500">Share your experience and offer guidance on your schedule.</p></div></div></div>
    </section>
  </main>;
}
