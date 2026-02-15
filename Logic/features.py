import re
import numpy as np

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"[^a-z\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def add_manual_features(texts):
    features = []
    for text in texts:
        t = text.lower()
        features.append([
            int("either" in t and "or" in t),
            int("if" in t and ("then" in t or "eventually" in t or "soon" in t)),
            int("so you" in t or "so you're" in t),
            int("you clearly" in t or "you obviously" in t),
            int("only a" in t or "typical" in t),
            len(t.split())
        ])
    return np.array(features, dtype=np.float64)

