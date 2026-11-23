import unittest

from app.services.matching_engine import MatchingEngine


EVALUATION_CASES = [
    {
        "graduate_text": (
            "Recent graduate interested in Python APIs and PostgreSQL databases."
        ),
        "mentors": [
            {
                "id": "marketing",
                "name": "Marketing Mentor",
                "text": "Digital marketing specialist focused on SEO and brand strategy.",
            },
            {
                "id": "backend",
                "name": "Backend Mentor",
                "text": "Backend engineer building Python APIs with PostgreSQL.",
            },
            {
                "id": "finance",
                "name": "Finance Mentor",
                "text": "Financial analyst focused on accounting and financial modeling.",
            },
        ],
        "relevant_ids": {"backend"},
    },
    {
        "graduate_text": (
            "Graduate interested in machine learning, predictive modeling, and analytics."
        ),
        "mentors": [
            {
                "id": "frontend",
                "name": "Frontend Mentor",
                "text": "Frontend developer building React and JavaScript applications.",
            },
            {
                "id": "data",
                "name": "Data Mentor",
                "text": "Data scientist using machine learning and predictive modeling.",
            },
            {
                "id": "finance",
                "name": "Finance Mentor",
                "text": "Financial analyst focused on accounting and budgeting.",
            },
        ],
        "relevant_ids": {"data"},
    },
    {
        "graduate_text": (
            "Graduate seeking digital marketing mentorship in SEO and brand strategy."
        ),
        "mentors": [
            {
                "id": "backend",
                "name": "Backend Mentor",
                "text": "Backend engineer building Python APIs with PostgreSQL.",
            },
            {
                "id": "marketing",
                "name": "Marketing Mentor",
                "text": "Marketing consultant with SEO, digital campaigns, and brand strategy experience.",
            },
            {
                "id": "data",
                "name": "Data Mentor",
                "text": "Data analyst focused on analytics and business intelligence.",
            },
        ],
        "relevant_ids": {"marketing"},
    },
    {
        "graduate_text": (
            "Recent graduate interested in finance, accounting, and financial analysis."
        ),
        "mentors": [
            {
                "id": "marketing",
                "name": "Marketing Mentor",
                "text": "Digital marketing specialist focused on SEO and brand strategy.",
            },
            {
                "id": "finance",
                "name": "Finance Mentor",
                "text": "Financial analyst with accounting and financial modeling experience.",
            },
            {
                "id": "backend",
                "name": "Backend Mentor",
                "text": "Backend engineer building Python APIs with PostgreSQL.",
            },
        ],
        "relevant_ids": {"finance"},
    },
]


def precision_recall_f1_at_k(engine: MatchingEngine, cases: list[dict], k: int = 1):
    precision_scores = []
    recall_scores = []
    f1_scores = []

    for case in cases:
        ranked = engine.rank_mentors(case["graduate_text"], case["mentors"])
        retrieved = {str(item["mentor_id"]) for item in ranked[:k]}
        relevant = {str(mentor_id) for mentor_id in case["relevant_ids"]}
        hits = len(retrieved & relevant)

        precision = hits / len(retrieved) if retrieved else 0.0
        recall = hits / len(relevant) if relevant else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )
        precision_scores.append(precision)
        recall_scores.append(recall)
        f1_scores.append(f1)

    count = len(cases)
    return {
        "precision_at_k": sum(precision_scores) / count,
        "recall_at_k": sum(recall_scores) / count,
        "f1_at_k": sum(f1_scores) / count,
    }


class MatchingEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = MatchingEngine()

    def test_curated_profiles_meet_top_one_relevance_target(self) -> None:
        metrics = precision_recall_f1_at_k(self.engine, EVALUATION_CASES, k=1)

        self.assertGreaterEqual(metrics["precision_at_k"], 0.75, metrics)
        self.assertGreaterEqual(metrics["recall_at_k"], 0.75, metrics)
        self.assertGreaterEqual(metrics["f1_at_k"], 0.75, metrics)

    def test_rule_based_entities_extract_career_information(self) -> None:
        entities = self.engine.pipeline.extract_entities(
            "Data scientist in fintech with a Master of Science degree and Python skills."
        )
        labels = {entity["label"] for entity in entities}

        self.assertIn("JOB_TITLE", labels)
        self.assertIn("INDUSTRY", labels)
        self.assertIn("QUALIFICATION", labels)
        self.assertIn("SKILL", labels)


if __name__ == "__main__":
    unittest.main()
