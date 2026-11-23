from io import BytesIO
from pathlib import Path

MAX_RESUME_BYTES = 10 * 1024 * 1024
MAX_PROFILE_TEXT_LENGTH = 20_000


class ResumeExtractionError(ValueError):
    """Raised when a resume format is unsupported or contains no usable text."""


def extract_resume_text(filename: str, content: bytes) -> str:
    """Extract bounded plain text from a PDF or DOCX resume."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        text = _extract_pdf(content)
    elif suffix == ".docx":
        text = _extract_docx(content)
    else:
        raise ResumeExtractionError("Upload a PDF or DOCX resume")

    normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if not normalized:
        raise ResumeExtractionError("No readable text was found in the resume")
    return normalized[:MAX_PROFILE_TEXT_LENGTH]


def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted:
            raise ResumeExtractionError("Password-protected PDFs are not supported")
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except ResumeExtractionError:
        raise
    except Exception as error:
        raise ResumeExtractionError("The PDF could not be read") from error


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document

        document = Document(BytesIO(content))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        for table in document.tables:
            paragraphs.extend(
                cell.text for row in table.rows for cell in row.cells
            )
        return "\n".join(paragraphs)
    except Exception as error:
        raise ResumeExtractionError("The DOCX file could not be read") from error
