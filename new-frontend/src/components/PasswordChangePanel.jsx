import { useState } from "react";
import api from "../services/api";

export default function PasswordChangePanel({ onNotice }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      onNotice("The new passwords do not match.", true);
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/auth/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onNotice(data.detail || "Password changed successfully.");
    } catch (error) {
      const detail = error.response?.data?.detail;
      onNotice(typeof detail === "string" ? detail : "Could not change your password.", true);
    } finally {
      setSaving(false);
    }
  };

  return <section className="glass max-w-2xl rounded-2xl p-6">
    <h2 className="text-lg font-extrabold text-slate-900">Change my password</h2>
    <p className="mt-1 text-sm text-slate-500">Enter your current password and choose a new password with at least 10 characters.</p>
    <form onSubmit={changePassword} className="mt-5 space-y-4">
      <label className="block text-xs font-bold text-slate-600">Current password
        <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800" />
      </label>
      <label className="block text-xs font-bold text-slate-600">New password
        <input required minLength={10} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800" />
      </label>
      <label className="block text-xs font-bold text-slate-600">Confirm new password
        <input required minLength={10} maxLength={128} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-medium text-slate-800" />
      </label>
      <button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Update password"}</button>
    </form>
  </section>;
}
