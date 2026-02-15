import pickle
from features import add_manual_features
from scipy.sparse import hstack

stage1_model = pickle.load(open('stage1_model.pkl', 'rb'))
stage1_vectorizer = pickle.load(open('stage1_vectorizer.pkl', 'rb'))
stage2_model = pickle.load(open('stage2_model.pkl', 'rb'))
stage2_vectorizer = pickle.load(open('stage2_vectorizer.pkl', 'rb'))

def normalize_text(text):
    return text.lower()

def detect_fallacy(text):
    text_norm = normalize_text(text)

    X_tfidf1 = stage1_vectorizer.transform([text_norm])
    manual1 = add_manual_features([text_norm])
    X_combined1 = hstack([X_tfidf1, manual1])
    stage1_pred = stage1_model.predict(X_combined1)[0]

    if stage1_pred == 'no_fallacy':
        return {"sentence": text, "fallacy": "no_fallacy", "confidence": float(stage1_model.predict_proba(X_combined1).max())}
    else:
        X_tfidf2 = stage2_vectorizer.transform([text_norm])
        manual2 = add_manual_features([text_norm])
        X_combined2 = hstack([X_tfidf2, manual2])
        fallacy = stage2_model.predict(X_combined2)[0]
        confidence = float(stage2_model.predict_proba(X_combined2).max())
        return {"sentence": text, "fallacy": fallacy, "confidence": confidence}
