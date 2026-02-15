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
        features.append([
            int("you" in text),
            int("always" in text or "never" in text),
            int("everyone" in text or "nobody" in text),
            int("if" in text and "then" in text),
            int("because" in text),
            len(text.split())
        ])

    return np.array(features)
