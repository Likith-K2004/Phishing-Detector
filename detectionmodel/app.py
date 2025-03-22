from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from Levenshtein import distance as levenshtein_distance
import requests
import re
from urllib.parse import urlparse
import time
import hashlib
import json
from datetime import datetime, timedelta
import os
from io import BytesIO
from PIL import Image
import base64
import random  # For demo purposes only, replace with actual implementation
from functools import wraps
import threading

# Load Naive Bayes and Logistic Regression models
naive_bayes_model = joblib.load('naive_bayes_model.pkl')
logistic_regression_model = joblib.load('logistic_regression_model.pkl')
vectorizer = joblib.load('vectorizer.pkl')

# Load BERT model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("ealvaradob/bert-finetuned-phishing")
model = AutoModelForSequenceClassification.from_pretrained("ealvaradob/bert-finetuned-phishing")

app = Flask(__name__)
CORS(app)

# Enhanced database of known legitimate domains
LEGIT_DOMAINS = [
    "google.com", "gmail.com", "youtube.com", "facebook.com", "instagram.com",
    "twitter.com", "apple.com", "microsoft.com", "amazon.com", "netflix.com",
    "paypal.com", "ebay.com", "linkedin.com", "dropbox.com", "github.com",
    "wikipedia.org", "yahoo.com", "reddit.com", "twitch.tv", "spotify.com",
    "chase.com", "bankofamerica.com", "wellsfargo.com", "citibank.com",
    "capitalone.com", "amex.com", "discover.com", "visa.com"
]

# Simulated WHOIS data (for demo purposes)
SIMULATED_WHOIS = {
    "google.com": {"creation_date": "1997-09-15"},
    "paypal.com": {"creation_date": "1999-06-30"},
    "facebook.com": {"creation_date": "2004-02-04"},
    "fake-login.com": {"creation_date": "2025-03-01"},
    "example.com": {"creation_date": "1995-08-13"}
}

# Simulated community database for reported URLs
COMMUNITY_REPORTS = {}

# File to store feedback and logs
FEEDBACK_FILE = "feedback.json"
LOGS_FILE = "detection_logs.json"

# Rate limiting: {ip: [timestamps]}
RATE_LIMIT = {}
RATE_LIMIT_WINDOW = 60  # 60 seconds
RATE_LIMIT_MAX_REQUESTS = 10  # Max 10 requests per minute

# Initialize feedback and logs files if they don't exist
if not os.path.exists(FEEDBACK_FILE):
    with open(FEEDBACK_FILE, 'w') as f:
        json.dump({}, f)
if not os.path.exists(LOGS_FILE):
    with open(LOGS_FILE, 'w') as f:
        json.dump([], f)

def check_similarity(url):
    domain = urlparse(url).netloc if urlparse(url).netloc else url.split('/')[0]
    min_distance = min(levenshtein_distance(domain, legit) for legit in LEGIT_DOMAINS)
    return min_distance < 3  # Flag if very similar

def get_domain_age(url):
    domain = urlparse(url).netloc
    if domain in SIMULATED_WHOIS:
        creation_date = datetime.strptime(SIMULATED_WHOIS[domain]["creation_date"], "%Y-%m-%d")
        age_days = (datetime.now() - creation_date).days
        return age_days
    # Simulate new domains as very recent
    return random.randint(1, 30)  # For demo purposes

def check_ssl(url):
    # Simulate SSL check: HTTPS presence and validity
    if url.startswith("https://"):
        domain = urlparse(url).netloc
        if domain in LEGIT_DOMAINS:
            return True
        return random.choice([True, False])  # For demo
    return False

def get_redirect_count(url):
    # Simulate redirect count (in a real app, use requests.head with allow_redirects=True)
    if "fake" in url or "login" in url:
        return random.randint(2, 5)  # Simulate more redirects for suspicious URLs
    return random.randint(0, 1)

def extract_url_features(url):
    features = {
        "suspicious_url_score": 0.0,
        "domain_age_days": get_domain_age(url),
        "has_ssl": check_ssl(url),
        "redirect_count": get_redirect_count(url),
        "similarity_flag": check_similarity(url)
    }

    # Suspicious URL patterns
    if re.search(r'\d{4,}', url):  # Lots of numbers
        features["suspicious_url_score"] += 0.3
    if url.count('-') > 3:  # Excessive hyphens
        features["suspicious_url_score"] += 0.2
    if url.count('.') > 3:  # Too many subdomains
        features["suspicious_url_score"] += 0.2
    if any(keyword in url.lower() for keyword in ['login', 'secure', 'verify', 'account']):
        features["suspicious_url_score"] += 0.3
    if len(url) > 100:  # Very long URL
        features["suspicious_url_score"] += 0.2

    features["suspicious_url_score"] = min(1.0, features["suspicious_url_score"])
    return features

