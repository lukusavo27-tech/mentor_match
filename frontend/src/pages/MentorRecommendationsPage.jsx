import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import MentorCard from "../components/MentorCard";
import { LoadingIndicator } from "../components/Feedback";
import { demoMentors } from "../data/demo";

export default function MentorRecommendationsPage(){const [loading,setLoading]=useState(false);const mentors=useMemo(()=>[...demoMentors].sort((a,b)=>b.score-a.score),[]);return <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Ranked by compatibility · Demo data</p><button disabled={loading} onClick={()=>{setLoading(true);window.setTimeout(()=>setLoading(false),600);}} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Sparkles size={16}/>{loading?"Refreshing…":"Refresh recommendations"}</button></div>{loading&&<LoadingIndicator label="Finding compatible mentors…"/>}<div className="grid gap-4 xl:grid-cols-2">{mentors.map(mentor=><MentorCard key={mentor.id} mentor={mentor}/>)}</div></section>;}
