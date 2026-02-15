import os
import pickle
import numpy as np
from scipy.sparse import hstack, csr_matrix

# ✅ CRITICAL: use the exact same functions as training
from features import normalize_text, add_manual_features


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

# --- Load model + vectorizer from same folder as this file ---
_HERE = os.path.dirname(os.path.abspath(__file__))

def _load(filename):
    path = os.path.join(_HERE, filename)
    with open(path, "rb") as f:
        return pickle.load(f)

model = _load("model.pkl")
vectorizer = _load("vectorizer.pkl")
print("[fallacy_detector] Single-stage model loaded.")


def _get_confidence(model, X):
    if hasattr(model, "predict_proba"):
        return float(model.predict_proba(X).max())
    return 1.0


def _build_features(texts):
    # IMPORTANT: must match train.py:
    # X = hstack([X_tfidf, csr_matrix(add_manual_features(...))])
    X_tfidf = vectorizer.transform(texts)
    X_manual = add_manual_features(texts)
    X_manual_sparse = csr_matrix(X_manual)
    return hstack([X_tfidf, X_manual_sparse])


def detect_fallacy(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        info = FALLACY_INFO["no_fallacy"]
        return {
            "fallacy": "no_fallacy",
            "confidence": 0.0,
            "title": info["title"],
            "explanation": info["explanation"],
            "prompt": info["prompt"],
            "sentence": text,
        }

    # ✅ match training normalization exactly
    text_norm = normalize_text(text)

    X = _build_features([text_norm])
    pred = model.predict(X)[0]
    conf = _get_confidence(model, X)

    info = FALLACY_INFO.get(pred, FALLACY_INFO["no_fallacy"])
    return {
        "fallacy": pred,
        "confidence": conf,
        "title": info["title"],
        "explanation": info["explanation"],
        "prompt": info["prompt"],
        "sentence": text,
    }