def generate_screenshot(url):
    # Simulate screenshot generation (in a real app, use a headless browser like Selenium)
    # For demo, create a simple placeholder image
    img = Image.new('RGB', (200, 150), color=(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)))
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{img_base64}"

def predict_phishing(url):
    try:
        print("\nAnalyzing URL:", url)

        # Extract additional features
        features = extract_url_features(url)

        # --- Naive Bayes Prediction ---
        url_vectorized = vectorizer.transform([url])
        feature_names = vectorizer.get_feature_names_out()
        nonzero_features = url_vectorized.nonzero()[1]
        print("\nURL features detected:")
        for idx in nonzero_features:
            print(f"- {feature_names[idx]}: {url_vectorized[0, idx]}")

        nb_prediction = naive_bayes_model.predict(url_vectorized)[0]
        nb_proba = naive_bayes_model.predict_proba(url_vectorized)[0]
        nb_is_phishing = nb_prediction.lower() == 'phishing' if isinstance(nb_prediction, str) else bool(int(nb_prediction))
        nb_legitimate_confidence = float(nb_proba[0])
        nb_phishing_confidence = float(nb_proba[1])

        print("\nNaive Bayes Prediction:")
        print(f"Prediction: {'phishing' if nb_is_phishing else 'legitimate'}")
        print(f"Confidence - Legitimate: {nb_legitimate_confidence:.3f}, Phishing: {nb_phishing_confidence:.3f}")

        # --- Logistic Regression Prediction ---
        lr_prediction = logistic_regression_model.predict(url_vectorized)[0]
        lr_proba = logistic_regression_model.predict_proba(url_vectorized)[0]
        lr_is_phishing = lr_prediction.lower() == 'phishing' if isinstance(lr_prediction, str) else bool(int(lr_prediction))
        lr_legitimate_confidence = float(lr_proba[0])
        lr_phishing_confidence = float(lr_proba[1])

        print("\nLogistic Regression Prediction:")
        print(f"Prediction: {'phishing' if lr_is_phishing else 'legitimate'}")
        print(f"Confidence - Legitimate: {lr_legitimate_confidence:.3f}, Phishing: {lr_phishing_confidence:.3f}")

        # --- BERT Prediction ---
        inputs = tokenizer(url, return_tensors="pt", truncation=True, padding=True, max_length=128)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1).numpy()[0]
        bert_is_phishing = bool(probs[1] > probs[0])
        bert_legitimate_confidence = float(probs[0])
        bert_phishing_confidence = float(probs[1])

        print("\nBERT Prediction:")
        print(f"Prediction: {'phishing' if bert_is_phishing else 'legitimate'}")
        print(f"Confidence - Legitimate: {bert_legitimate_confidence:.3f}, Phishing: {bert_phishing_confidence:.3f}")

        # --- Combine Predictions ---
        phishing_score = (0.25 * nb_phishing_confidence + 0.25 * lr_phishing_confidence + 0.5 * bert_phishing_confidence)
        legitimate_score = (0.25 * nb_legitimate_confidence + 0.25 * lr_legitimate_confidence + 0.5 * bert_legitimate_confidence)

        # Adjust based on additional features - use clamping to prevent negative values
        if features["domain_age_days"] < 30:  # Very new domain
            phishing_score = min(1.0, phishing_score + 0.1)
            legitimate_score = max(0.0, legitimate_score - 0.1)
        if not features["has_ssl"]:
            phishing_score = min(1.0, phishing_score + 0.1)
            legitimate_score = max(0.0, legitimate_score - 0.1)
        if features["redirect_count"] > 2:
            phishing_score = min(1.0, phishing_score + 0.05 * features["redirect_count"])
            legitimate_score = max(0.0, legitimate_score - 0.05 * features["redirect_count"])

        # Normalize scores - ensure we don't divide by zero
        total = phishing_score + legitimate_score
        if total > 0:
            phishing_score = min(1.0, phishing_score / total)
            legitimate_score = min(1.0, legitimate_score / total)
        else:
            # Handle the edge case where both scores are zero
            phishing_score = 0.5
            legitimate_score = 0.5

        # Apply feedback if available
        with open(FEEDBACK_FILE, 'r') as f:
            feedback = json.load(f)
        if url in feedback:
            final_prediction = feedback[url]
            phishing_score = 1.0 if final_prediction else 0.0
            legitimate_score = 0.0 if final_prediction else 1.0
        else:
            PHISHING_CONFIDENCE_THRESHOLD = 0.80
            final_prediction = phishing_score > PHISHING_CONFIDENCE_THRESHOLD or features["similarity_flag"]

        print("\nCombined Prediction:")
        print(f"Final Prediction: {'phishing' if final_prediction else 'legitimate'}")
        print(f"Combined Confidence - Legitimate: {legitimate_score:.3f}, Phishing: {phishing_score:.3f}")

        # Ensure we always return valid JSON-serializable confidence values
        return {
            'isPhishing': final_prediction,
            'legitimateConfidence': float(max(0.0, min(1.0, legitimate_score))),
            'phishingConfidence': float(max(0.0, min(1.0, phishing_score))),
            'similarityFlag': features["similarity_flag"],
            'nbResult': {
                'isPhishing': nb_is_phishing,
                'legitimateConfidence': nb_legitimate_confidence,
                'phishingConfidence': nb_phishing_confidence
            },
            'lrResult': {
                'isPhishing': lr_is_phishing,
                'legitimateConfidence': lr_legitimate_confidence,
                'phishingConfidence': lr_phishing_confidence
            },
            'bertResult': {
                'isPhishing': bert_is_phishing,
                'legitimateConfidence': bert_legitimate_confidence,
                'phishingConfidence': bert_phishing_confidence
            },
            'features': {
                'suspicious_url_score': features["suspicious_url_score"],
                'domain_age_days': features["domain_age_days"],
                'has_ssl': features["has_ssl"],
                'redirect_count': features["redirect_count"],
                'similarity_flag': features["similarity_flag"]
            },
            'screenshot': generate_screenshot(url)
        }

    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return {'status': 'error', 'message': str(e)}

