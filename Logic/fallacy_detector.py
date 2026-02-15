import pickle
import os
from scipy.sparse import hstack, csr_matrix
from features import normalize_text, add_manual_features

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

stage1_model = pickle.load(open(os.path.join(SCRIPT_DIR, "stage1_model.pkl"), "rb"))
stage1_vectorizer = pickle.load(open(os.path.join(SCRIPT_DIR, "stage1_vectorizer.pkl"), "rb"))
stage2_model = pickle.load(open(os.path.join(SCRIPT_DIR, "model.pkl"), "rb"))
stage2_vectorizer = pickle.load(open(os.path.join(SCRIPT_DIR, "vectorizer.pkl"), "rb"))

def detect_fallacy(text):
    text_norm = normalize_text(text)
    X_stage1_tfidf = stage1_vectorizer.transform([text_norm])
    X_stage1_manual = csr_matrix(add_manual_features([text_norm]))
    X_stage1 = hstack([X_stage1_tfidf, X_stage1_manual])
    
    stage1_pred = stage1_model.predict(X_stage1)[0]
    stage1_conf = stage1_model.predict_proba(X_stage1).max()
    
    if stage1_pred == "no_fallacy":
        return {"sentence": text, "fallacy": "no_fallacy", "confidence": round(float(stage1_conf), 2)}
    
    X_stage2_tfidf = stage2_vectorizer.transform([text_norm])
    X_stage2_manual = csr_matrix(add_manual_features([text_norm]))
    X_stage2 = hstack([X_stage2_tfidf, X_stage2_manual])
    
    stage2_pred = stage2_model.predict(X_stage2)[0]
    stage2_conf = stage2_model.predict_proba(X_stage2).max()
    
    return {"sentence": text, "fallacy": stage2_pred, "confidence": round(float(stage2_conf), 2)}
