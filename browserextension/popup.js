document.addEventListener('DOMContentLoaded', function() {
    // Detect system theme mode (dark/light) and apply it
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light');

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        const url = currentTab.url;

        const iconDisplay = document.getElementById('iconDisplay');
        const statusMessage = document.getElementById('statusMessage');

        statusMessage.className = 'status loading';
        statusMessage.innerHTML = `<div class="spinner"></div><p>Checking website safety...</p>`;

        // Minimum 1-second spinner delay
        const startTime = Date.now();

        fetch('http://127.0.0.1:5000/check-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, 1000 - elapsedTime);

            // Delay showing the result until 1 second has passed
            setTimeout(() => {
                console.log('API Response:', data);

                if (data.status === 'error') {
                    iconDisplay.innerHTML = '❓';
                    statusMessage.className = 'status error';
                    statusMessage.textContent = 'Unable to analyze website. Assuming safe.';
                    return;
                }

                if (data.isPhishing === true) {
                    iconDisplay.innerHTML = '❌'; // Cross mark for phishing
                    statusMessage.className = 'status phishing';
                    statusMessage.textContent = 'Warning! This is phishing site!!';
                } else {
                    iconDisplay.innerHTML = '✅'; // Check mark for legitimate site
                    statusMessage.className = 'status safe';
                    statusMessage.textContent = 'SAFE website';
                }
            }, remainingTime);
        })
        .catch(error => {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, 1000 - elapsedTime);

            // Delay showing the error until 1 second has passed
            setTimeout(() => {
                console.error('Error:', error);
                iconDisplay.innerHTML = '❓';
                statusMessage.className = 'status error';
                statusMessage.textContent = 'Error checking website. Assuming safe.';
            }, remainingTime);
        });
    });
});
