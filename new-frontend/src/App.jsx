import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<Dashboard/>}/>
    <Route path="/register" element={<Dashboard/>}/>
    <Route path="/dashboard" element={<Dashboard/>}/>
    <Route path="/admin" element={<Dashboard adminRoute/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
