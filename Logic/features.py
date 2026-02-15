import numpy as np

def add_manual_features(texts):
    features = []
    for text in texts:
        t = text.lower()
        features.append([
            int("either" in t and "or" in t),
            int("you are" in t or "you're" in t or "you'd" in t),
            int("if " in t and " will " in t),
            int("so you" in t)
        ])
    return np.array(features, dtype=np.float64)
