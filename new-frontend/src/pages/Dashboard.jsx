import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, Sparkles, Users, CalendarClock, UploadCloud, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MentorCard from "../components/MentorCard";
import AuthPanel from "../components/AuthPanel";
import GoalsPanel from "../components/GoalsPanel";
import SessionsPanel from "../components/SessionsPanel";
import PasswordChangePanel from "../components/PasswordChangePanel";
import { demoAccounts, demoStats } from "../data/demo";
import api from "../services/api";

function StatCard({ item, icon: Icon }) {
  return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{item.label}</span><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={18}/></span></div><div className="mt-4 text-3xl font-black tracking-tight text-slate-900">{item.value}</div><div className="mt-1 text-xs font-medium text-blue-600">{item.note}</div></div>;
}

export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [role, setRole] = useState("Graduate");
  const [userId, setUserId] = useState(() => localStorage.getItem("mentormatch_user_id"));
  const [authToken, setAuthToken] = useState(() => (
    localStorage.getItem("mentormatch_user_id")
      ? localStorage.getItem("mentormatch_token")
      : null
  ));
  const [selectedAccountId, setSelectedAccountId] = useState(() => localStorage.getItem("mentormatch_user_id") || "");
  const [notice, setNotice] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationRevision, setRecommendationRevision] = useState(0);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [resumeUploading, setResumeUploading] = useState(false);
  const resumeInputRef = useRef(null);
  const [profile, setProfile] = useState({ name: "", email: "", profile_text: "", career_goals: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const isDemoAccount = demoAccounts.some((account) => account.id === selectedAccountId);
  const canManageAccount = selectedAccountId === userId;
  const canEditProfile = canManageAccount && (!isDemoAccount || role === "Mentor");

  useEffect(() => {
    const onSessionExpired = () => setAuthToken("");
    window.addEventListener("mentormatch:session-expired", onSessionExpired);
    return () => window.removeEventListener("mentormatch:session-expired", onSessionExpired);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setProfileLoading(true);
    api.get(`/users/${selectedAccountId}`)
      .then(({ data }) => {
        if (!cancelled) {
          setProfile({ name: data.name, email: data.email, profile_text: data.profile_text, career_goals: data.career_goals });
          setRole(data.role === "mentor" ? "Mentor" : "Graduate");
        }
      })
      .catch(() => {
        if (!cancelled) setNotice("Could not load your saved profile. Check that the backend is running and your saved account still exists.");
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, selectedAccountId]);

  useEffect(() => {
    if (!authToken || role !== "Graduate") return;
    let cancelled = false;
    setRecommendationsLoading(true);
    setRecommendationError("");
    api.get(`/users/${selectedAccountId}/recommendations`)
      .then(({ data }) => { if (!cancelled) setRecommendations(data); })
      .catch((error) => {
        if (!cancelled) {
          setRecommendations([]);
          const detail = error.response?.data?.detail;
          setRecommendationError(typeof detail === "string" ? detail : "The recommendation service could not load matches. Please try again.");
        }
      })
      .finally(() => { if (!cancelled) setRecommendationsLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, role, selectedAccountId, recommendationRevision]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setWorkspaceLoading(true);
    api.get(`/users/${selectedAccountId}/goals`)
      .then(({ data }) => {
        if (!cancelled) setGoals(data);
      })
      .catch((error) => {
        if (!cancelled) {
          const detail = error.response?.data?.detail;
          setNotice(typeof detail === "string" ? detail : "Could not load goals. Check that the backend is running.");
        }
      })
      .finally(() => { if (!cancelled) setWorkspaceLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, selectedAccountId, workspaceRevision]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    api.get(`/users/${selectedAccountId}/sessions`)
      .then(({ data }) => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setNotice("Could not load sessions. Please try again."); });
    if (role === "Mentor") {
      api.get(`/users/${selectedAccountId}/availability`)
        .then(({ data }) => { if (!cancelled) setAvailability(data); })
        .catch(() => { if (!cancelled) setAvailability([]); });
    } else setAvailability([]);
    return () => { cancelled = true; };
  }, [authToken, selectedAccountId, role, workspaceRevision]);

  const updateProfileField = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const signOut = () => {
    localStorage.removeItem("mentormatch_token");
    localStorage.removeItem("mentormatch_user_id");
    localStorage.removeItem("mentormatch_selected_account_id");
    setAuthToken(null);
    setUserId(null);
    setSelectedAccountId("");
    setActive("overview");
    setProfile({ name: "", email: "", profile_text: "", career_goals: "" });
    setGoals([]);
    setRecommendations([]);
    setNotice("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!canEditProfile) {
      setNotice("Demo accounts are read-only. Select your own account to edit a profile.");
      return;
    }
    setNotice("");
    setProfileSaving(true);
    try {
      const response = await api.put(`/users/${selectedAccountId}/profile`, {
        profile_text: profile.profile_text,
        career_goals: profile.career_goals
      });
      setProfile({ name: response.data.name, email: response.data.email, profile_text: response.data.profile_text, career_goals: response.data.career_goals });
      setNotice("Your profile and career goals were saved.");
    } catch (error) {
      const detail = error.response?.data?.detail;
      setNotice(typeof detail === "string" ? detail : "Could not save your profile. Check the details and make sure the backend is running.");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveWorkspaceRecord = async (request, successNotice) => {
    try {
      await request();
      setWorkspaceRevision((revision) => revision + 1);
      setNotice(successNotice);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      setNotice(typeof detail === "string" ? detail : "Could not save this item. Check that the backend is running.");
      return false;
    }
  };

  const createGoal = (data) => saveWorkspaceRecord(
    () => api.post(`/users/${selectedAccountId}/goals`, data),
    "Goal added."
  );
  const updateGoal = (goalId, data) => saveWorkspaceRecord(
    () => api.post(`/users/${selectedAccountId}/goals/${goalId}/updates`, data),
    "Progress update recorded."
  );
  const updateGoalStatus = (goalId, status) => saveWorkspaceRecord(
    () => api.patch(`/users/${selectedAccountId}/goals/${goalId}`, { status }),
    status === "paused" ? "Goal paused." : "Goal resumed."
  );
  const addAvailability = (data) => saveWorkspaceRecord(
    () => api.post(`/users/${selectedAccountId}/availability`, data),
    "Availability added. Graduates can now request this time."
  );
  const removeAvailability = (slotId) => saveWorkspaceRecord(
    () => api.delete(`/users/${selectedAccountId}/availability/${slotId}`),
    "Availability removed."
  );
  const bookSession = (data) => saveWorkspaceRecord(
    () => api.post(`/users/${selectedAccountId}/sessions`, data),
    "Session request sent. The mentor will need to accept it."
  );
  const updateSession = (sessionId, status) => saveWorkspaceRecord(
    () => api.patch(`/sessions/${sessionId}`, { status }),
    status === "accepted" ? "Session accepted." : status === "declined" ? "Session declined." : status === "completed" ? "Session marked complete." : "Session cancelled."
  );
  const uploadResume = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!userId || selectedAccountId !== userId) {
      setNotice("Select your own account before uploading a resume.");
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setNotice("Choose a PDF or DOCX resume.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice("The resume must be 10 MB or smaller.");
      return;
    }
    setResumeUploading(true);
    setNotice("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/users/${userId}/resume`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setProfile((current) => ({ ...current, profile_text: data.profile_text }));
      setNotice("Resume text was extracted and saved to your profile. Review it in My profile.");
    } catch (error) {
      const detail = error.response?.data?.detail;
      setNotice(typeof detail === "string" ? detail : "Could not upload the resume. Check that the backend is running.");
    } finally {
      setResumeUploading(false);
    }
  };

  const acceptSession = (session) => {
    const account = session.user;
    localStorage.setItem("mentormatch_token", session.access_token);
    localStorage.setItem("mentormatch_user_id", account.id);
    setAuthToken(session.access_token);
    setUserId(account.id);
    setSelectedAccountId(account.id);
    setProfile({ name: account.name, email: account.email, profile_text: account.profile_text, career_goals: account.career_goals });
    setRole(account.role === "mentor" ? "Mentor" : "Graduate");
    setActive("overview");
  };

  const matchedMentors = recommendations.map((mentor) => ({
    ...mentor,
    role: "Mentor",
    id: mentor.mentor_id,
    company: "",
    experience: "",
    location: "",
    initials: mentor.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    score: Math.round(mentor.score * 100),
    tags: mentor.shared_skills,
    profile_text: mentor.profile_text
  }));
  const titles = { overview: [role === "Mentor" ? "Mentor workspace" : "Your dashboard", role === "Mentor" ? "Manage your availability and mentorship requests." : "A snapshot of your mentorship journey."], profile: ["Your profile", "Keep your professional story up to date."], mentors: ["Recommended mentors", "People whose experience aligns with your career goals."], goals: ["Mentee goals", "Set targets and record progress."], sessions: [role === "Mentor" ? "Availability & sessions" : "Sessions", role === "Mentor" ? "Set open times and respond to graduate requests." : "Book a time a mentor has made available."], settings: ["Settings", "Manage your account preferences."] };
  const [title, subtitle] = titles[active] || titles.overview;

  if (!authToken) return <AuthPanel onAuthenticated={acceptSession} />;

  return <main className="page-bg min-h-screen p-3 sm:p-5 lg:p-6">
    <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar active={active} onNavigate={setActive} onSignOut={signOut} role={role} accountName={profile.name}/>
      <section className="min-w-0 px-1 py-2 sm:px-3 lg:px-5 lg:py-3">
        <Topbar title={role === "Mentor" && active === "overview" ? "Mentor overview" : title} subtitle={subtitle}/>
        {notice && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
        <input ref={resumeInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={uploadResume}/>
        {active === "overview" && role === "Graduate" && <>
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
            <div className="relative z-10 max-w-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14}/> Your next opportunity starts here</div><h2 className="text-2xl font-black leading-tight sm:text-3xl">The right guidance can change your career.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Discover experienced professionals who can help you turn your ambitions into a clear career path.</p><button onClick={() => setActive("mentors")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-lg hover:bg-blue-50">Explore your matches <ArrowUpRight size={16}/></button></div>
            <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10"/><div className="pointer-events-none absolute -bottom-32 right-36 h-64 w-64 rounded-full bg-sky-300/20 blur-2xl"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">{demoStats.map((s,i) => <StatCard key={s.label} item={i === 1 ? { ...s, value: String(matchedMentors.length), note: "Live recommendations" } : s} icon={[FileText,Users,Sparkles][i]}/>)}</div>
          <div className="mt-8 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Top mentor matches</h2><p className="mt-1 text-sm text-slate-500">Ranked from the selected mentee profile and career goals.</p></div><button onClick={() => setActive("mentors")} className="hidden items-center gap-1 text-sm font-bold text-blue-700 sm:flex">View all <ChevronRight size={16}/></button></div>
          {recommendationsLoading && <p className="mt-4 text-sm text-slate-500">Loading mentor matches…</p>}
          {!recommendationsLoading && matchedMentors.length === 0 && <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No recommendations yet. Start the backend and seed the demo profiles to see matches.</p>}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">{matchedMentors.slice(0,2).map(m => <MentorCard key={m.mentor_id} mentor={m} onBook={bookSession}/>)}</div>
          <div className="glass mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl p-5 sm:flex-row"><div className="flex w-full items-center gap-3"><div className="shrink-0 rounded-xl bg-blue-50 p-3 text-blue-700"><UploadCloud size={22}/></div><div><h3 className="font-bold text-slate-900">Update your resume</h3><p className="text-xs leading-5 text-slate-500">Upload a PDF or DOCX (up to 10 MB). We extract its text into your profile; the original file is not stored.</p></div></div><button disabled={resumeUploading || !canEditProfile} onClick={() => resumeInputRef.current?.click()} className="w-full shrink-0 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60 sm:w-auto">{resumeUploading ? "Reading resume…" : "Choose resume"}</button></div>
        </>}
        {active === "mentors" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Matches for {profile.name || "the selected graduate"}</p><button onClick={() => { setNotice(""); setRecommendationRevision((revision) => revision + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Sparkles size={16}/> Refresh matches</button></div>{recommendationsLoading && <p className="mb-4 text-sm text-slate-500">Loading recommendations…</p>}{recommendationError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{recommendationError}</p>}{!recommendationsLoading && !recommendationError && matchedMentors.length === 0 && <p className="mb-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No mentor matches are available for this profile yet.</p>}<div className="grid gap-4 xl:grid-cols-2">{matchedMentors.map(m => <MentorCard key={m.mentor_id} mentor={m} onBook={bookSession}/>)}</div></>}
        {active === "profile" && <form onSubmit={saveProfile} className="glass max-w-3xl rounded-2xl p-6"><h2 className="text-lg font-extrabold">{role === "Mentor" ? "Mentor profile" : "Professional profile"}</h2><p className="mt-1 text-sm text-slate-500">{canEditProfile ? "Your profile is saved to MentorMatch." : "Demo graduate profiles are read-only."}</p>{profileLoading && <p className="mt-3 text-sm text-blue-700">Loading saved profile…</p>}{role === "Graduate" && <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl bg-blue-50/80 p-4 sm:flex-row"><div><h3 className="text-sm font-bold text-slate-800">Resume</h3><p className="mt-1 text-xs leading-5 text-slate-600">Replace your saved profile text from a PDF or DOCX. The original file is not stored.</p></div><button type="button" disabled={resumeUploading || !canEditProfile} onClick={() => resumeInputRef.current?.click()} className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-60 sm:w-auto">{resumeUploading ? "Reading resume…" : "Update resume"}</button></div>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Full name<input required maxLength={120} value={profile.name} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600">Email<input required type="email" maxLength={255} value={profile.email} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">{role === "Mentor" ? "Expertise and professional experience" : "Education, career interest, and skills"}<textarea maxLength={20000} rows={5} value={profile.profile_text} onChange={updateProfileField("profile_text")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"/></label>{role === "Graduate" && <label className="text-xs font-bold text-slate-600 sm:col-span-2">Career goals<textarea maxLength={5000} rows={3} value={profile.career_goals} onChange={updateProfileField("career_goals")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"/></label>}</div><button disabled={!canEditProfile || profileSaving || profileLoading} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{profileSaving ? "Saving…" : "Save changes"}</button></form>}
        {active === "goals" && (role === "Graduate" ? <GoalsPanel goals={goals} loading={workspaceLoading} canManage={canManageAccount} onCreate={createGoal} onUpdate={updateGoal} onStatus={updateGoalStatus}/> : <p className="rounded-xl bg-white/70 p-5 text-sm text-slate-500">Mentee goals are available when viewing a graduate account.</p>)}
        {active === "sessions" && <SessionsPanel role={role} userId={selectedAccountId} isDemoAccount={isDemoAccount} mentors={matchedMentors} slots={availability} sessions={sessions} canManage={canManageAccount} onAddAvailability={addAvailability} onRemoveAvailability={removeAvailability} onBook={bookSession} onStatus={updateSession}/>}
        {active === "settings" && <PasswordChangePanel onNotice={(message, isError = false) => setNotice(isError ? `Error: ${message}` : message)}/>}
        {active === "overview" && role === "Mentor" && <div className="space-y-5"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 p-7 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Mentor workspace</p><h2 className="mt-3 text-2xl font-black">Share your experience, on your schedule.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Set the times you can meet, review graduate requests, and keep your professional profile current.</p><button onClick={() => setActive("sessions")} className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-900">Manage availability</button></div><div className="grid gap-4 sm:grid-cols-2"><StatCard item={{label:"Upcoming availability",value:String(availability.length),note:"Open times graduates can request"}} icon={CalendarClock}/><StatCard item={{label:"Session requests",value:String(sessions.filter((item) => item.status === "pending").length),note:"Waiting for your response"}} icon={Users}/></div><div className="glass rounded-2xl p-6"><h2 className="text-lg font-extrabold">Next sessions</h2>{sessions.length === 0 ? <p className="mt-2 text-sm text-slate-500">No session requests yet. Add an opening so graduates can book time with you.</p> : <div className="mt-3 space-y-2">{sessions.slice(0, 3).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white/70 px-4 py-3 text-sm"><span className="font-semibold">{item.mentee_name} · {new Date(item.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span><span className="font-bold capitalize text-blue-700">{item.status}</span></div>)}</div>}</div></div>}
      </section>
    </div>
  </main>;
}
