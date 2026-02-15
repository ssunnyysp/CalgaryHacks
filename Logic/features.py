import numpy as np
import re

def normalize_text(text):
    text = text.lower()
    return text

def add_manual_features(texts):
    features = []
    for text in texts:
        t = normalize_text(text)
        features.append([
            int("either" in t),
            int("you are" in t or "you're" in t),
            int("if " in t and " will " in t),
            int("so you" in t)
        ])
    return np.array(features, dtype=np.float64)
