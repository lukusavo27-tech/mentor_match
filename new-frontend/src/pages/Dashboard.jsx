import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, Sparkles, Users, CalendarCheck, UploadCloud, ChevronRight } from "lucide-react";
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
  const [resumeUploading, setResumeUploading] = useState(false);
  const resumeInputRef = useRef(null);
  const [profile, setProfile] = useState({ name: "", email: "", profile_text: "", career_goals: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const isDemoAccount = demoAccounts.some((account) => account.id === selectedAccountId);
  const canManageAccount = selectedAccountId === userId;
  const canEditProfile = canManageAccount && !isDemoAccount;

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
    Promise.all([
      api.get(`/users/${selectedAccountId}/goals`),
      api.get(`/users/${selectedAccountId}/sessions`)
    ])
      .then(([goalResponse, sessionResponse]) => {
        if (!cancelled) {
          setGoals(goalResponse.data);
          setSessions(sessionResponse.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const detail = error.response?.data?.detail;
          setNotice(typeof detail === "string" ? detail : "Could not load goals and sessions. Check that the backend is up to date.");
        }
      })
      .finally(() => { if (!cancelled) setWorkspaceLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, selectedAccountId, workspaceRevision]);

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
    setProfile({ name: "", email: "", profile_text: "", career_goals: "" });
    setGoals([]);
    setSessions([]);
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
  const createSession = (data) => saveWorkspaceRecord(
    () => api.post(`/users/${selectedAccountId}/sessions`, data),
    "Session request sent."
  );
  const requestSessionWithMentor = (mentor, data) => createSession({
    ...data,
    mentor_id: mentor.mentor_id || mentor.id,
  });
  const updateSession = (sessionId, status) => saveWorkspaceRecord(
    () => api.patch(`/sessions/${sessionId}`, { status }),
    `Session ${status}.`
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
  const availableMentors = Array.from(new Map([
    ...demoAccounts.filter((account) => account.role === "mentor").map((account) => [account.id, { id: account.id, name: account.name }]),
    ...matchedMentors.map((mentor) => [mentor.mentor_id, { id: mentor.mentor_id, name: mentor.name }])
  ]).values());
  const titles = { overview: ["Your dashboard", "A snapshot of your mentorship journey."], profile: ["Your profile", "Keep your professional story up to date."], mentors: ["Recommended mentors", "People whose experience aligns with your career goals."], goals: ["Mentee goals", "Set targets and record progress."], sessions: ["Your sessions", "Request and manage mentorship conversations."], settings: ["Settings", "Manage your account preferences."] };
  const [title, subtitle] = titles[active] || titles.overview;

  if (!authToken) return <AuthPanel onAuthenticated={acceptSession} />;

  return <main className="page-bg min-h-screen p-3 sm:p-5 lg:p-6">
    <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar active={active} onNavigate={setActive} onSignOut={signOut} role={role} accountName={profile.name}/>
      <section className="min-w-0 px-1 py-2 sm:px-3 lg:px-5 lg:py-3">
        <Topbar title={role === "Mentor" && active === "overview" ? "Mentor overview" : title} subtitle={subtitle} sessions={sessions} role={role} onNavigate={setActive}/>
        {notice && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
        {active === "overview" && role === "Graduate" && <>
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
            <div className="relative z-10 max-w-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14}/> Your next opportunity starts here</div><h2 className="text-2xl font-black leading-tight sm:text-3xl">The right guidance can change your career.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Discover experienced professionals who can help you turn your ambitions into a clear career path.</p><button onClick={() => setActive("mentors")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-lg hover:bg-blue-50">Explore your matches <ArrowUpRight size={16}/></button></div>
            <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10"/><div className="pointer-events-none absolute -bottom-32 right-36 h-64 w-64 rounded-full bg-sky-300/20 blur-2xl"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">{demoStats.map((s,i) => <StatCard key={s.label} item={i === 1 ? { ...s, value: String(matchedMentors.length), note: "Live recommendations" } : s} icon={[FileText,Users,Sparkles][i]}/>)}</div>
          <div className="mt-8 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Top mentor matches</h2><p className="mt-1 text-sm text-slate-500">Ranked from the selected mentee profile and career goals.</p></div><button onClick={() => setActive("mentors")} className="hidden items-center gap-1 text-sm font-bold text-blue-700 sm:flex">View all <ChevronRight size={16}/></button></div>
          {recommendationsLoading && <p className="mt-4 text-sm text-slate-500">Loading mentor matches…</p>}
          {!recommendationsLoading && matchedMentors.length === 0 && <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No recommendations yet. Start the backend and seed the demo profiles to see matches.</p>}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">{matchedMentors.slice(0,2).map(m => <MentorCard key={m.mentor_id} mentor={m} onRequestSession={role === "Graduate" && canManageAccount ? requestSessionWithMentor : undefined}/>)}</div>
          <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><UploadCloud size={22}/></div><div><h3 className="font-bold text-slate-900">Update your CV</h3><p className="text-xs text-slate-500">Upload a PDF or DOCX (up to 10 MB) to update your matching profile.</p></div></div><input ref={resumeInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={uploadResume}/><button disabled={resumeUploading || !canEditProfile} onClick={() => resumeInputRef.current?.click()} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60">{resumeUploading ? "Uploading…" : "Upload resume"}</button></div>
        </>}
        {active === "mentors" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Matches for {profile.name || "the selected graduate"}</p><button onClick={() => { setNotice(""); setRecommendationRevision((revision) => revision + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Sparkles size={16}/> Refresh matches</button></div>{recommendationsLoading && <p className="mb-4 text-sm text-slate-500">Loading recommendations…</p>}{recommendationError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{recommendationError}</p>}{!recommendationsLoading && !recommendationError && matchedMentors.length === 0 && <p className="mb-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No mentor matches are available for this profile yet.</p>}<div className="grid gap-4 xl:grid-cols-2">{matchedMentors.map(m => <MentorCard key={m.mentor_id} mentor={m} onRequestSession={role === "Graduate" && canManageAccount ? requestSessionWithMentor : undefined}/>)}</div></>}
        {active === "profile" && <form onSubmit={saveProfile} className="glass max-w-3xl rounded-2xl p-6"><h2 className="text-lg font-extrabold">Professional profile</h2><p className="mt-1 text-sm text-slate-500">{canEditProfile ? "Your profile and career goals are saved to MentorMatch." : "Demo account profiles are read-only. Select your own account to make changes."}</p>{profileLoading && <p className="mt-3 text-sm text-blue-700">Loading saved profile…</p>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Full name<input required maxLength={120} value={profile.name} onChange={updateProfileField("name")} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600">Email<input required type="email" maxLength={255} value={profile.email} onChange={updateProfileField("email")} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Education, career interest, and skills<textarea maxLength={20000} rows={4} value={profile.profile_text} onChange={updateProfileField("profile_text")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Career goals<textarea maxLength={5000} rows={3} value={profile.career_goals} onChange={updateProfileField("career_goals")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></label></div><button disabled={!canEditProfile || profileSaving || profileLoading} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{profileSaving ? "Saving…" : "Save changes"}</button></form>}
        {active === "goals" && (role === "Graduate" ? <GoalsPanel goals={goals} loading={workspaceLoading} canManage={canManageAccount} onCreate={createGoal} onUpdate={updateGoal} onStatus={updateGoalStatus}/> : <p className="rounded-xl bg-white/70 p-5 text-sm text-slate-500">Mentee goals are available when viewing a graduate account.</p>)}
        {active === "sessions" && <SessionsPanel sessions={sessions} loading={workspaceLoading} role={role} mentors={availableMentors} canManage={canManageAccount} onRequest={createSession} onStatus={updateSession}/>}
        {active === "settings" && <PasswordChangePanel onNotice={(message, isError = false) => setNotice(isError ? `Error: ${message}` : message)}/>}
        {active === "overview" && role === "Mentor" && <div className="grid gap-4 sm:grid-cols-3"><StatCard item={{label:"Profile views",value:"18",note:"Demo metric"}} icon={Users}/><StatCard item={{label:"Session requests",value:"04",note:"2 awaiting response"}} icon={CalendarCheck}/><StatCard item={{label:"Availability",value:"Active",note:"Set your weekly hours"}} icon={CalendarCheck}/><div className="glass rounded-2xl p-6 sm:col-span-3"><h2 className="text-xl font-extrabold">Welcome to your mentor workspace</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Complete your expertise, experience and availability profile so graduates can discover you through relevant recommendations.</p><button onClick={() => setActive("profile")} className="mt-5 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Complete mentor profile</button></div></div>}
      </section>
    </div>
  </main>;
}
