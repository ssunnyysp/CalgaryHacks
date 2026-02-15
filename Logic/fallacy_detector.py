import pickle
import re

model = pickle.load(open("model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

def normalize_text(text):
    text = text.lower()
    return text

def detect_fallacy(text):
    X_tfidf = vectorizer.transform([text])
    manual = add_manual_features([text])

    from scipy.sparse import hstack
    X_combined = hstack([X_tfidf, manual])

    prediction = model.predict(X_combined)[0]
    confidence = model.predict_proba(X_combined).max()

    return {
        "fallacy": prediction,
        "confidence": round(float(confidence), 2)
    }
