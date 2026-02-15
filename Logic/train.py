import pandas as pd
import pickle
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from features import normalize_text, add_manual_features

# Load data
data = pd.read_csv("training_data.csv")

X_text = data["text"].apply(normalize_text)
y = data["label"]

# TF-IDF
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),
    stop_words="english",
    max_features=5000
)

X_tfidf = vectorizer.fit_transform(X_text)

# Manual features
X_manual = add_manual_features(X_text.tolist())
X_manual_sparse = csr_matrix(X_manual)

# Combine
X = hstack([X_tfidf, X_manual_sparse])

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = LogisticRegression(max_iter=1000, class_weight="balanced")
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

# Save
pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))