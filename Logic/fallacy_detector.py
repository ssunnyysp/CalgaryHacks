import pickle
from scipy.sparse import hstack, csr_matrix

from features import add_manual_features, normalize_text

model = pickle.load(open("model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

def detect_fallacy(text):
    text = normalize_text(text)

    X_tfidf = vectorizer.transform([text])
    manual = add_manual_features([text])
    manual_sparse = csr_matrix(manual)

    X_combined = hstack([X_tfidf, manual_sparse])

    prediction = model.predict(X_combined)[0]
    confidence = model.predict_proba(X_combined).max()

    if confidence < 0.55 or prediction == "no_fallacy":
        return {"fallacy": None, "confidence": round(float(confidence), 2)}

    return {
        "fallacy": prediction,
        "confidence": round(float(confidence), 2)
    }