def rate_limit_check(ip):
    current_time = time.time()
    if ip not in RATE_LIMIT:
        RATE_LIMIT[ip] = []
    RATE_LIMIT[ip] = [t for t in RATE_LIMIT[ip] if current_time - t < RATE_LIMIT_WINDOW]
    if len(RATE_LIMIT[ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    RATE_LIMIT[ip].append(current_time)
    return True

# Global rate limiting
request_history = {}
rate_limit_lock = threading.Lock()

# Rate limiting decorator with domain-level limits
def rate_limit(max_requests=5, window_seconds=60):
    def decorator(f):
        @wraps(f)
        def wrapped_function(*args, **kwargs):
            # Get client IP
            client_ip = request.remote_addr
            current_time = time.time()
            
            # Get domain from request to implement domain-level rate limiting
            try:
                data = request.get_json()
                url = data.get('url', '')
                from urllib.parse import urlparse
                domain = urlparse(url).netloc
                key = f"{client_ip}:{domain}" if domain else client_ip
            except:
                key = client_ip  # Fallback to IP-based limiting if domain extraction fails
            
            with rate_limit_lock:
                # Initialize or clean up old requests
                if key not in request_history:
                    request_history[key] = []
                
                # Remove timestamps older than the window
                request_history[key] = [ts for ts in request_history[key] 
                                      if current_time - ts < window_seconds]
                
                # Check if rate limit exceeded
                if len(request_history[key]) >= max_requests:
                    # Calculate retry after
                    oldest_request = min(request_history[key])
                    retry_after = max(1, int(window_seconds - (current_time - oldest_request)))
                    
                    # 429 response with retry header
                    response = jsonify({
                        "error": "Rate limit exceeded",
                        "message": f"Too many requests, please try again in {retry_after} seconds"
                    })
                    response.status_code = 429
                    response.headers["Retry-After"] = str(retry_after)
                    return response
                
                # Add current request timestamp
                request_history[key].append(current_time)
            
            # Process the request normally
            return f(*args, **kwargs)
        return wrapped_function
    return decorator

# Apply rate limit to your route
@app.route('/check-url', methods=['POST'])
@rate_limit(max_requests=3, window_seconds=60)  # Max 3 requests per minute per domain
def check_url():
    try:
        # Rate limiting
        client_ip = request.remote_addr
        if not rate_limit_check(client_ip):
            return jsonify({
                "status": "error",
                "message": "Rate limit exceeded. Please try again later.",
                "isPhishing": False
            }), 429

        data = request.get_json()
        url = data.get('url')

        if not url:
            return jsonify({
                "status": "error",
                "message": "No URL provided",
                "isPhishing": False
            }), 400

        result = predict_phishing(url)

        if 'status' in result and result['status'] == 'error':
            return jsonify({
                "status": "error",
                "message": "Error analyzing URL: " + result['message'],
                "isPhishing": False
            }), 500

        # Log the detection
        try:
            with open(LOGS_FILE, 'r') as f:
                logs = json.load(f)
            logs.append({
                "url": url,
                "isPhishing": result['isPhishing'],
                "timestamp": datetime.now().isoformat(),
                "features": result['features']
            })
            with open(LOGS_FILE, 'w') as f:
                json.dump(logs, f, indent=2)
        except Exception as log_error:
            print(f"Error logging detection: {str(log_error)}")
            # Continue even if logging fails

        message = "Warning! Phishing site detected!" if result['isPhishing'] else "This site is safe."
        if result['similarityFlag']:
            message += " (Similar to a known domain!)"

        return jsonify({
            "status": "success",
            "message": message,
            "isPhishing": result['isPhishing'],
            "legitimateConfidence": result['legitimateConfidence'],
            "phishingConfidence": result['phishingConfidence'],
            "similarityFlag": result['similarityFlag'],
            "nbResult": result['nbResult'],
            "lrResult": result['lrResult'],
            "bertResult": result['bertResult'],
            "features": result['features'],
            "screenshot": result['screenshot']
        })

    except Exception as e:
        import traceback
        traceback.print_exc()  # Print the full error stack trace for debugging
        return jsonify({
            "status": "error",
            "message": str(e),
            "isPhishing": False
        }), 500

# Add a global rate limiter for all other routes
@app.before_request
def global_rate_limiter():
    # Skip for static resources
    if request.path.startswith('/static/'):
        return None
        
    # Global rate limit - 30 requests per minute across all clients
    global_key = 'global'
    current_time = time.time()
    window_seconds = 60
    max_requests = 30
    
    with rate_limit_lock:
        if global_key not in request_history:
            request_history[global_key] = []
            
        # Remove timestamps older than the window
        request_history[global_key] = [ts for ts in request_history[global_key] 
                                    if current_time - ts < window_seconds]
                                    
        # Check if global rate limit exceeded
        if len(request_history[global_key]) >= max_requests:
            # Calculate retry after
            oldest_request = min(request_history[global_key])
            retry_after = max(1, int(window_seconds - (current_time - oldest_request)))
            
            # 429 response with retry header
            response = jsonify({
                "error": "Global rate limit exceeded",
                "message": f"Server is busy, please try again in {retry_after} seconds"
            })
            response.status_code = 429
            response.headers["Retry-After"] = str(retry_after)
            return response
            
        # Add current request timestamp
        request_history[global_key].append(current_time)
    
    return None

# Add error handling for server errors
@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f"Unhandled exception: {str(e)}")
    return jsonify({
        "error": "Server error",
        "message": str(e)
    }), 500

@app.route('/report-url', methods=['POST'])
def report_url():
    try:
        data = request.get_json()
        url = data.get('url')
        if not url:
            return jsonify({"status": "error", "message": "No URL provided"}), 400

        url_hash = hashlib.md5(url.encode()).hexdigest()
        COMMUNITY_REPORTS[url_hash] = COMMUNITY_REPORTS.get(url_hash, 0) + 1
        return jsonify({"status": "success", "message": "URL reported successfully"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/feedback', methods=['POST'])
def save_feedback():
    try:
        data = request.get_json()
        url = data.get('url')
        user_feedback = data.get('feedback')  # True for phishing, False for safe

        with open(FEEDBACK_FILE, 'r') as f:
            feedback = json.load(f)
        feedback[url] = user_feedback
        with open(FEEDBACK_FILE, 'w') as f:
            json.dump(feedback, f, indent=2)

        return jsonify({"status": "success", "message": "Feedback saved"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)