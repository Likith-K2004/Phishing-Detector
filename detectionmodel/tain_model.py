from datasets import load_dataset
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
import seaborn as sns
import matplotlib.pyplot as plt
import joblib  # Import joblib for saving models

# Load the phishing dataset
dataset = load_dataset("pirocheto/phishing-url")

# Convert the dataset to a Pandas DataFrame
df = pd.DataFrame(dataset['train'])

# Preprocess
X = df['url']  # Features
y = df['status']  # Target variable

# Split data into training and test sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Vectorization (convert URLs to numbers)
vectorizer = TfidfVectorizer()  # Use TfidfVectorizer for better feature extraction
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

# Train the Naive Bayes model with alpha tuning
model = MultinomialNB(alpha=0.1)  # Alpha tuning
cv_scores = cross_val_score(model, X_train_vec, y_train, cv=5)
print(f"Cross-Validation Accuracy (Naive Bayes): {cv_scores.mean() * 100:.2f}%")

model.fit(X_train_vec, y_train)

# Make predictions
y_pred = model.predict(X_test_vec)

# Evaluate the model
accuracy = accuracy_score(y_test, y_pred)
print(f"Naive Bayes Model Accuracy: {accuracy * 100:.2f}%")

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Legitimate', 'Phishing'], yticklabels=['Legitimate', 'Phishing'])
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.show()

# Compare with Logistic Regression
log_reg = LogisticRegression()
log_reg.fit(X_train_vec, y_train)
y_pred_lr = log_reg.predict(X_test_vec)
accuracy_lr = accuracy_score(y_test, y_pred_lr)
print(f"Logistic Regression Accuracy: {accuracy_lr * 100:.2f}%")

# Step 1: Save the models and vectorizer using joblib
# Save Naive Bayes model
joblib.dump(model, 'naive_bayes_model.pkl')
print("Naive Bayes model saved.")

# Save Logistic Regression model
joblib.dump(log_reg, 'logistic_regression_model.pkl')
print("Logistic Regression model saved.")

# Save the TfidfVectorizer
joblib.dump(vectorizer, 'vectorizer.pkl')
print("Vectorizer saved.")
