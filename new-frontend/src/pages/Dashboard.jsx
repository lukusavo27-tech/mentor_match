import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText, Sparkles, Users, CalendarClock, UploadCloud, ChevronRight } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MentorCard from "../components/MentorCard";
import AuthPanel from "../components/AuthPanel";
import GoalsPanel from "../components/GoalsPanel";
import SessionsPanel from "../components/SessionsPanel";
import PasswordChangePanel from "../components/PasswordChangePanel";
import ResumePanel from "../components/ResumePanel";
import AdminPanel from "../components/AdminPanel";
import Notice from "../components/Notice";
import { demoAccounts } from "../data/demo";
import api from "../services/api";
import { getApiErrorMessage } from "../services/apiError";

function StatCard({ item, icon: Icon }) {
  return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{item.label}</span><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={18}/></span></div><div className="mt-4 text-3xl font-black tracking-tight text-slate-900">{item.value}</div><div className="mt-1 text-xs font-medium text-blue-600">{item.note}</div></div>;
}

export default function Dashboard({ adminRoute = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthEntryRoute = location.pathname === "/login" || location.pathname === "/register";
  const [active, setActive] = useState("overview");
  const [role, setRole] = useState("Graduate");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(() => localStorage.getItem("mentormatch_user_id"));
  const [authToken, setAuthToken] = useState(() => (
    localStorage.getItem("mentormatch_user_id")
      ? localStorage.getItem("mentormatch_token")
      : null
  ));
  const [selectedAccountId, setSelectedAccountId] = useState(() => localStorage.getItem("mentormatch_user_id") || "");
  const [identityStatus, setIdentityStatus] = useState(() => (
    localStorage.getItem("mentormatch_token") ? "loading" : "anonymous"
  ));
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("info");
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
  const [profile, setProfile] = useState({ name: "", email: "", phone_number: "", profile_text: "", career_goals: "", resume_text: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const isDemoAccount = demoAccounts.some((account) => account.id === selectedAccountId);
  const canManageAccount = selectedAccountId === userId;
  const canEditProfile = canManageAccount && (!isDemoAccount || role === "Mentor");
  const showNotice = useCallback((message, kind = "success") => {
    setNoticeKind(kind);
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), noticeKind === "error" ? 10000 : 6000);
    return () => window.clearTimeout(timeout);
  }, [notice, noticeKind]);

  useEffect(() => {
    const onSessionExpired = () => {
      localStorage.removeItem("mentormatch_is_admin");
      setAuthToken("");
      setIsAdmin(false);
      setIdentityStatus("anonymous");
    };
    window.addEventListener("mentormatch:session-expired", onSessionExpired);
    return () => window.removeEventListener("mentormatch:session-expired", onSessionExpired);
  }, []);

  useEffect(() => {
    if (!authToken) {
      setIdentityStatus("anonymous");
      return;
    }
    let cancelled = false;
    setIdentityStatus("loading");
    setProfileLoading(true);
    api.get("/auth/me")
      .then(({ data }) => {
        if (!cancelled) {
          localStorage.removeItem("mentormatch_is_admin");
          setProfile({ name: data.name, email: data.email, phone_number: data.phone_number || "", profile_text: data.profile_text, career_goals: data.career_goals, resume_text: data.resume_text || "" });
          setRole(data.role === "mentor" ? "Mentor" : "Graduate");
          setIsAdmin(Boolean(data.is_admin));
          setIdentityStatus(data.is_admin ? "admin" : "user");
          if (data.is_admin) {
            setActive("admin");
            if (!isAuthEntryRoute) navigate("/admin", { replace: true });
          } else {
            setActive((current) => current === "admin" ? "overview" : current);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIdentityStatus("error");
          showNotice("Could not verify your account. Check that the backend is running and try again.", "error");
        }
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, isAuthEntryRoute, navigate, showNotice]);

  useEffect(() => {
    if (!authToken || identityStatus !== "user" || role !== "Graduate" || isAdmin) return;
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
  }, [authToken, identityStatus, role, isAdmin, selectedAccountId, recommendationRevision]);

  useEffect(() => {
    if (!authToken || identityStatus !== "user" || isAdmin) return;
    let cancelled = false;
    setWorkspaceLoading(true);
    api.get(role === "Mentor" ? `/users/${selectedAccountId}/shared-goals` : `/users/${selectedAccountId}/goals`)
      .then(({ data }) => {
        if (!cancelled) setGoals(data);
      })
      .catch((error) => {
        if (!cancelled) {
          showNotice(getApiErrorMessage(error, "Could not load goals."), "error");
        }
      })
      .finally(() => { if (!cancelled) setWorkspaceLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, identityStatus, selectedAccountId, role, isAdmin, workspaceRevision, showNotice]);

  useEffect(() => {
    if (!authToken || identityStatus !== "user" || isAdmin) return;
    let cancelled = false;
    api.get(`/users/${selectedAccountId}/sessions`)
      .then(({ data }) => { if (!cancelled) setSessions(data); })
      .catch((error) => { if (!cancelled) showNotice(getApiErrorMessage(error, "Could not load sessions."), "error"); });
    if (role === "Mentor") {
      api.get(`/users/${selectedAccountId}/availability`)
        .then(({ data }) => { if (!cancelled) setAvailability(data); })
        .catch(() => { if (!cancelled) setAvailability([]); });
    } else setAvailability([]);
    return () => { cancelled = true; };
  }, [authToken, identityStatus, selectedAccountId, role, isAdmin, workspaceRevision, showNotice]);

  const updateProfileField = (field) => (event) => {
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const signOut = (destination) => {
    const nextRoute = destination || (isAdmin ? "/admin" : "/login");
    localStorage.removeItem("mentormatch_token");
    localStorage.removeItem("mentormatch_user_id");
    localStorage.removeItem("mentormatch_selected_account_id");
    localStorage.removeItem("mentormatch_is_admin");
    setAuthToken(null);
    setUserId(null);
    setIsAdmin(false);
    setIdentityStatus("anonymous");
    setSelectedAccountId("");
    setActive("overview");
    setProfile({ name: "", email: "", phone_number: "", profile_text: "", career_goals: "", resume_text: "" });
    setGoals([]);
    setRecommendations([]);
    setNotice("");
    navigate(nextRoute, { replace: true });
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!canEditProfile) {
      showNotice("Demo graduate profiles are read-only. Sign out and register a graduate account to edit your own profile.", "error");
      return;
    }
    setNotice("");
    setProfileSaving(true);
    try {
      const response = await api.put(`/users/${selectedAccountId}/profile`, {
        profile_text: profile.profile_text,
        career_goals: profile.career_goals,
        phone_number: profile.phone_number
      });
      setProfile({ name: response.data.name, email: response.data.email, phone_number: response.data.phone_number || "", profile_text: response.data.profile_text, career_goals: response.data.career_goals, resume_text: response.data.resume_text || "" });
      showNotice("Your profile and career goals were saved.");
    } catch (error) {
      showNotice(getApiErrorMessage(error, "Could not save your profile."), "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveWorkspaceRecord = async (request, successNotice) => {
    try {
      await request();
      setWorkspaceRevision((revision) => revision + 1);
      showNotice(successNotice);
      return true;
    } catch (error) {
      showNotice(getApiErrorMessage(error, "Could not save this item."), "error");
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
  const updateGoalSharing = (goalId, sharedWithMentor) => saveWorkspaceRecord(
    () => api.patch(`/users/${selectedAccountId}/goals/${goalId}`, { shared_with_mentor: sharedWithMentor }),
    sharedWithMentor ? "Goal shared with eligible mentors." : "Goal sharing turned off."
  );
  const updateGoalLink = (goalId, data) => saveWorkspaceRecord(
    () => api.patch(`/users/${selectedAccountId}/goals/${goalId}`, data),
    "Goal review link saved."
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
  const optOutMentee = (session) => {
    if (!window.confirm(`Opt out of ${session.mentee_name}? This ends any active session and prevents future requests and matches.`)) return false;
    return saveWorkspaceRecord(
      () => api.post(`/sessions/${session.id}/opt-out`),
      `You opted out of ${session.mentee_name}.`
    );
  };
  const updateSession = (sessionId, status) => saveWorkspaceRecord(
    () => api.patch(`/sessions/${sessionId}`, { status }),
    status === "accepted" ? "Session confirmed. Both participants can now see it in their session list." : status === "declined" ? "Session declined. The graduate can request another available time." : status === "completed" ? "Session marked complete." : "Session cancelled."
  );
  const uploadResume = async (file) => {
    if (!file) return false;
    if (!userId || selectedAccountId !== userId) {
      showNotice("Select your own account before uploading a resume.", "error");
      return false;
    }
    if (isDemoAccount) {
      showNotice("Demo graduate profiles are shared and read-only. Sign out and register a graduate account to upload your resume.", "error");
      return false;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      showNotice("Choose a PDF or DOCX resume. Word .doc files are not supported.", "error");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotice("The resume must be 10 MB or smaller. Choose a smaller file and try again.", "error");
      return false;
    }
    setResumeUploading(true);
    setNotice("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post(`/users/${userId}/resume`, formData);
      setProfile((current) => ({ ...current, resume_text: data.resume_text || "" }));
      showNotice("Resume text was extracted and saved separately from your editable profile and career goals. All three are used for matching.");
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, "Could not upload the resume.");
      const status = error.response?.status;
      showNotice(status === 401 ? "Your session expired. Sign in again to upload your resume." : status === 403 ? "You can only upload a resume to your own registered graduate account." : status === 413 ? "This resume is larger than 10 MB. Choose a smaller file." : message, "error");
      return false;
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
    setProfile({ name: account.name, email: account.email, phone_number: account.phone_number || "", profile_text: account.profile_text, career_goals: account.career_goals, resume_text: account.resume_text || "" });
    setRole(account.role === "mentor" ? "Mentor" : "Graduate");
    setIsAdmin(Boolean(account.is_admin));
    setIdentityStatus(account.is_admin ? "admin" : "user");
    setActive(account.is_admin ? "admin" : "overview");
    navigate(account.is_admin ? "/admin" : "/dashboard", { replace: true });
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
  const profileCompleteness = role === "Graduate"
    ? ([
        profile.profile_text.trim().length > 0,
        profile.career_goals.trim().length > 0,
        profile.name.trim().length > 0,
        profile.email.trim().length > 0,
        profile.phone_number.trim().length > 0,
      ].filter(Boolean).length * 20)
    : ([
        profile.profile_text.trim().length > 0,
        profile.name.trim().length > 0,
        profile.email.trim().length > 0,
        profile.phone_number.trim().length > 0,
      ].filter(Boolean).length * 25);
  const liveProfileCompleteness = Math.round(profileCompleteness);
  const resumeStatus = profile.resume_text.trim()
    ? "Resume text extracted"
    : profile.profile_text.trim()
      ? "Profile text available"
      : "Not provided";
  const dashboardStats = [
    { label: "Profile completeness", value: `${liveProfileCompleteness}%`, note: liveProfileCompleteness === 100 ? "Complete" : "Update your profile" },
    { label: "Potential mentors", value: String(matchedMentors.length), note: "Live recommendations" },
    { label: "Resume status", value: resumeStatus, note: "Extracted text stays editable" },
  ];
  const titles = { admin: ["Administration", "Manage accounts and review basic platform activity."], overview: [role === "Mentor" ? "Mentor workspace" : "Your dashboard", role === "Mentor" ? "Manage your availability and mentorship requests." : "A snapshot of your mentorship journey."], profile: ["Your profile", "Keep your professional story up to date."], mentors: ["Recommended mentors", "People whose experience aligns with your career goals."], goals: [role === "Mentor" ? "Mentee goals" : "Your goals", role === "Mentor" ? "Support mentee progress during mentorship." : "Set targets and record progress."], sessions: [role === "Mentor" ? "Availability & sessions" : "Sessions", role === "Mentor" ? "Set open times and respond to graduate requests." : "Book a time a mentor has made available."], resume: ["Resume upload", "Add readable resume text to strengthen your professional profile."], settings: ["Settings", "Manage your account preferences."] };
  const [title, subtitle] = titles[active] || titles.overview;

  if (!authToken) return <AuthPanel onAuthenticated={acceptSession} adminRoute={adminRoute}/>;
  if (authToken && identityStatus === "loading") return <main className="page-bg grid min-h-screen place-items-center p-4"><section role="status" className="glass rounded-3xl p-8 text-center text-sm font-semibold text-slate-600">Verifying your account…</section></main>;
  if (authToken && isAuthEntryRoute && identityStatus === "error") return <main className="page-bg grid min-h-screen place-items-center p-4"><section className="glass w-full max-w-lg rounded-3xl p-8 text-center"><h1 className="text-2xl font-black text-slate-900">Could not verify your account</h1><p className="mt-2 text-sm leading-6 text-slate-600">The server could not confirm your saved sign-in. Retry, or sign out and sign in again.</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => window.location.reload()} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Try again</button><button onClick={() => signOut(`${location.pathname}${location.search}`)} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Sign out</button></div></section></main>;
  if (authToken && isAuthEntryRoute) return <main className="page-bg grid min-h-screen place-items-center p-4"><section className="glass w-full max-w-lg rounded-3xl p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-xl font-black text-blue-800">M</div><h1 className="mt-4 text-2xl font-black text-slate-900">You’re already signed in</h1><p className="mt-2 text-sm leading-6 text-slate-600">Current account: <strong>{profile.name || profile.email}</strong> · {isAdmin ? "Administrator" : role}.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={() => navigate(isAdmin ? "/admin" : "/dashboard", { replace: true })} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Continue to account</button><button onClick={() => signOut(`${location.pathname}${location.search}`)} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Sign out and switch account</button></div></section></main>;
  if (adminRoute && identityStatus !== "admin") return <main className="page-bg grid min-h-screen place-items-center p-4"><section className="glass w-full max-w-lg rounded-3xl p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-xl font-black text-blue-800">M</div><h1 className="mt-4 text-2xl font-black text-slate-900">{identityStatus === "error" ? "Access could not be verified" : "Administrator access only"}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{identityStatus === "error" ? "The server could not verify your account. Try again when the service is available." : "This area is only available to authorized MentorMatch administrators."}</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => window.location.reload()} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Try again</button><Link to="/dashboard" className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Back to dashboard</Link></div></section></main>;

  return <main className="page-bg min-h-screen p-3 sm:p-5 lg:p-6">
    <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar active={active} onNavigate={setActive} onSignOut={() => signOut()} role={isAdmin ? "Admin" : role} accountName={profile.name} profileCompleteness={liveProfileCompleteness}/>
      <section className="min-w-0 px-1 py-2 sm:px-3 lg:px-5 lg:py-3">
        <Topbar title={role === "Mentor" && active === "overview" ? "Mentor overview" : title} subtitle={subtitle}/>
        {notice && <Notice message={notice} kind={noticeKind} onDismiss={() => setNotice("")}/>}
        {active === "admin" && isAdmin && <AdminPanel currentUserId={userId}/>}
        {active === "overview" && role === "Graduate" && <>
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-800 via-blue-700 to-sky-500 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
            <div className="relative z-10 max-w-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14}/> Your next opportunity starts here</div><h2 className="text-2xl font-black leading-tight sm:text-3xl">The right guidance can change your career.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Discover experienced professionals who can help you turn your ambitions into a clear career path.</p><button onClick={() => setActive("mentors")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-800 shadow-lg hover:bg-blue-50">Explore your matches <ArrowUpRight size={16}/></button></div>
            <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10"/><div className="pointer-events-none absolute -bottom-32 right-36 h-64 w-64 rounded-full bg-sky-300/20 blur-2xl"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">{dashboardStats.map((s,i) => <StatCard key={s.label} item={s} icon={[FileText,Users,Sparkles][i]}/>)}</div>
          <div className="mt-8 flex items-end justify-between gap-3"><div><h2 className="text-xl font-extrabold text-slate-900">Top mentor matches</h2><p className="mt-1 text-sm text-slate-500">Ranked from the selected mentee profile and career goals.</p></div><button onClick={() => setActive("mentors")} className="hidden items-center gap-1 text-sm font-bold text-blue-700 sm:flex">View all <ChevronRight size={16}/></button></div>
          {recommendationsLoading && <p className="mt-4 text-sm text-slate-500">Loading mentor matches…</p>}
          {!recommendationsLoading && matchedMentors.length === 0 && <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No recommendations yet. Start the backend and seed the demo profiles to see matches.</p>}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">{matchedMentors.slice(0,2).map(m => <MentorCard key={m.mentor_id} mentor={m} onBook={bookSession}/>)}</div>
          <div className="glass mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl p-5 sm:flex-row"><div className="flex w-full items-center gap-3"><div className="shrink-0 rounded-xl bg-blue-50 p-3 text-blue-700"><UploadCloud size={22}/></div><div><h3 className="font-bold text-slate-900">Update your resume</h3><p className="text-xs leading-5 text-slate-500">Upload a PDF or DOCX (up to 10 MB). Extracted text is stored separately; the original file is not stored.</p></div></div><button disabled={resumeUploading} onClick={() => setActive("resume")} className="w-full shrink-0 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60 sm:w-auto">{resumeUploading ? "Reading resume…" : "Choose resume"}</button></div>
        </>}
        {active === "mentors" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Matches for {profile.name || "the selected graduate"}</p><button onClick={() => { setNotice(""); setRecommendationRevision((revision) => revision + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Sparkles size={16}/> Refresh matches</button></div>{recommendationsLoading && <p className="mb-4 text-sm text-slate-500">Loading recommendations…</p>}{recommendationError && <Notice message={recommendationError} kind="error" onDismiss={() => setRecommendationError("")} />}{!recommendationsLoading && !recommendationError && matchedMentors.length === 0 && <p className="mb-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500">No mentor matches are available for this profile yet.</p>}<div className="grid gap-4 xl:grid-cols-2">{matchedMentors.map(m => <MentorCard key={m.mentor_id} mentor={m} onBook={bookSession}/>)}</div></>}
        {active === "profile" && <form onSubmit={saveProfile} className="glass max-w-3xl rounded-2xl p-6"><h2 className="text-lg font-extrabold">{role === "Mentor" ? "Mentor profile" : "Professional profile"}</h2><p className="mt-1 text-sm text-slate-500">{canEditProfile ? "Your profile is saved to MentorMatch." : "Demo graduate profiles are shared and read-only. Register a graduate account to manage your own profile."}</p>{profileLoading && <p className="mt-3 text-sm text-blue-700">Loading saved profile…</p>}{role === "Graduate" && <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl bg-blue-50/80 p-4 sm:flex-row"><div><h3 className="text-sm font-bold text-slate-800">Resume</h3><p className="mt-1 text-xs leading-5 text-slate-600">Your extracted resume is stored separately from this profile and career goals. All three contribute to matching.</p></div><button type="button" disabled={resumeUploading} onClick={() => setActive("resume")} className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 disabled:opacity-60 sm:w-auto">{resumeUploading ? "Reading resume…" : "Update resume"}</button></div>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Full name<input required maxLength={120} value={profile.name} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600">Email<input required type="email" maxLength={255} value={profile.email} disabled className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 disabled:bg-slate-100"/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">WhatsApp phone number<input required type="tel" minLength={7} maxLength={32} pattern="\+[1-9][0-9 ()-]{6,29}" placeholder="+254 712 345 678" value={profile.phone_number || ""} onChange={updateProfileField("phone_number")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"/><span className="mt-1 block font-normal text-slate-500">Include your country code. Shared with the other participant after a session is accepted.</span></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">{role === "Mentor" ? "Expertise and professional experience" : "Education, career interest, and skills"}<textarea maxLength={20000} rows={5} value={profile.profile_text} onChange={updateProfileField("profile_text")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"/></label>{role === "Graduate" && <label className="text-xs font-bold text-slate-600 sm:col-span-2">Career goals<textarea maxLength={5000} rows={3} value={profile.career_goals} onChange={updateProfileField("career_goals")} disabled={!canEditProfile} className="mt-2 w-full rounded-xl border border-blue-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800"/></label>}</div><button disabled={!canEditProfile || profileSaving || profileLoading} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{profileSaving ? "Saving…" : "Save changes"}</button></form>}
        {active === "resume" && role === "Graduate" && <ResumePanel canManage={canManageAccount && !isDemoAccount} isDemoAccount={isDemoAccount} uploading={resumeUploading} resumeText={profile.resume_text} onUpload={uploadResume}/>}
        {active === "resume" && role === "Mentor" && <p className="rounded-xl bg-white/70 p-5 text-sm text-slate-500">Resume upload is available for graduate profiles. Update your expertise in My profile.</p>}
        {active === "goals" && <GoalsPanel goals={goals} loading={workspaceLoading} canManage={canManageAccount && role === "Graduate"} mentorView={role === "Mentor"} onCreate={createGoal} onUpdate={updateGoal} onStatus={updateGoalStatus} onShare={updateGoalSharing} onLink={updateGoalLink}/>}
        {active === "sessions" && <SessionsPanel role={role} userId={selectedAccountId} isDemoAccount={isDemoAccount} mentors={matchedMentors} slots={availability} sessions={sessions} canManage={canManageAccount} onAddAvailability={addAvailability} onRemoveAvailability={removeAvailability} onBook={bookSession} onStatus={updateSession} onOptOut={optOutMentee}/>}
        {active === "settings" && <PasswordChangePanel onNotice={(message, isError = false) => showNotice(message, isError ? "error" : "success")}/>}
        {active === "overview" && role === "Mentor" && <div className="space-y-5"><div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 p-7 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Mentor workspace</p><h2 className="mt-3 text-2xl font-black">Share your experience, on your schedule.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Set the times you can meet, review graduate requests, and keep your professional profile current.</p><button onClick={() => setActive("sessions")} className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-900">Manage availability</button></div><div className="grid gap-4 sm:grid-cols-2"><StatCard item={{label:"Upcoming availability",value:String(availability.length),note:"Open times graduates can request"}} icon={CalendarClock}/><StatCard item={{label:"Session requests",value:String(sessions.filter((item) => item.status === "pending").length),note:"Waiting for your response"}} icon={Users}/></div><div className="glass rounded-2xl p-6"><h2 className="text-lg font-extrabold">Next sessions</h2>{sessions.length === 0 ? <p className="mt-2 text-sm text-slate-500">No session requests yet. Add an opening so graduates can book time with you.</p> : <div className="mt-3 space-y-2">{sessions.slice(0, 3).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white/70 px-4 py-3 text-sm"><span className="font-semibold">{item.mentee_name} · {new Date(item.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span><span className="font-bold capitalize text-blue-700">{item.status}</span></div>)}</div>}</div></div>}
      </section>
    </div>
  </main>;
}
