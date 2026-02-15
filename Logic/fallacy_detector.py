from scipy.sparse import hstack, csr_matrix
from features import normalize_text, add_manual_features
import pickle

# Load models and vectorizers
stage1_model = pickle.load(open("stage1_model.pkl", "rb"))
stage1_vectorizer = pickle.load(open("stage1_vectorizer.pkl", "rb"))
stage2_model = pickle.load(open("model.pkl", "rb"))
stage2_vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

def detect_fallacy(text):
    text_norm = normalize_text(text)
    
    # Stage 1
    X_stage1_tfidf = stage1_vectorizer.transform([text_norm])
    X_stage1_manual = csr_matrix(add_manual_features([text_norm]))
    X_stage1 = hstack([X_stage1_tfidf, X_stage1_manual])
    
    stage1_pred = stage1_model.predict(X_stage1)[0]
    stage1_conf = 1.0  # LinearSVC has no predict_proba
    
    if stage1_pred == "no_fallacy":
        return {"sentence": text, "fallacy": "no_fallacy", "confidence": stage1_conf}
    
    # Stage 2
    X_stage2_tfidf = stage2_vectorizer.transform([text_norm])
    X_stage2_manual = csr_matrix(add_manual_features([text_norm]))
    X_stage2 = hstack([X_stage2_tfidf, X_stage2_manual])
    
    stage2_pred = stage2_model.predict(X_stage2)[0]
    stage2_conf = 1.0  # Assuming stage2 model might also be LinearSVC
    
    return {"sentence": text, "fallacy": stage2_pred, "confidence": stage2_conf}
