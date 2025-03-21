chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkURL") {
        fetch('http://127.0.0.1:5000/check-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: request.url, use_bert: false })
        })
        .then(response => response.json())
        .then(data => {
            // Voice alert
            if (data.status === "success") {
                const utterance = new SpeechSynthesisUtterance(data.message);
                utterance.lang = 'en-US'; // Add multi-language later
                window.speechSynthesis.speak(utterance);

                // Send to popup
                chrome.runtime.sendMessage({
                    action: "updatePopup",
                    data: data
                });
            }
        });
    }
});

// Scan email links (example for Gmail)
document.querySelectorAll('a').forEach(link => {
    const url = link.href;
    if (url.startsWith('http')) {
        chrome.runtime.sendMessage({ action: "checkURL", url: url });
    }
});