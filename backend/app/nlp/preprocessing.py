def extract_career_terms(text: str) -> list[str]:
    """Placeholder for spaCy tokenization/NER and career-term extraction.

    Load a suitable spaCy English model and add domain-specific skill/entity
    handling here. Do not treat generic PERSON/ORG entities as skills without
    validation.
    """
    # TODO: implement with spaCy and a curated skills vocabulary.
    return [term.strip() for term in text.split(",") if term.strip()]
