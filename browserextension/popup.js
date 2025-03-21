document.addEventListener('DOMContentLoaded', function() {
    // Detect system theme mode (dark/light) and apply it
    let prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light');

    // Multi-language support
    const languages = {
        'en-US': {
            safe: 'SAFE website',
            phishing: 'Warning! This is phishing site!!',
            error: 'Error checking website. Assuming safe.',
            learnMore: 'Learn Why',
            closeEducation: 'Close',
            educationTitle: 'Why We Flagged This Site',
            redFlags: 'Red Flags Detected:',
            whatToLook: 'What to Look For:',
            nextTip: 'Next Tip',
            stayProtected: 'Stay Protected',
            understood: 'I Understand'
        },
        'hi-IN': {
            safe: 'सुरक्षित वेबसाइट',
            phishing: 'चेतावनी! यह फ़िशिंग साइट है!!',
            error: 'वेबसाइट जाँच में त्रुटि। सुरक्षित मान रहे हैं।',
            learnMore: 'जानें क्यों',
            closeEducation: 'बंद करें',
            educationTitle: 'हमने इस साइट को क्यों फ्लैग किया',
            redFlags: 'चेतावनी संकेत:',
            whatToLook: 'क्या देखें:',
            nextTip: 'अगला सुझाव',
            stayProtected: 'सुरक्षित रहें',
            understood: 'मैं समझता हूँ'
        }
    };
    const lang = navigator.language || 'en-US';

    // Accessibility controls
    let voiceEnabled = true;
    let fontSize = 1; // Default font size in rem

    // Theme toggle
    document.getElementById('toggleTheme').addEventListener('click', () => {
        prefersDarkScheme = !prefersDarkScheme;
        document.body.classList.remove('light', 'dark', 'phishing', 'safe');
        document.body.classList.add(prefersDarkScheme ? 'dark' : 'light');
    });

    document.getElementById('toggleVoice').addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        document.getElementById('toggleVoice').innerHTML = voiceEnabled ? '🔊' : '🔇';
    });

    document.getElementById('increaseText').addEventListener('click', () => {
        fontSize += 0.1;
        document.body.style.fontSize = `${fontSize}rem`;
    });

    document.getElementById('decreaseText').addEventListener('click', () => {
        fontSize = Math.max(0.5, fontSize - 0.1);
        document.body.style.fontSize = `${fontSize}rem`;
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        const url = currentTab.url;

        const iconDisplay = document.getElementById('iconDisplay');
        const statusMessage = document.getElementById('statusMessage');
        const confidenceBar = document.getElementById('confidenceBar');
        const educationPanel = document.getElementById('educationPanel');
        const redFlagsList = document.getElementById('redFlagsList');
        const learnMoreBtn = document.getElementById('learnMoreBtn');

        // Initial state
        console.log('Setting initial state: Checking website safety...');
        statusMessage.className = 'status loading';
        statusMessage.innerHTML = `<div class="spinner"></div><p>Checking website safety...</p>`;

        const startTime = Date.now();

        // Request URL check from background.js
        console.log('Sending CHECK_URL message to background.js for URL:', url);
        chrome.runtime.sendMessage({ type: 'CHECK_URL', url: url }, (data) => {
            console.log('Received response from background.js:', data);

            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, 1000 - elapsedTime);

            setTimeout(() => {
                console.log('Updating UI after delay of', remainingTime, 'ms');

                // Check if data is valid
                if (!data || data.status === 'error') {
                    console.error('Error in response:', data ? data.message : 'No data received');
                    iconDisplay.innerHTML = '❓';
                    statusMessage.className = 'status error';
                    statusMessage.innerHTML = ''; // Clear spinner
                    statusMessage.textContent = languages[lang].error;
                    // Force DOM reflow
                    statusMessage.offsetHeight;
                    console.log('Error message set to:', statusMessage.textContent);
                    if (voiceEnabled) {
                        const utterance = new SpeechSynthesisUtterance(languages[lang].error);
                        utterance.lang = lang;
                        window.speechSynthesis.speak(utterance);
                    }
                    return;
                }

                // Update UI
                console.log('Updating icon and message...');
                iconDisplay.style.fontSize = '6rem';
                statusMessage.innerHTML = ''; // Clear spinner before updating
                if (data.isPhishing === true) {
                    console.log('Phishing site detected');
                    iconDisplay.innerHTML = '❌';
                    statusMessage.className = 'status phishing';
                    statusMessage.textContent = languages[lang].phishing;
                    document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', 'phishing');

                    // Show "Learn More" button for phishing sites
                    learnMoreBtn.style.display = 'block';
                    learnMoreBtn.textContent = languages[lang].learnMore;

                    // Prepare educational content
                    prepareEducationalContent(data, url);
                } else {
                    console.log('Safe site detected');
                    iconDisplay.innerHTML = '✅';
                    statusMessage.className = 'status safe';
                    statusMessage.textContent = languages[lang].safe;
                    document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', 'safe');
                    learnMoreBtn.style.display = 'none';
                }

                // Force DOM reflow to ensure update
                statusMessage.offsetHeight;
                console.log('Updated statusMessage textContent:', statusMessage.textContent);
                console.log('statusMessage className:', statusMessage.className);
                console.log('statusMessage styles:', window.getComputedStyle(statusMessage));

                // Voice alert
                const msg = data.isPhishing ? languages[lang].phishing : languages[lang].safe;
                if (voiceEnabled) {
                    const utterance = new SpeechSynthesisUtterance(msg);
                    utterance.lang = lang;
                    window.speechSynthesis.speak(utterance);
                }

                // Confidence bar
                confidenceBar.style.width = `${data.phishingConfidence * 100}%`;
                confidenceBar.style.background = data.isPhishing ? '#c62828' : '#2e7d32';

                // Severity indicator
                const severityDots = document.querySelectorAll('.severity-dot');
                const severityLevel = Math.ceil(data.phishingConfidence * 5); // 0 to 1 -> 1 to 5
                severityDots.forEach((dot, index) => {
                    dot.classList.toggle('active', index < severityLevel);
                    dot.title = `Risk Level: ${severityLevel}/5`; // Tooltip for severity
                });

                // Analytics chart
                const ctx = document.getElementById('analyticsChart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Safe', 'Phishing'],
                        datasets: [{
                            data: [data.legitimateConfidence, data.phishingConfidence],
                            backgroundColor: ['#2e7d32', '#c62828']
                        }]
                    },
                    options: { scales: { y: { beginAtZero: true, max: 1 } } }
                });

                // Radar chart for feature importance
                if (data.isPhishing) {
                    const ctxRadar = document.getElementById('featureRadarChart').getContext('2d');
                    new Chart(ctxRadar, {
                        type: 'radar',
                        data: {
                            labels: ['Suspicious URL', 'Domain Age', 'SSL Certificate', 'Redirect Count', 'Similar Domain'],
                            datasets: [{
                                label: 'Threat Indicators',
                                data: [
                                    data.features.suspicious_url_score * 100,
                                    data.features.domain_age_days < 30 ? 90 : 30, // High risk if domain is new
                                    data.features.has_ssl ? 30 : 90, // High risk if no SSL
                                    data.features.redirect_count * 20, // Scale redirect count
                                    data.features.similarity_flag ? 90 : 30
                                ],
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: 'rgb(255, 99, 132)',
                                pointBackgroundColor: 'rgb(255, 99, 132)'
                            }]
                        },
                        options: {
                            elements: {
                                line: { borderWidth: 3 }
                            },
                            scales: {
                                r: {
                                    angleLines: { display: true },
                                    suggestedMin: 0,
                                    suggestedMax: 100
                                }
                            }
                        }
                    });
                }

                // Feedback button
                document.getElementById('feedback').addEventListener('click', () => {
                    chrome.storage.local.get(['feedback'], (result) => {
                        const feedback = result.feedback || {};
                        feedback[currentTab.url] = !data.isPhishing;
                        chrome.storage.local.set({ feedback });

                        // Send feedback to backend via background.js
                        chrome.runtime.sendMessage({
                            type: 'CHECK_URL',
                            url: currentTab.url,
                            feedback: feedback[currentTab.url]
                        }, (newData) => {
                            console.log('Feedback Response:', newData);
                            statusMessage.textContent = 'Feedback recorded! Rechecking...';
                            chrome.runtime.sendMessage({ type: 'CHECK_URL', url: currentTab.url }, (updatedData) => {
                                statusMessage.textContent = updatedData.isPhishing ? languages[lang].phishing : languages[lang].safe;
                                iconDisplay.innerHTML = updatedData.isPhishing ? '❌' : '✅';
                                document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                                document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', updatedData.isPhishing ? 'phishing' : 'safe');
                            });
                        });
                    });
                });

                // Report button (Generate PDF)
                document.getElementById('report').addEventListener('click', () => {
                    const reportData = {
                        url: currentTab.url,
                        isPhishing: data.isPhishing,
                        phishingConfidence: (data.phishingConfidence * 100).toFixed(2) + '%',
                        legitimateConfidence: (data.legitimateConfidence * 100).toFixed(2) + '%',
                        features: data.features,
                        timestamp: new Date().toISOString()
                    };

                    // Create PDF content
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.setFontSize(16);
                    doc.text('Phishing Detection Report', 10, 10);
                    doc.setFontSize(12);
                    doc.text(`URL: ${reportData.url}`, 10, 20);
                    doc.text(`Is Phishing: ${reportData.isPhishing ? 'Yes' : 'No'}`, 10, 30);
                    doc.text(`Phishing Confidence: ${reportData.phishingConfidence}`, 10, 40);
                    doc.text(`Legitimate Confidence: ${reportData.legitimateConfidence}`, 10, 50);
                    doc.text('Features:', 10, 60);
                    doc.text(`- Suspicious URL Score: ${(reportData.features.suspicious_url_score * 100).toFixed(2)}%`, 10, 70);
                    doc.text(`- Domain Age: ${reportData.features.domain_age_days} days`, 10, 80);
                    doc.text(`- Has SSL: ${reportData.features.has_ssl ? 'Yes' : 'No'}`, 10, 90);
                    doc.text(`- Redirect Count: ${reportData.features.redirect_count}`, 10, 100);
                    doc.text(`- Similarity Flag: ${reportData.features.similarity_flag ? 'Yes' : 'No'}`, 10, 110);
                    doc.text(`Timestamp: ${reportData.timestamp}`, 10, 120);

                    // Download PDF
                    doc.save('phishing_report.pdf');

                    // Also send to backend
                    fetch('http://127.0.0.1:5000/report-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: currentTab.url })
                    }).then(response => response.json()).then(reportResponse => {
                        console.log('Report Response:', reportResponse);
                        alert('Reported to community database and PDF downloaded!');
                    });
                });

                // Share Report button
                document.getElementById('shareReport').addEventListener('click', () => {
                    const reportData = {
                        url: currentTab.url,
                        isPhishing: data.isPhishing,
                        phishingConfidence: (data.phishingConfidence * 100).toFixed(2) + '%',
                        timestamp: new Date().toISOString()
                    };
                    const shareText = `Phishing Detection Report\nURL: ${reportData.url}\nIs Phishing: ${reportData.isPhishing ? 'Yes' : 'No'}\nPhishing Confidence: ${reportData.phishingConfidence}\nTimestamp: ${reportData.timestamp}`;
                    alert('Share this report:\n\n' + shareText); // Simulate sharing
                });

                // Download logs (View Reports)
                document.getElementById('downloadLogs').addEventListener('click', () => {
                    chrome.storage.local.get(['logs'], (result) => {
                        const logs = result.logs || [];
                        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'phishing_logs.json';
                        a.click();
                    });
                });

                // Learn More button
                document.getElementById('learnMoreBtn').addEventListener('click', () => {
                    educationPanel.style.display = 'block';
                    document.getElementById('mainPanel').style.display = 'none';
                });

                // Close education panel
                document.getElementById('closeEducation').addEventListener('click', () => {
                    educationPanel.style.display = 'none';
                    document.getElementById('mainPanel').style.display = 'block';
                });

                // Understood button (closes education panel)
                document.getElementById('understoodBtn').addEventListener('click', () => {
                    educationPanel.style.display = 'none';
                    document.getElementById('mainPanel').style.display = 'block';
                });
            }, remainingTime);
        });
    });

    // Function to prepare educational content
    function prepareEducationalContent(data, url) {
        const redFlagsList = document.getElementById('redFlagsList');
        const tipsCarousel = document.getElementById('tipsCarousel');
        redFlagsList.innerHTML = '';
        tipsCarousel.innerHTML = '';

        // Extract domain from URL
        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            domain = url.split('/')[0];
        }

        // Generate red flags based on detection results
        const redFlags = [];

        if (data.similarityFlag) {
            redFlags.push({
                icon: '🔤',
                text: `This domain looks similar to popular sites but is slightly different. It might be trying to trick you.`,
                detail: `Similar to a legitimate website, but with slight spelling differences.`
            });
        }

        if (data.nbResult.phishingConfidence > 0.7) {
            redFlags.push({
                icon: '🔗',
                text: `Suspicious URL pattern detected that is commonly used in phishing attacks.`,
                detail: `This URL contains patterns often seen in fraudulent websites.`
            });
        }

        if (data.bertResult.phishingConfidence > 0.8) {
            redFlags.push({
                icon: '🔍',
                text: `Our advanced AI detected this as a high-risk site based on its content and structure.`,
                detail: `Advanced analysis shows this site has multiple concerning characteristics.`
            });
        }

        if (url.includes('login') || url.includes('signin') || url.includes('account')) {
            redFlags.push({
                icon: '🔑',
                text: `This site is asking for login credentials but doesn't appear to be legitimate.`,
                detail: `Be careful where you enter your username and password.`
            });
        }

        if (data.features.domain_age_days < 30) {
            redFlags.push({
                icon: '🕒',
                text: `This domain is very new (${data.features.domain_age_days} days old), which is often a sign of phishing.`,
                detail: `Legitimate websites are usually older.`
            });
        }

        if (!data.features.has_ssl) {
            redFlags.push({
                icon: '🔓',
                text: `This site lacks a valid SSL certificate (no HTTPS).`,
                detail: `Secure sites use HTTPS to protect your data.`
            });
        }

        if (data.features.redirect_count > 2) {
            redFlags.push({
                icon: '🔄',
                text: `This site has multiple redirects (${data.features.redirect_count}), which can be a phishing tactic.`,
                detail: `Redirects can hide malicious destinations.`
            });
        }

        // Add red flags to the list
        redFlags.forEach(flag => {
            const li = document.createElement('li');
            li.className = 'red-flag-item';
            li.innerHTML = `<span class="flag-icon">${flag.icon}</span> <span class="flag-text">${flag.text}</span>`;
            redFlagsList.appendChild(li);
        });

        // Create educational tips
        const tips = [
            {
                title: "Check the URL carefully",
                content: `Always verify that you're on the correct website. Look for subtle misspellings like "g00gle.com" instead of "google.com".`,
                image: "url-check.svg"
            },
            {
                title: "Look for HTTPS",
                content: `Secure websites use HTTPS (look for the lock icon). While not all HTTPS sites are safe, most legitimate sites use it.`,
                image: "https.svg"
            },
            {
                title: "Be cautious with personal information",
                content: `Never enter personal details, passwords or credit card information unless you're 100% sure the site is legitimate.`,
                image: "personal-info.svg"
            },
            {
                title: "Watch for urgency tactics",
                content: `Phishing attempts often create false urgency. Be suspicious of "Act now!" or "Your account will be closed!" messages.`,
                image: "urgency.svg"
            }
        ];

        // Add tips to carousel
        tips.forEach((tip, index) => {
            const slide = document.createElement('div');
            slide.className = 'tip-slide';
            slide.style.display = index === 0 ? 'block' : 'none';
            slide.dataset.index = index;

            slide.innerHTML = `
                <h3>${tip.title}</h3>
                <div class="tip-image">${tip.image}</div>
                <p>${tip.content}</p>
            `;

            tipsCarousel.appendChild(slide);
        });

        // Next tip button
        document.getElementById('nextTip').addEventListener('click', () => {
            const slides = document.querySelectorAll('.tip-slide');
            let currentIndex = 0;

            slides.forEach((slide, index) => {
                if (slide.style.display === 'block') {
                    currentIndex = index;
                    slide.style.display = 'none';
                }
            });

            const nextIndex = (currentIndex + 1) % slides.length;
            slides[nextIndex].style.display = 'block';
        });
    }

    // Calculate URL suspicion score (simple implementation)
    function calculateURLSuspicion(url) {
        let score = 0;

        // Check for suspicious patterns
        if (url.includes('secure') || url.includes('login') || url.includes('account')) score += 0.2;
        if (url.includes('confirm') || url.includes('verify') || url.includes('update')) score += 0.2;
        if (url.match(/\d{4,}/)) score += 0.3; // Lots of numbers in URL
        if (url.length > 100) score += 0.3; // Very long URL

        // Limit score to 0-1 range
        return Math.min(1, score);
    }
});