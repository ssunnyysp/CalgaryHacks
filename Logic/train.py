import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from scipy.sparse import hstack, csr_matrix
import pickle

def add_manual_features(texts):
    features = []
    for text in texts:
        t = text.lower()
        features.append([
            int("either" in t),
            int("you are" in t or "you're" in t),
            int("if " in t and " will " in t),
            int("so you" in t)
        ])
    return np.array(features, dtype=np.float64)

data = pd.read_csv("training_data.csv")
X = data["text"]
y = data["label"]

vectorizer = TfidfVectorizer(ngram_range=(1,3), stop_words="english", max_features=10000)
X_vec = vectorizer.fit_transform(X)

manual_features = add_manual_features(X)
manual_features_sparse = csr_matrix(manual_features)
X_combined = hstack([X_vec, manual_features_sparse])

X_train, X_test, y_train, y_test = train_test_split(X_combined, y, test_size=0.1, random_state=42)

model = LogisticRegression(max_iter=2000, class_weight="balanced")
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))

def detect_fallacy(text):
    X_tfidf = vectorizer.transform([text])
    manual = add_manual_features([text])
    manual_sparse = csr_matrix(manual)
    X_combined = hstack([X_tfidf, manual_sparse])
    prediction = model.predict(X_combined)[0]
    confidence = model.predict_proba(X_combined).max()
    return {"fallacy": prediction, "confidence": round(float(confidence), 2)}
