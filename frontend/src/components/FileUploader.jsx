import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ErrorMessage, SuccessMessage } from "./Feedback";

export default function FileUploader({ fileName, onFileSelected, acceptedTypes = ".pdf,.txt,application/pdf,text/plain" }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const chooseFile = file => {
    if (!file) return;
    const valid = file.type === "application/pdf" || file.type === "text/plain" || /\.(pdf|txt)$/i.test(file.name);
    if (!valid) { setError("Choose a PDF or plain text file."); return; }
    setError(""); onFileSelected(file);
  };
  return <div><div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }} className="flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white/70 p-6 text-center"><UploadCloud size={34} className="text-blue-700"/><p className="mt-3 font-bold">Drag and drop your resume here</p><p className="mt-1 text-xs text-slate-500">PDF or TXT</p><button type="button" onClick={() => inputRef.current?.click()} className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">{fileName ? "Replace file" : "Browse files"}</button><input ref={inputRef} type="file" accept={acceptedTypes} className="sr-only" onChange={event => chooseFile(event.target.files?.[0])}/></div><div className="mt-3"><ErrorMessage>{error}</ErrorMessage></div>{fileName && <SuccessMessage>{fileName} is selected and ready to upload.</SuccessMessage>}</div>;
}
