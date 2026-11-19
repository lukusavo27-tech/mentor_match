import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import DashboardLayout from "./components/DashboardLayout";
import MenteeDashboardPage from "./pages/MenteeDashboardPage";
import MenteeProfilePage from "./pages/MenteeProfilePage";
import ResumeUploadPage from "./pages/ResumeUploadPage";
import MentorRecommendationsPage from "./pages/MentorRecommendationsPage";
import MentorProfilePage from "./pages/MentorProfilePage";
import SchedulingPage from "./pages/SchedulingPage";
import MenteeSettingsPage from "./pages/MenteeSettingsPage";
import MentorDashboardPage from "./pages/MentorDashboardPage";
import MentorProfileEditPage from "./pages/MentorProfileEditPage";
import MentorAvailabilityPage from "./pages/MentorAvailabilityPage";
import MentorSettingsPage from "./pages/MentorSettingsPage";
import AdministratorDashboardPage from "./pages/AdministratorDashboardPage";
import UserManagementPage from "./pages/UserManagementPage";
import ActivityMonitoringPage from "./pages/ActivityMonitoringPage";
import GoalsPage from "./pages/GoalsPage";

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/register" element={<RegistrationPage/>}/>
    <Route element={<DashboardLayout/>}>
      <Route path="/mentee/dashboard" element={<MenteeDashboardPage/>}/>
      <Route path="/mentee/profile" element={<MenteeProfilePage/>}/>
      <Route path="/mentee/resume" element={<ResumeUploadPage/>}/>
      <Route path="/mentee/recommendations" element={<MentorRecommendationsPage/>}/>
      <Route path="/mentee/mentors/:mentorId" element={<MentorProfilePage/>}/>
      <Route path="/mentee/schedule/:mentorId?" element={<SchedulingPage/>}/>
      <Route path="/mentee/goals" element={<GoalsPage/>}/>
      <Route path="/mentee/settings" element={<MenteeSettingsPage/>}/>
      <Route path="/mentor/dashboard" element={<MentorDashboardPage/>}/>
      <Route path="/mentor/profile" element={<MentorProfileEditPage/>}/>
      <Route path="/mentor/availability" element={<MentorAvailabilityPage/>}/>
      <Route path="/mentor/goals" element={<GoalsPage mentorView/>}/>
      <Route path="/mentor/settings" element={<MentorSettingsPage/>}/>
      <Route path="/admin/dashboard" element={<AdministratorDashboardPage/>}/>
      <Route path="/admin/users" element={<UserManagementPage/>}/>
      <Route path="/admin/activity" element={<ActivityMonitoringPage/>}/>
    </Route>
    <Route path="/dashboard" element={<Navigate to="/mentee/dashboard" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
