// Listen for tab updates and check the URL when the tab is fully loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Perform phishing check using the backend API
        fetch('http://127.0.0.1:5000/check-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: tab.url })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Response from API:', data);
            // Send the result to popup.js using chrome.runtime.sendMessage
            chrome.tabs.sendMessage(tabId, {
                type: 'URL_RESULT',
                isPhishing: data.isPhishing,
                url: tab.url
            });
        })
        .catch(error => {
            console.error('Error:', error);
            // In case of error, assume the website is phishing and send a message
            chrome.tabs.sendMessage(tabId, {
                type: 'URL_RESULT',
                isPhishing: true, // Assume phishing if there's an error
                url: tab.url
            });
        });
    }
});

// Listen for incoming messages (such as from popup.js)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'CHECK_URL') {
        // Perform phishing check when requested by popup.js
        fetch('http://127.0.0.1:5000/check-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: request.url })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Response from API:', data);
            sendResponse({ isPhishing: data.isPhishing });
        })
        .catch(error => {
            console.error('Error:', error);
            sendResponse({ isPhishing: true }); // Err on the side of caution
        });

        return true; // Required for async response
    }
});
