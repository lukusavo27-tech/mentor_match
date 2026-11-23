import spacy
from spacy.matcher import PhraseMatcher
from app.services.skills_taxonomy import CAREER_ENTITIES, SKILLS


class NLPPipeline:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

        # alias -> canonical, e.g. "python developer" -> "backend engineering"
        self.alias_to_canonical = {}
        for canonical, aliases in SKILLS.items():
            for term in [canonical, *aliases]:
                self.alias_to_canonical[term.lower()] = canonical

        # PhraseMatcher finds multi-word phrases fast; attr="LOWER" ignores case
        self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        patterns = [self.nlp.make_doc(alias) for alias in self.alias_to_canonical]
        self.matcher.add("SKILL", patterns)

        # Add a small rule-based NER layer for career entities the base model
        # does not reliably identify, such as job titles and qualifications.
        ruler = self.nlp.add_pipe(
            "entity_ruler",
            after="ner",
            config={"overwrite_ents": True, "phrase_matcher_attr": "LOWER"},
        )
        skill_patterns = [
            {"label": "SKILL", "pattern": term}
            for canonical, aliases in SKILLS.items()
            for term in [canonical, *aliases]
        ]
        career_patterns = [
            {"label": label, "pattern": phrase}
            for label, phrases in CAREER_ENTITIES.items()
            for phrase in phrases
        ]
        disabled_pipes = [
            name for name in self.nlp.pipe_names if name != "entity_ruler"
        ]
        with self.nlp.select_pipes(disable=disabled_pipes):
            ruler.add_patterns(skill_patterns + career_patterns)

    def _extract_skills_from_doc(self, doc) -> list[str]:
        found = set()
        for _, start, end in self.matcher(doc):
            alias = doc[start:end].text.lower()
            found.add(self.alias_to_canonical[alias])
        return sorted(found)

    def extract_skills(self, text: str) -> list[str]:
        return self._extract_skills_from_doc(self.nlp(text))

    def extract_entities(self, text: str) -> list[dict[str, str]]:
        """Return rule-based career entities recognized in the text."""
        doc = self.nlp(text)
        career_labels = {"SKILL", *CAREER_ENTITIES.keys()}
        return [
            {"text": entity.text, "label": entity.label_}
            for entity in doc.ents
            if entity.label_ in career_labels
        ]

    def preprocess(self, text: str) -> str:
        """Turn raw text into a clean string ready for TF-IDF."""
        doc = self.nlp(text)

        # 1. canonical skills, joined with underscores so "machine learning"
        #    stays ONE token for the vectorizer
        skills = [s.replace(" ", "_") for s in self._extract_skills_from_doc(doc)]

        # 2. retain job title, industry, and qualification entities as phrases
        career_entities = [
            f"{entity.label_.lower()}_{'_'.join(entity.text.lower().split())}"
            for entity in doc.ents
            if entity.label_ in CAREER_ENTITIES
        ]

        # 3. tokenize + remove stop words + lemmatize, keep nouns/proper nouns
        lemmas = [
            t.lemma_.lower() for t in doc
            if t.pos_ in {"NOUN", "PROPN"} and not t.is_stop
            and t.is_alpha and len(t.text) > 2
        ]

        # Give curated skills and career entities more weight than generic words.
        return " ".join(skills * 2 + career_entities * 2 + lemmas)
