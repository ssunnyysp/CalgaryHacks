import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from scipy.sparse import hstack, csr_matrix
import pickle
from features import add_manual_features

splits = {
    'train': 'data/train-00000-of-00001-8c3d4e48fe0f561b.parquet',
    'dev': 'data/dev-00000-of-00001-99b3373cde156b17.parquet'
}

train_df = pd.read_parquet("hf://datasets/tasksource/logical-fallacy/" + splits['train'])
dev_df = pd.read_parquet("hf://datasets/tasksource/logical-fallacy/" + splits['dev'])

X_train = train_df['text']
y_train = train_df['label']
X_dev = dev_df['text']
y_dev = dev_df['label']

vectorizer = TfidfVectorizer(ngram_range=(1,3), stop_words='english', max_features=15000)
X_train_vec = vectorizer.fit_transform(X_train)
X_dev_vec = vectorizer.transform(X_dev)

manual_train = csr_matrix(add_manual_features(X_train))
manual_dev = csr_matrix(add_manual_features(X_dev))

X_train_combined = hstack([X_train_vec, manual_train])
X_dev_combined = hstack([X_dev_vec, manual_dev])

model = LogisticRegression(max_iter=2000, class_weight='balanced')
model.fit(X_train_combined, y_train)

y_pred = model.predict(X_dev_combined)
print(classification_report(y_dev, y_pred))

pickle.dump(model, open('stage2_model.pkl', 'wb'))
pickle.dump(vectorizer, open('stage2_vectorizer.pkl', 'wb'))
