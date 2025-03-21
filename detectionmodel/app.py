from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np

# Load the saved models and vectorizer
naive_bayes_model = joblib.load('naive_bayes_model.pkl')
logistic_regression_model = joblib.load('logistic_regression_model.pkl')
vectorizer = joblib.load('vectorizer.pkl')

app = Flask(__name__)
CORS(app)

def predict_phishing(url):
    try:
        print("\nAnalyzing URL:", url)

        # Vectorize the URL
        url_vectorized = vectorizer.transform([url])

        # Get feature names for debugging
        feature_names = vectorizer.get_feature_names_out()

        # Print detected features
        nonzero_features = url_vectorized.nonzero()[1]
        print("\nURL features detected:")
        for idx in nonzero_features:
            print(f"- {feature_names[idx]}: {url_vectorized[0, idx]}")

        # Get prediction and probabilities
        nb_prediction = naive_bayes_model.predict(url_vectorized)[0]
        nb_proba = naive_bayes_model.predict_proba(url_vectorized)[0]

        # Convert prediction to boolean
        # For string predictions (e.g., 'phishing' or 'legitimate')
        if isinstance(nb_prediction, (str, np.str_)):
            is_phishing = nb_prediction.lower() == 'phishing'
        # For numeric predictions (e.g., 0 or 1)
        else:
            is_phishing = bool(int(nb_prediction))

        # Get confidence scores
        legitimate_confidence = float(nb_proba[0])
        phishing_confidence = float(nb_proba[1])

        print("\nModel Predictions:")
        print(f"Naive Bayes prediction: {'phishing' if is_phishing else 'legitimate'}")
        print(f"Confidence scores - Legitimate: {legitimate_confidence:.3f}, Phishing: {phishing_confidence:.3f}")

        # Use high confidence threshold for phishing classification
        PHISHING_CONFIDENCE_THRESHOLD = 0.80
        final_prediction = phishing_confidence > PHISHING_CONFIDENCE_THRESHOLD

        return {
            'is_phishing': final_prediction,
            'legitimate_confidence': legitimate_confidence,
            'phishing_confidence': phishing_confidence
        }

    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return {'error': str(e)}

@app.route('/check-url', methods=['POST'])
def check_url():
    try:
        data = request.get_json()
        url = data.get('url')

        if not url:
            return jsonify({
                "status": "error",
                "message": "No URL provided",
                "isPhishing": False
            }), 400

        result = predict_phishing(url)

        if 'error' in result:
            return jsonify({
                "status": "error",
                "message": "Error analyzing URL",
                "isPhishing": False
            }), 500

        return jsonify({
            "status": "success",
            "message": ("Warning! This website appears to be a phishing site!"
                       if result['is_phishing']
                       else "This website appears to be safe."),
            "isPhishing": result['is_phishing'],
            "legitimateConfidence": result['legitimate_confidence'],
            "phishingConfidence": result['phishing_confidence']
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "isPhishing": False
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
