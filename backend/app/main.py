from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import health, profiles, matching, resumes

app = FastAPI(
    title="MentorMatch API",
    description="API for an NLP-based graduate mentor matching platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(matching.router, prefix="/api")
app.include_router(resumes.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "MentorMatch API is running", "docs": "/docs"}
