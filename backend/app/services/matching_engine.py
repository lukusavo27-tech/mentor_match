from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.services.nlp_pipeline import NLPPipeline


class MatchingEngine:
    def __init__(self):
        self.pipeline = NLPPipeline()

    def rank_mentors(self, graduate_text: str, mentors: list[dict]) -> list[dict]:
        """Rank mentors and include the profile text used to produce each match."""
        if not mentors:
            return []

        graduate_text = graduate_text if isinstance(graduate_text, str) else ""
        mentor_texts = [
            mentor.get("text", "") if isinstance(mentor.get("text", ""), str) else ""
            for mentor in mentors
        ]

        grad_clean = self.pipeline.preprocess(graduate_text)
        mentor_clean = [self.pipeline.preprocess(text) for text in mentor_texts]
        corpus = [grad_clean, *mentor_clean]

        # Empty or punctuation-only profiles produce no TF-IDF vocabulary.
        # Return a complete result set with zero scores in that case.
        if any(cleaned.split() for cleaned in corpus):
            try:
                vectorizer = TfidfVectorizer()
                matrix = vectorizer.fit_transform(corpus)
                scores = cosine_similarity(matrix[0], matrix[1:])[0]
            except ValueError as error:
                if "empty vocabulary" not in str(error).lower():
                    raise
                scores = [0.0] * len(mentors)
        else:
            scores = [0.0] * len(mentors)

        grad_skills = set(self.pipeline.extract_skills(graduate_text))
        results = []
        for mentor, mentor_text, score in zip(mentors, mentor_texts, scores):
            shared = grad_skills & set(self.pipeline.extract_skills(mentor_text))
            results.append({
                "mentor_id": mentor.get("id"),
                "name": mentor.get("name", ""),
                "score": round(float(score), 3),
                "shared_skills": sorted(shared),
                "profile_text": mentor_text,
            })

        # Python's stable sort preserves input order for tied scores.
        return sorted(results, key=lambda result: result["score"], reverse=True)
