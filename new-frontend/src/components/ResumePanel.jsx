import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import Notice from "./Notice";

const MAX_BYTES = 10 * 1024 * 1024;
export default function ResumePanel({ canManage, isDemoAccount = false, uploading, resumeText, onUpload }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const choose = (candidate) => {
    if (!candidate || !canManage || uploading) return;
    const extensionOk = /\.(pdf|docx)$/i.test(candidate.name);
    const mimeOk = !candidate.type || ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(candidate.type);
    if (!extensionOk || !mimeOk) { setError("Choose a PDF or DOCX file. Word documents saved as .doc are not supported."); setFile(null); if (input.current) input.current.value = ""; return; }
    if (candidate.size > MAX_BYTES) { setError("This file is larger than 10 MB. Choose a smaller resume and try again."); setFile(null); if (input.current) input.current.value = ""; return; }
    setError(""); setFile(candidate);
  };
  const browse = () => { if (input.current) { input.current.value = ""; input.current.click(); } };
  const removeFile = () => { setFile(null); setError(""); if (input.current) input.current.value = ""; };
  const submit = async () => { if (!file) return; const ok = await onUpload(file); if (ok) removeFile(); };
  return <section className="glass max-w-3xl rounded-2xl p-6">
    <h2 className="text-lg font-extrabold text-slate-900">Resume upload</h2><p className="mt-1 text-sm leading-6 text-slate-500">Upload a PDF or DOCX to add extracted text alongside your editable profile and career goals. The file itself is processed and discarded.</p>
    <div onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();choose(event.dataTransfer.files?.[0]);}} className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white/70 p-6 text-center"><UploadCloud size={32} className="text-blue-700"/><p className="mt-3 font-bold text-slate-800">Drop your resume here</p><p className="mt-1 text-xs text-slate-500">PDF or DOCX · maximum 10 MB</p><button type="button" disabled={!canManage || uploading} onClick={browse} className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{file ? "Choose a different file" : "Browse files"}</button><input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event)=>choose(event.target.files?.[0])}/></div>
    {!canManage && <Notice kind="warning" message={isDemoAccount
      ? "Demo graduate profiles are shared and read-only. Sign out and register a graduate account to upload your own resume."
      : "Resume uploads are available only on your own registered graduate account."}/>}
    {error && <Notice kind="error" message={error} onDismiss={() => setError("")}/>}
    {file && <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4"><div className="flex items-center gap-3"><FileText className="shrink-0 text-blue-700" size={20}/><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload</p></div></div><p className="mt-3 text-xs leading-5 text-slate-600">The extracted resume is stored separately and used alongside your profile text and career goals for matching.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={uploading || !canManage} onClick={submit} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{uploading ? "Extracting and saving…" : "Upload resume"}</button><button type="button" disabled={uploading || !canManage} onClick={browse} className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 disabled:opacity-50">Change file</button><button type="button" disabled={uploading || !canManage} onClick={removeFile} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">Remove</button></div></div>}
    {uploading && <p role="status" className="mt-3 text-sm text-blue-700">Reading your document. This can take a few seconds.</p>}
    {resumeText && <div className="mt-5 border-t border-blue-100 pt-4"><h3 className="text-sm font-bold text-slate-800">Extracted resume text</h3><p className="mt-1 text-xs text-slate-500">{resumeText.length.toLocaleString()} characters saved. Your resume text is separate from the editable profile and goals.</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{resumeText.slice(0, 500)}{resumeText.length > 500 ? "…" : ""}</p></div>}
  </section>;
}
