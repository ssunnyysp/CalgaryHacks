import pickle
import re

model = pickle.load(open("model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

def normalize_text(text):
    text = text.lower()
    text = re.sub(r"[^a-z\s]", "", text)
    return text

def detect_fallacy(text):
    text = normalize_text(text)
    X = vectorizer.transform([text])

    prediction = model.predict(X)[0]
    confidence = model.predict_proba(X).max()

    if confidence < 0.55 or prediction == "none":
        return {"fallacy": None, "confidence": confidence}

    return {
        "fallacy": prediction,
        "confidence": round(float(confidence), 2)
    }
