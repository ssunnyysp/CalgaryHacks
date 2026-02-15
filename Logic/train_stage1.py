import pandas as pd
import pickle
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from features import normalize_text, add_manual_features
from sklearn.svm import LinearSVC

data = pd.read_csv("training_data.csv")
data["binary_label"] = data["label"].apply(lambda x: "no_fallacy" if x=="no_fallacy" else "fallacy")
X_text = data["text"].apply(normalize_text)
y = data["binary_label"]

vectorizer = TfidfVectorizer(
    ngram_range=(1,3),
    stop_words=None,
    max_features=15000,
    sublinear_tf=True,
    min_df=2
)

X_tfidf = vectorizer.fit_transform(X_text)

X_manual = add_manual_features(X_text.tolist())
X_manual_sparse = csr_matrix(X_manual)
X = hstack([X_tfidf, X_manual_sparse])

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = LinearSVC(class_weight="balanced")
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))

pickle.dump(model, open("stage1_model.pkl", "wb"))
pickle.dump(vectorizer, open("stage1_vectorizer.pkl", "wb"))
