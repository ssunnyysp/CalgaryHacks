import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from scipy.sparse import hstack, csr_matrix
import pickle

from features import add_manual_features, normalize_text

# Load data
data = pd.read_csv("training_data.csv")
data["text"] = data["text"].apply(normalize_text)

X = data["text"]
y = data["label"]

vectorizer = TfidfVectorizer(
    ngram_range=(1,3),
    stop_words="english",
    max_features=10000
)

X_vec = vectorizer.fit_transform(X)

manual = add_manual_features(X)
manual_sparse = csr_matrix(manual)

X_combined = hstack([X_vec, manual_sparse])

X_train, X_test, y_train, y_test = train_test_split(
    X_combined, y, test_size=0.1, random_state=42
)

model = LogisticRegression(
    max_iter=2000,
    class_weight="balanced"
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))
