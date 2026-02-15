import os
import pickle
import numpy as np
from scipy.sparse import hstack, csr_matrix

# Labels used in your training_data.csv / train.py
FALLACY_INFO = {
    "ad_hominem": {
        "title": "Ad Hominem",
        "explanation": "Attacks the person making the argument instead of addressing the argument itself.",
        "prompt": "What evidence supports or refutes the claim independently of the speaker?",
    },
    "strawman": {
        "title": "Strawman",
        "explanation": "Misrepresents an opposing argument to make it easier to attack.",
        "prompt": "Is this responding to the original argument or a distorted version of it?",
    },
    "slippery_slope": {
        "title": "Slippery Slope",
        "explanation": "Assumes a small step will inevitably lead to extreme consequences without sufficient evidence.",
        "prompt": "What evidence shows this chain of events must occur?",
    },
    "false_dilemma": {
        "title": "False Dilemma",
        "explanation": "Presents only two options when more possibilities exist.",
        "prompt": "Are there reasonable alternatives being ignored?",
    },
    "no_fallacy": {
        "title": "No obvious fallacy",
        "explanation": "No obvious logical fallacy detected by the model.",
        "prompt": "What assumptions does this argument rely on?",
    },
}

def add_manual_features(texts):
    # Must match train.py exactly
    features = []
    for text in texts:
        t = (text or "").lower()
        features.append([
            int("either" in t),
            int("you are" in t or "you're" in t),
            int("if " in t and " will " in t),
            int("so you" in t),
        ])
    return np.array(features, dtype=np.float64)

# Load model + vectorizer once
_HERE = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_HERE, "model.pkl")
_VECT_PATH = os.path.join(_HERE, "vectorizer.pkl")

with open(_MODEL_PATH, "rb") as f:
    model = pickle.load(f)

with open(_VECT_PATH, "rb") as f:
    vectorizer = pickle.load(f)

def detect_fallacy(text: str):
    """
    Returns:
      {
        "fallacy": <label>,
        "confidence": <0..1>,
        "title": <human name>,
        "explanation": <string>,
        "prompt": <string>
      }
    """
    text = (text or "").strip()
    if not text:
        info = FALLACY_INFO["no_fallacy"]
        return {
            "fallacy": "no_fallacy",
            "confidence": 0.0,
            "title": info["title"],
            "explanation": info["explanation"],
            "prompt": info["prompt"],
        }

    X_tfidf = vectorizer.transform([text])
    manual = add_manual_features([text])
    manual_sparse = csr_matrix(manual)
    X_combined = hstack([X_tfidf, manual_sparse])

    pred = model.predict(X_combined)[0]
    # predict_proba may not exist for some models, but yours does (LogReg)
    proba = float(model.predict_proba(X_combined).max())

    info = FALLACY_INFO.get(pred, FALLACY_INFO["no_fallacy"])
    return {
        "fallacy": pred,
        "confidence": round(proba, 2),
        "title": info["title"],
        "explanation": info["explanation"],
        "prompt": info["prompt"],
    }
