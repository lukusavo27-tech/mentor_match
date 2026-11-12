import fitz

def extract_text_from_pdf(content: bytes) -> str:
    """Extract selectable text from a PDF held in memory using PyMuPDF."""
    with fitz.open(stream=content, filetype="pdf") as document:
        return "\n".join(page.get_text("text") for page in document)
