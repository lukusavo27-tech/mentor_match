import asyncio
import unittest
from io import BytesIO
from tempfile import SpooledTemporaryFile

from docx import Document
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import create_user, upload_resume
from app.services.resume_extractor import MAX_RESUME_BYTES
from app.schemas import UserCreate


class ResumeUploadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, autoflush=False)()
        self.user = create_user(
            UserCreate(
                name="Resume Test",
                email="resume@example.test",
                role="graduate",
                profile_text="Old profile text",
                career_goals="Become a data engineer",
            ),
            self.db,
        )

    def tearDown(self) -> None:
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    @staticmethod
    def make_docx(text: str) -> bytes:
        document = Document()
        document.add_paragraph(text)
        buffer = BytesIO()
        document.save(buffer)
        return buffer.getvalue()

    @staticmethod
    def make_upload(content: bytes, filename: str) -> UploadFile:
        file = SpooledTemporaryFile()
        file.write(content)
        file.seek(0)
        return UploadFile(file=file, filename=filename)

    def test_docx_upload_replaces_profile_text_and_keeps_goals(self) -> None:
        upload = self.make_upload(
            self.make_docx("Python engineer with SQL experience"), "resume.docx"
        )
        result = asyncio.run(upload_resume(self.user.id, upload, self.db))

        self.assertEqual(result.profile_text, "Python engineer with SQL experience")
        self.assertEqual(result.career_goals, "Become a data engineer")

    def test_upload_rejects_files_over_10mb(self) -> None:
        upload = self.make_upload(b"x" * (MAX_RESUME_BYTES + 1), "resume.pdf")

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(upload_resume(self.user.id, upload, self.db))

        self.assertEqual(raised.exception.status_code, 413)

    def test_upload_rejects_unsupported_file_type(self) -> None:
        upload = self.make_upload(b"not a resume", "resume.txt")

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(upload_resume(self.user.id, upload, self.db))

        self.assertEqual(raised.exception.status_code, 422)
