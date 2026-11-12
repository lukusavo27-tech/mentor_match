from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

# Small demonstration corpus. Replace with mentor profiles loaded from PostgreSQL.
DEMO_MENTORS = [
    {
        "id": 1, "name": "Grace Wanjiku", "role": "Senior Software Engineer",
        "company": "Safaricom", "expertise": "software engineering python cloud APIs backend distributed systems",
        "experience": "9 years"
    },
    {
        "id": 2, "name": "David Mwangi", "role": "Data and AI Lead",
        "company": "Andela", "expertise": "machine learning artificial intelligence python data science analytics NLP",
        "experience": "7 years"
    },
    {
        "id": 3, "name": "Amina Hassan", "role": "Product Manager",
        "company": "M-KOPA", "expertise": "product management UX research product strategy agile leadership",
        "experience": "8 years"
    },
]

def preprocess(text: str) -> str:
    """Basic baseline cleanup. A spaCy pipeline can replace/extend this step."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#. ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def recommend_mentors(profile_text: str) -> list[dict]:
    """Return TF-IDF/cosine similarity scores against the demo mentor corpus."""
    documents = [preprocess(profile_text)] + [
        preprocess(mentor["expertise"]) for mentor in DEMO_MENTORS
    ]
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(documents)
    scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    ranked = []
    for mentor, score in zip(DEMO_MENTORS, scores):
        ranked.append({
            **mentor,
            "score": round(float(score) * 100, 2),
            "score_is_demo_baseline": True
        })
    return sorted(ranked, key=lambda item: item["score"], reverse=True)
