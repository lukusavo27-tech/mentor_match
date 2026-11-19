import { useState } from "react";
import FormField from "./FormField";
import { NotificationArea } from "./Feedback";

export default function ProfileEditor({ title, fields, initialValues = {}, saveLabel = "Save profile" }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  return <section className="glass max-w-4xl rounded-2xl p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">{title}</h2><p className="mt-1 text-sm text-slate-500">Keep your information current to improve your mentorship experience.</p></div><button type="button" onClick={()=>{setEditing(value=>!value);setSaved("");}} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">{editing?"Cancel":"Edit profile"}</button></div><form onSubmit={event=>{event.preventDefault();setEditing(false);setSaved("Your profile changes are saved in this demo. Backend persistence will be connected later.");}}><div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map(field=><FormField key={field.id} {...field} defaultValue={initialValues[field.id] || field.defaultValue || ""} readOnly={!editing} className={field.multiline?"sm:col-span-2":""} as={field.multiline?"textarea":"input"}/>)}</div><div className="mt-5 flex items-center gap-3">{editing&&<button className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">{saveLabel}</button>}<NotificationArea onDismiss={()=>setSaved("")}>{saved}</NotificationArea></div></form></section>;
}
