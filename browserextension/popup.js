chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updatePopup") {
        const data = request.data;
        document.getElementById('emoji').innerHTML = data.isPhishing ? '⚠️' : '✅';
        document.getElementById('message').textContent = data.message;
        document.getElementById('confidence').textContent =
            `Confidence: Safe ${data.legitimateConfidence}, Phishing ${data.phishingConfidence}`;

        // Analytics (simple chart)
        const ctx = document.createElement('canvas');
        document.getElementById('analytics').appendChild(ctx);
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Safe', 'Phishing'],
                datasets: [{ data: [data.legitimateConfidence, data.phishingConfidence], backgroundColor: ['#00ff00', '#ff0000'] }]
            }
        });
    }
});

document.getElementById('feedback').addEventListener('click', () => {
    chrome.storage.local.get(['feedback'], (result) => {
        const feedback = result.feedback || {};
        feedback[window.location.href] = !feedback[window.location.href];
        chrome.storage.local.set({ feedback });
    });
});

document.getElementById('report').addEventListener('click', () => {
    alert('Reported to community database!');
});