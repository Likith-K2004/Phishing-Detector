from flask import Flask, jsonify, request
from flask_cors import CORS
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from Levenshtein import distance as levenshtein_distance  # For similarity checker

# Load BERT model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("ealvaradob/bert-finetuned-phishing")
model = AutoModelForSequenceClassification.from_pretrained("ealvaradob/bert-finetuned-phishing")

app = Flask(__name__)
CORS(app)

# Similarity checker for known domains
LEGIT_DOMAINS = ["google.com", "paypal.com", "facebook.com"]


def check_similarity(url):
    domain = url.split('/')[2] if '/' in url else url
    min_distance = min(levenshtein_distance(domain, legit) for legit in LEGIT_DOMAINS)
    return min_distance < 3  # Flag if very similar


def predict_phishing(url):
    try:
        print("\nAnalyzing URL:", url)

        # Tokenize the URL for BERT
        inputs = tokenizer(url, return_tensors="pt", truncation=True, padding=True, max_length=128)

        # Get BERT prediction
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1).numpy()[0]

        # Interpret results
        is_phishing = bool(probs[1] > probs[0])  # Class 1 = phishing
        legitimate_confidence = float(probs[0])
        phishing_confidence = float(probs[1])

        # Similarity check
        is_similar = check_similarity(url)

        # Final prediction with threshold
        PHISHING_CONFIDENCE_THRESHOLD = 0.80
        final_prediction = phishing_confidence > PHISHING_CONFIDENCE_THRESHOLD or is_similar

        print("\nBERT Prediction:")
        print(f"Prediction: {'phishing' if final_prediction else 'legitimate'}")
        print(f"Confidence - Legitimate: {legitimate_confidence:.3f}, Phishing: {phishing_confidence:.3f}")

        return {
            'is_phishing': final_prediction,
            'legitimate_confidence': legitimate_confidence,
            'phishing_confidence': phishing_confidence,
            'similarity_flag': is_similar
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

        message = "Warning! Phishing site detected!" if result['is_phishing'] else "This site is safe."
        if result['similarity_flag']:
            message += " (Similar to a known domain!)"

        return jsonify({
            "status": "success",
            "message": message,
            "isPhishing": result['is_phishing'],
            "legitimateConfidence": result['legitimate_confidence'],
            "phishingConfidence": result['phishing_confidence'],
            "similarityFlag": result['similarity_flag']
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "isPhishing": False
        }), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)