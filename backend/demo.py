from app.services.matching_engine import MatchingEngine

engine = MatchingEngine()

graduate = """Recent computer science graduate. Built REST APIs using Python and Flask,
worked with PostgreSQL databases, interested in machine learning and data analysis."""

mentors = [
    {"id": 1, "name": "Amina (Backend Lead)",
     "text": "Senior backend engineer with 10 years building APIs in Python and Django, strong SQL and cloud experience on AWS."},
    {"id": 2, "name": "Brian (Marketing)",
     "text": "Marketing consultant specialising in digital marketing, SEO and brand strategy."},
    {"id": 3, "name": "Carol (Data Scientist)",
     "text": "Data scientist focused on machine learning, predictive modeling and data analytics, mentoring early-career analysts."},
]

for r in engine.rank_mentors(graduate, mentors):
    print(r)