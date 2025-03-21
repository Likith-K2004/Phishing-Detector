// Cache for API responses: { url: { data, timestamp } }
const urlCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Rate limiting: { url: [timestamps] }
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per URL

// Check if a URL check is rate-limited
function isRateLimited(url) {
    const now = Date.now();
    if (!rateLimit.has(url)) {
        rateLimit.set(url, []);
    }
    const timestamps = rateLimit.get(url).filter(t => now - t < RATE_LIMIT_WINDOW);
    rateLimit.set(url, timestamps);
    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        return true;
    }
    timestamps.push(now);
    return false;
}

// Fetch URL check from API with caching
async function checkUrl(url) {
    // Check cache first
    const cached = urlCache.get(url);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        console.log(`Using cached result for ${url}`);
        return cached.data;
    }

    // Rate limiting
    if (isRateLimited(url)) {
        console.warn(`Rate limit exceeded for ${url}`);
        return { status: 'error', message: 'Rate limit exceeded', isPhishing: true };
    }

    // Fetch from API
    try {
        const response = await fetch('http://127.0.0.1:5000/check-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        console.log('Response from API:', data);

        // Cache the result
        urlCache.set(url, { data, timestamp: now });

        // Log the detection
        chrome.storage.local.get(['logs'], (result) => {
            const logs = result.logs || [];
            logs.push({
                url,
                isPhishing: data.isPhishing,
                phishingConfidence: data.phishingConfidence,
                legitimateConfidence: data.legitimateConfidence,
                features: data.features || {},
                time: now
            });
            chrome.storage.local.set({ logs });
        });

        // Show notification if phishing
        if (data.isPhishing) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Phishing Alert',
                message: `Detected a phishing site: ${url}\nConfidence: ${(data.phishingConfidence * 100).toFixed(2)}%`,
                priority: 2
            });
        }

        return data;
    } catch (error) {
        console.error('Error fetching URL check:', error);
        return { status: 'error', message: error.message, isPhishing: true };
    }
}

// Batch check multiple URLs
async function checkUrls(urls) {
    const results = {};
    for (const url of urls) {
        const data = await checkUrl(url);
        results[url] = data;
    }
    return results;
}

// Listen for tab updates and check the URL when the tab is fully loaded
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const data = await checkUrl(tab.url);
        // Send the full result to popup.js or content scripts
        chrome.tabs.sendMessage(tabId, {
            type: 'URL_RESULT',
            ...data,
            url: tab.url
        });
    }
});

// Auto-block high-risk sites
chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const url = details.url;
        const data = await checkUrl(url);
        if (data.isPhishing && data.phishingConfidence > 0.9) {
            // Notify the user
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Phishing Alert',
                message: `Blocked a high-risk site: ${url}\nConfidence: ${(data.phishingConfidence * 100).toFixed(2)}%`,
                priority: 2
            });
            return { cancel: true };
        }
        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);

// Listen for messages from popup.js and content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CHECK_URL') {
        checkUrl(request.url).then(data => {
            sendResponse(data);
        });
        return true; // Required for async response
    } else if (request.type === 'CHECK_URLS') {
        checkUrls(request.urls).then(results => {
            sendResponse(results);
        });
        return true; // Required for async response
    }
});