from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.resume import extract_text_from_pdf

router = APIRouter(prefix="/resumes", tags=["Resumes"])

@router.post("/extract-text")
async def extract_resume(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 5 MB or smaller.")
    try:
        text = extract_text_from_pdf(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF.")
    if not text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in this PDF.")
    return {"filename": file.filename, "extracted_text": text}
