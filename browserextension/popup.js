document.addEventListener('DOMContentLoaded', function() {
    // Detect system theme mode (dark/light) and apply it
    let prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light');
    console.log('Initial body classes:', document.body.className);

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
   
    document.getElementById('decreaseText').addEventListener('click', () => {
        fontSize = Math.max(0.5, fontSize - 0.2);
        document.body.style.fontSize = `${fontSize}rem`;
        console.log('Font size decreased to:', fontSize);
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
        statusMessage.innerHTML = `<div class="spinner"></div><p>Checking...</p>`;

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
                    statusMessage.offsetHeight;
                    console.log('Error message set to:', statusMessage.textContent);
                    if (voiceEnabled) {
                        speakMessage(languages[lang].error, lang);
                    }
                    return;
                }

                // Update UI
                console.log('Updating icon and message...');
                iconDisplay.className = 'iconDisplay';
                statusMessage.innerHTML = ''; // Clear spinner before updating
                if (data.isPhishing === true) {
                    console.log('Phishing site detected');
                    iconDisplay.innerHTML = '❌';
                    statusMessage.className = 'status phishing';
                    statusMessage.textContent = languages[lang].phishing;
                    console.log('Applying phishing classes');
                    document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', 'phishing');
                    document.body.offsetHeight; // Force reflow
                    learnMoreBtn.style.display = 'block';
                    learnMoreBtn.textContent = languages[lang].learnMore;
                    prepareEducationalContent(data, url);
                } else {
                    console.log('Safe site detected');
                    iconDisplay.innerHTML = '✅';
                    statusMessage.className = 'status safe';
                    statusMessage.textContent = languages[lang].safe;
                    console.log('Applying safe classes');
                    document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', 'safe');
                    document.body.offsetHeight; // Force reflow
                    learnMoreBtn.style.display = 'none';
                }
                console.log('Body classes after update:', document.body.className);
                console.log('Computed background-color:', window.getComputedStyle(document.body).backgroundColor);

                // Force UI repaint
                document.body.style.display = 'none';
                document.body.offsetHeight; // Trigger reflow
                document.body.style.display = 'flex';
                console.log('Forced UI repaint. New computed background-color:', window.getComputedStyle(document.body).backgroundColor);

                // Confidence bar
                console.log(`Updating confidence bar: width= ${data.phishingConfidence * 100}%, background= ${data.isPhishing ? '#c62828' : '#2e7d32'}`);
                confidenceBar.style.width = `${data.phishingConfidence * 100}%`;
                confidenceBar.style.background = data.isPhishing ? '#c62828' : '#2e7d32';
                confidenceBar.offsetHeight; // Force reflow
                console.log('Confidence bar styles:', window.getComputedStyle(confidenceBar));

                // Severity indicator
                console.log(`Updating severity dots: level= ${Math.ceil(data.phishingConfidence * 5)}`);
                const severityLevel = Math.ceil(data.phishingConfidence * 5);
                for (let i = 1; i <= 5; i++) {
                    const dot = document.getElementById(`dot${i}`);
                    dot.classList.toggle('active', i <= severityLevel);
                    dot.title = `Risk Level: ${severityLevel}/5`;
                    console.log(`Severity dot ${i} active:`, dot.classList.contains('active'));
                }

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
                                    data.features.domain_age_days < 30 ? 90 : 30,
                                    data.features.has_ssl ? 30 : 90,
                                    data.features.redirect_count * 20,
                                    data.features.similarity_flag ? 90 : 30
                                ],
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: 'rgb(255, 99, 132)',
                                pointBackgroundColor: 'rgb(255, 99, 132)'
                            }]
                        },
                        options: {
                            elements: { line: { borderWidth: 3 } },
                            scales: { r: { angleLines: { display: true }, suggestedMin: 0, suggestedMax: 100 } }
                        }
                    });
                }

                // Feedback button
                document.getElementById('feedback').addEventListener('click', () => {
                    const feedbackForm = document.getElementById('feedbackForm');
                    feedbackForm.style.display = 'block'; // Show the feedback form
                    document.getElementById('mainPanel').querySelectorAll('button:not(#submitFeedback):not(#cancelFeedback)').forEach(btn => btn.disabled = true); // Disable other buttons
                });

                // Submit feedback
                document.getElementById('submitFeedback').addEventListener('click', () => {
                    const feedbackText = document.getElementById('feedbackText').value;
                    chrome.storage.local.get(['feedback'], (result) => {
                        const feedback = result.feedback || {};
                        feedback[currentTab.url] = { isPhishing: !data.isPhishing, userComment: feedbackText, timestamp: new Date().toISOString() };
                        chrome.storage.local.set({ feedback }, () => {
                            console.log('Feedback saved:', feedback);
                            // Optionally send feedback to the server
                            fetch('http://127.0.0.1:5000/submit-feedback', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ url: currentTab.url, feedback: feedback[currentTab.url] })
                            }).then(response => response.json()).then(feedbackResponse => {
                                console.log('Feedback submitted to server:', feedbackResponse);
                            }).catch(error => {
                                console.error('Error submitting feedback to server:', error);
                            });

                            chrome.runtime.sendMessage({
                                type: 'CHECK_URL',
                                url: currentTab.url,
                                feedback: feedback[currentTab.url].isPhishing
                            }, (newData) => {
                                console.log('Feedback Response:', newData);
                                statusMessage.textContent = 'Feedback recorded! Rechecking...';
                                chrome.runtime.sendMessage({ type: 'CHECK_URL', url: currentTab.url }, (updatedData) => {
                                    statusMessage.textContent = updatedData.isPhishing ? languages[lang].phishing : languages[lang].safe;
                                    iconDisplay.innerHTML = updatedData.isPhishing ? '❌' : '✅';
                                    document.body.classList.remove('light', 'dark', 'phishing', 'safe');
                                    document.body.classList.add(prefersDarkScheme ? 'dark' : 'light', updatedData.isPhishing ? 'phishing' : 'safe');
                                    document.getElementById('feedbackForm').style.display = 'none'; // Hide the form
                                    document.getElementById('mainPanel').querySelectorAll('button').forEach(btn => btn.disabled = false); // Re-enable buttons
                                    document.getElementById('feedbackText').value = ''; // Clear the textarea
                                });
                            });
                        });
                    });
                });

                // Cancel feedback
                document.getElementById('cancelFeedback').addEventListener('click', () => {
                    document.getElementById('feedbackForm').style.display = 'none'; // Hide the form
                    document.getElementById('mainPanel').querySelectorAll('button').forEach(btn => btn.disabled = false); // Re-enable buttons
                    document.getElementById('feedbackText').value = ''; // Clear the textarea
                });

                // Report button (Navigate to cybercrime portal)
                document.getElementById('report').addEventListener('click', function() {
                    const cybercrimeReportUrl = "https://cybercrime.gov.in/Webform/Accept.aspx";
                    console.log('Opening cybercrime portal');
                    chrome.tabs.create({ url: cybercrimeReportUrl });
                });

                // Download Report button (Generate detailed PDF)
                document.getElementById('downloadReport').addEventListener('click', function() {
                    console.log('Download Report button clicked');
                    // After the data is received, we'll generate the PDF
                    if (window.lastResponseData) {
                        generatePDFReport(window.lastResponseData, url);
                    } else {
                        alert('Please wait for website analysis to complete');
                    }
                });

                // Add a new function to generate PDF from logs
                function generateDetectionLogsPDF(logs, currentUrl, currentData) {
                    console.log('Generating PDF report with detection logs');
                    try {
                        // Create loading indicator
                        const loadingMsg = document.createElement('div');
                        loadingMsg.textContent = 'Generating Comprehensive PDF Report...';
                        loadingMsg.style.position = 'fixed';
                        loadingMsg.style.bottom = '10px';
                        loadingMsg.style.right = '10px';
                        loadingMsg.style.background = '#333';
                        loadingMsg.style.color = 'white';
                        loadingMsg.style.padding = '8px 16px';
                        loadingMsg.style.borderRadius = '4px';
                        loadingMsg.style.zIndex = '9999';
                        document.body.appendChild(loadingMsg);
                        
                        // Use jsPDF to generate PDF
                        const { jsPDF } = window.jspdf;
                        const doc = new jsPDF();
                        
                        // Title page
                        doc.setFontSize(22);
                        doc.setTextColor(0, 0, 128);
                        doc.text('Phishing Detection Report', 105, 20, { align: 'center' });
                        
                        doc.setFontSize(14);
                        doc.setTextColor(0);
                        doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
                        
                        doc.setFontSize(12);
                        doc.text('This report contains detailed analysis of websites checked for phishing activity.', 105, 45, { align: 'center' });
                        
                        // Current website analysis
                        doc.addPage();
                        doc.setFontSize(18);
                        doc.setTextColor(0, 0, 128);
                        doc.text('Current Website Analysis', 105, 20, { align: 'center' });
                        
                        doc.setFontSize(14);
                        doc.text(`URL: ${currentUrl}`, 15, 35);
                        
                        // Verdict with color for current website
                        if (currentData.isPhishing) {
                            doc.setTextColor(192, 0, 0);
                            doc.text('Verdict: PHISHING DETECTED', 15, 45);
                        } else {
                            doc.setTextColor(0, 128, 0);
                            doc.text('Verdict: SAFE WEBSITE', 15, 45);
                        }
                        
                        // Confidence scores for current website
                        doc.setFontSize(12);
                        doc.setTextColor(0);
                        doc.text(`Phishing Confidence: ${(currentData.phishingConfidence * 100).toFixed(1)}%`, 15, 55);
                        doc.text(`Safe Confidence: ${(currentData.legitimateConfidence * 100).toFixed(1)}%`, 15, 65);
                        
                        // Features section for current website
                        doc.text('Technical Analysis:', 15, 80);
                        doc.text(`• Suspicious URL Score: ${(currentData.features.suspicious_url_score * 100).toFixed(1)}%`, 20, 90);
                        doc.text(`• Domain Age: ${currentData.features.domain_age_days} days`, 20, 100);
                        doc.text(`• SSL Certificate: ${currentData.features.has_ssl ? 'Present' : 'Missing'}`, 20, 110);
                        doc.text(`• Redirect Count: ${currentData.features.redirect_count}`, 20, 120);
                        doc.text(`• Similar to Known Domain: ${currentData.features.similarity_flag ? 'Yes' : 'No'}`, 20, 130);
                        
                        // Model predictions section for current website
                        doc.text('Model Predictions:', 15, 145);
                        doc.text(`• Naive Bayes: ${currentData.nbResult.isPhishing ? 'Phishing' : 'Safe'} (${(currentData.nbResult.phishingConfidence * 100).toFixed(1)}%)`, 20, 155);
                        doc.text(`• Logistic Regression: ${currentData.lrResult.isPhishing ? 'Phishing' : 'Safe'} (${(currentData.lrResult.phishingConfidence * 100).toFixed(1)}%)`, 20, 165);
                        doc.text(`• BERT Neural Network: ${currentData.bertResult.isPhishing ? 'Phishing' : 'Safe'} (${(currentData.bertResult.phishingConfidence * 100).toFixed(1)}%)`, 20, 175);
                        
                        // Previously analyzed websites (from logs)
                        doc.addPage();
                        doc.setFontSize(18);
                        doc.setTextColor(0, 0, 128);
                        doc.text('Detection History', 105, 20, { align: 'center' });
                        
                        // Check if we have logs
                        if (logs && logs.length > 0) {
                            doc.setFontSize(12);
                            doc.setTextColor(0);
                            doc.text(`Total websites analyzed: ${logs.length}`, 15, 35);
                            
                            // Count statistics
                            const phishingSites = logs.filter(log => log.isPhishing).length;
                            const safeSites = logs.length - phishingSites;
                            
                            doc.text(`Phishing websites detected: ${phishingSites}`, 15, 45);
                            doc.text(`Safe websites detected: ${safeSites}`, 15, 55);
                            
                            // Table header
                            let yPos = 70;
                            doc.setFontSize(10);
                            doc.setTextColor(0);
                            doc.text('URL', 15, yPos);
                            doc.text('Result', 150, yPos);
                            doc.text('Date', 180, yPos);
                            yPos += 5;
                            
                            // Draw a line
                            doc.line(15, yPos, 195, yPos);
                            yPos += 10;
                            
                            // List entries
                            let currentPage = 2;  // We're on page 3 at this point
                            logs.forEach((log, index) => {
                                // Check if we need a new page (max 25 entries per page)
                                if (index > 0 && index % 25 === 0) {
                                    doc.addPage();
                                    currentPage++;
                                    yPos = 20;
                                    
                                    // Table header on new page
                                    doc.setFontSize(10);
                                    doc.text('URL', 15, yPos);
                                    doc.text('Result', 150, yPos);
                                    doc.text('Date', 180, yPos);
                                    yPos += 5;
                                    
                                    // Draw a line
                                    doc.line(15, yPos, 195, yPos);
                                    yPos += 10;
                                }
                                
                                // Truncate URL if too long
                                let displayUrl = log.url;
                                if (displayUrl.length > 80) {
                                    displayUrl = displayUrl.substring(0, 77) + '...';
                                }
                                
                                // Convert timestamp to readable date
                                const date = new Date(log.timestamp);
                                const dateStr = date.toLocaleDateString();
                                
                                // Set color based on result
                                doc.setTextColor(log.isPhishing ? 192 : 0, log.isPhishing ? 0 : 128, 0);
                                doc.text(displayUrl, 15, yPos);
                                doc.text(log.isPhishing ? 'Phishing' : 'Safe', 150, yPos);
                                doc.setTextColor(0);
                                doc.text(dateStr, 180, yPos);
                                
                                yPos += 7;
                            });
                            
                            // Detailed log entries (one per page)
                            logs.forEach((log, index) => {
                                // Only include the first 10 detailed entries to keep report size reasonable
                                if (index < 10) {
                                    doc.addPage();
                                    doc.setFontSize(14);
                                    doc.setTextColor(0, 0, 128);
                                    doc.text(`Site Analysis #${index + 1}`, 105, 20, { align: 'center' });
                                    
                                    doc.setFontSize(12);
                                    doc.setTextColor(0);
                                    doc.text(`URL: ${log.url}`, 15, 35);
                                    doc.text(`Date: ${new Date(log.timestamp).toLocaleString()}`, 15, 45);
                                    
                                    // Verdict with color
                                    if (log.isPhishing) {
                                        doc.setTextColor(192, 0, 0);
                                        doc.text('Verdict: PHISHING DETECTED', 15, 60);
                                    } else {
                                        doc.setTextColor(0, 128, 0);
                                        doc.text('Verdict: SAFE WEBSITE', 15, 60);
                                    }
                                    
                                    // Features section
                                    doc.setTextColor(0);
                                    doc.text('Technical Analysis:', 15, 75);
                                    doc.text(`• Suspicious URL Score: ${(log.features.suspicious_url_score * 100).toFixed(1)}%`, 20, 85);
                                    doc.text(`• Domain Age: ${log.features.domain_age_days} days`, 20, 95);
                                    doc.text(`• SSL Certificate: ${log.features.has_ssl ? 'Present' : 'Missing'}`, 20, 105);
                                    doc.text(`• Redirect Count: ${log.features.redirect_count}`, 20, 115);
                                    doc.text(`• Similar to Known Domain: ${log.features.similarity_flag ? 'Yes' : 'No'}`, 20, 125);
                                }
                            });
                        } else {
                            doc.setFontSize(12);
                            doc.text('No previous detection records found.', 15, 40);
                        }
                        
                        // Safety tips page
                        doc.addPage();
                        doc.setFontSize(18);
                        doc.setTextColor(0, 0, 128);
                        doc.text('How to Stay Safe Online', 105, 20, { align: 'center' });
                        
                        doc.setFontSize(14);
                        doc.setTextColor(0);
                        doc.text('Tips to Avoid Phishing Attacks:', 15, 35);
                        
                        doc.setFontSize(12);
                        const tips = [
                            'Always check the URL before entering sensitive information',
                            'Look for HTTPS in the website address (lock icon)',
                            'Be suspicious of urgent requests for personal information',
                            'Don\'t click on links in emails from unknown senders',
                            'Keep your browser and security software updated',
                            'Use strong, unique passwords for each website',
                            'Enable two-factor authentication when available',
                            'Check for spelling and grammar errors (common in phishing sites)',
                            'Be cautious with email attachments',
                            'Report suspected phishing to authorities'
                        ];
                        
                        let tipYPos = 45;
                        tips.forEach((tip, index) => {
                            doc.text(`${index + 1}. ${tip}`, 15, tipYPos);
                            tipYPos += 10;
                        });
                        
                        // Add contact information
                        tipYPos += 10;
                        doc.text('To report phishing in India, visit:', 15, tipYPos);
                        doc.setTextColor(0, 0, 255);
                        doc.text('https://cybercrime.gov.in', 15, tipYPos + 10);
                        
                        // Footer on every page
                        const pageCount = doc.internal.getNumberOfPages();
                        for (let i = 1; i <= pageCount; i++) {
                            doc.setPage(i);
                            doc.setFontSize(10);
                            doc.setTextColor(0);
                            doc.text('Generated by Phishing Detector Extension', 105, 290, { align: 'center' });
                            doc.text(`Page ${i} of ${pageCount}`, 180, 290);
                        }
                        
                        // Save the PDF
                        const filename = `Phishing_Detection_Report_${Date.now()}.pdf`;
                        doc.save(filename);
                        console.log('PDF with detection logs generated and downloaded successfully');
                        
                        // Update loading indicator
                        loadingMsg.textContent = 'PDF Downloaded!';
                        loadingMsg.style.background = '#28a745';
                        
                        // Remove indicator after 3 seconds
                        setTimeout(() => {
                            loadingMsg.remove();
                        }, 3000);
                    } catch (error) {
                        console.error('PDF generation failed:', error);
                        alert('Error generating PDF: ' + error.message);
                    }
                }

                // Remove the Download Logs (View Reports) button event listener
                
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

                // Voice alert
                const msg = data.isPhishing ? languages[lang].phishing : languages[lang].safe;
                if (voiceEnabled) {
                    speakMessage(msg, lang);
                }
            }, remainingTime);
        });
    });

    function speakMessage(message, lang) {
        if ('speechSynthesis' in window) {
            console.log('SpeechSynthesis supported.');

            const speak = () => {
                const voices = window.speechSynthesis.getVoices();
                console.log('Available voices:', voices);
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = lang;
                utterance.volume = 1;
                utterance.rate = 1;
                utterance.pitch = 1;
                const selectedVoice = voices.find(voice => voice.lang === lang) || voices[0];
                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    console.log('Selected voice:', selectedVoice.name);
                } else {
                    console.warn('No suitable voice found for language:', lang);
                }
                try {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(utterance);
                    console.log('Speech synthesis triggered for:', message);
                } catch (e) {
                    console.error('Speech synthesis failed:', e);
                    const voiceIcon = document.getElementById('toggleVoice');
                    voiceIcon.classList.add('sound-failed');
                    alert('Sound alert failed. Please check your system sound settings.');
                }
            };

            // Retry logic
            let attempts = 0;
            const maxAttempts = 5;
            const retryInterval = 500; // 500ms between retries

            const trySpeak = () => {
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    speak();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    console.log(`Voices not loaded yet, retrying (${attempts}/${maxAttempts})...`);
                    setTimeout(trySpeak, retryInterval);
                } else {
                    console.error('Failed to load voices after maximum retries.');
                    const voiceIcon = document.getElementById('toggleVoice');
                    voiceIcon.classList.add('sound-failed');
                    alert('Sound alert failed. Voices could not be loaded.');
                }
            };

            // Initial attempt
            trySpeak();

            // Also listen for onvoiceschanged as a fallback
            window.speechSynthesis.onvoiceschanged = () => {
                console.log('Voices loaded via onvoiceschanged.');
                speak();
            };
        } else {
            console.error('Speech synthesis not supported in this browser');
            const voiceIcon = document.getElementById('toggleVoice');
            voiceIcon.classList.add('sound-failed');
            alert('Sound alert not supported in this browser.');
        }
    }

    function prepareEducationalContent(data, url) {
        const redFlagsList = document.getElementById('redFlagsList');
        const tipsCarousel = document.getElementById('tipsCarousel');
        redFlagsList.innerHTML = '';
        tipsCarousel.innerHTML = '';

        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            domain = url.split('/')[0];
        }

        const redFlags = [];
        if (data.similarityFlag) {
            redFlags.push({
                icon: '🔤',
                text: `This domain looks similar to popular sites but is slightly different. It might be trying to trick you.`,
                detail: 'Similar to a legitimate website, but with slight spelling differences.'
            });
        }
        if (data.nbResult.phishingConfidence > 0.7) {
            redFlags.push({
                icon: '🔗',
                text: 'Suspicious URL pattern detected that is commonly used in phishing attacks.',
                detail: 'This URL contains patterns often seen in fraudulent websites.'
            });
        }
        if (data.bertResult.phishingConfidence > 0.8) {
            redFlags.push({
                icon: '🔍',
                text: 'Our advanced AI detected this as a high-risk site based on its content and structure.',
                detail: 'Advanced analysis shows this site has multiple concerning characteristics.'
            });
        }
        if (url.includes('login') || url.includes('signin') || url.includes('account')) {
            redFlags.push({
                icon: '🔑',
                text: 'This site is asking for login credentials but doesn\'t appear to be legitimate.',
                detail: 'Be careful where you enter your username and password.'
            });
        }
        if (data.features.domain_age_days < 30) {
            redFlags.push({
                icon: '🕒',
                text: `This domain is very new (${data.features.domain_age_days} days old), which is often a sign of phishing.`,
                detail: 'Legitimate websites are usually older.'
            });
        }
        if (!data.features.has_ssl) {
            redFlags.push({
                icon: '🔓',
                text: 'This site lacks a valid SSL certificate (no HTTPS).',
                detail: 'Secure sites use HTTPS to protect your data.'
            });
        }
        if (data.features.redirect_count > 2) {
            redFlags.push({
                icon: '🔄',
                text: `This site has multiple redirects (${data.features.redirect_count}), which can be a phishing tactic.`,
                detail: 'Redirects can hide malicious destinations.'
            });
        }

        redFlags.forEach(flag => {
            const li = document.createElement('li');
            li.className = 'red-flag-item';
            li.innerHTML = `<span class="flag-icon">${flag.icon}</span> <span class="flag-text">${flag.text}</span>`;
            redFlagsList.appendChild(li);
        });

        const tips = [
            {
                title: "Check the URL carefully",
                content: "Always verify that you're on the correct website. Look for subtle misspellings like \"g00gle.com\" instead of \"google.com\".",
                image: "url-check.svg"
            },
            {
                title: "Look for HTTPS",
                content: "Secure websites use HTTPS (look for the lock icon). While not all HTTPS sites are safe, most legitimate sites use it.",
                image: "https.svg"
            },
            {
                title: "Be cautious with personal information",
                content: "Never enter personal details, passwords or credit card information unless you're 100% sure the site is legitimate.",
                image: "personal-info.svg"
            },
            {
                title: "Watch for urgency tactics",
                content: "Phishing attempts often create false urgency. Be suspicious of \"Act now!\" or \"Your account will be closed!\" messages.",
                image: "urgency.svg"
            }
        ];

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

    function calculateURLSuspicion(url) {
        let score = 0;
        if (url.includes('secure') || url.includes('login') || url.includes('account')) score += 0.2;
        if (url.includes('confirm') || url.includes('verify') || url.includes('update')) score += 0.2;
        if (url.match(/\d{4,}/)) score += 0.3;
        if (url.length > 100) score += 0.3;
        return Math.min(1, score);
    }

    // Add a standalone function for PDF generation
    function generatePDFReport(data, url) {
        if (!data) {
            alert('No data available to generate report');
            return;
        }
        
        console.log('Generating PDF report for:', url);
        try {
            // Create loading indicator
            const loadingMsg = document.createElement('div');
            loadingMsg.textContent = 'Generating PDF...';
            loadingMsg.style.position = 'fixed';
            loadingMsg.style.bottom = '10px';
            loadingMsg.style.right = '10px';
            loadingMsg.style.background = '#333';
            loadingMsg.style.color = 'white';
            loadingMsg.style.padding = '8px 16px';
            loadingMsg.style.borderRadius = '4px';
            loadingMsg.style.zIndex = '9999';
            document.body.appendChild(loadingMsg);
            
            // Check if jsPDF is available
            if (typeof window.jspdf === 'undefined') {
                console.error('jsPDF not available');
                alert('PDF generation library not loaded. Please try again.');
                loadingMsg.remove();
                return;
            }
            
            // Use jsPDF to generate the PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Add PDF content - basic content to ensure it works
            doc.setFontSize(18);
            doc.text('Phishing Detection Report', 105, 20, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`URL: ${url}`, 15, 40);
            doc.text(`Date: ${new Date().toLocaleString()}`, 15, 50);
            
            doc.setFontSize(14);
            if (data.isPhishing) {
                doc.setTextColor(192, 0, 0);
                doc.text('Verdict: PHISHING DETECTED', 15, 70);
            } else {
                doc.setTextColor(0, 128, 0);
                doc.text('Verdict: SAFE WEBSITE', 15, 70);
            }
            
            // Save the PDF with current timestamp to ensure unique filename
            doc.save(`Phishing_Report_${Date.now()}.pdf`);
            
            // Update and remove loading indicator
            loadingMsg.textContent = 'PDF Downloaded!';
            loadingMsg.style.background = '#28a745';
            setTimeout(() => {
                loadingMsg.remove();
            }, 3000);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Error generating PDF: ' + error.message);
        }
    }

    // Attach event listeners using the recommended pattern
    setupButtonListeners();
    
    // Function to set up all button event listeners properly
    function setupButtonListeners() {
        // Report phishing button
        const reportBtn = document.getElementById('report');
        if (reportBtn) {
            reportBtn.addEventListener('click', function() {
                console.log('Report Phishing button clicked');
                const cybercrimeReportUrl = "https://cybercrime.gov.in/Webform/Accept.aspx";
                chrome.tabs.create({ url: cybercrimeReportUrl });
            });
        }
        
        // Download report button
        const downloadBtn = document.getElementById('downloadReport');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                console.log('Download Report button clicked');
                chrome.runtime.sendMessage({action: "generateReport"}, function(response) {
                    console.log('Report generation initiated:', response);
                    if (response && response.data) {
                        generatePDFReport(response.data, window.currentUrl);
                    } else {
                        // Fallback to using stored data
                        generatePDFReport(window.lastResponseData, window.currentUrl);
                    }
                });
            });
        }
        
        // Learn More button
        const learnMoreBtn = document.getElementById('learnMoreBtn');
        if (learnMoreBtn) {
            learnMoreBtn.addEventListener('click', function() {
                console.log('Learn More button clicked');
                document.getElementById('educationPanel').style.display = 'block';
                document.getElementById('mainPanel').style.display = 'none';
            });
        }
        
        // Close/Understood buttons for education panel
        const closeEducationBtn = document.getElementById('closeEducation');
        if (closeEducationBtn) {
            closeEducationBtn.addEventListener('click', function() {
                document.getElementById('educationPanel').style.display = 'none';
                document.getElementById('mainPanel').style.display = 'block';
            });
        }
        
        const understoodBtn = document.getElementById('understoodBtn');
        if (understoodBtn) {
            understoodBtn.addEventListener('click', function() {
                document.getElementById('educationPanel').style.display = 'none';
                document.getElementById('mainPanel').style.display = 'block';
            });
        }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        const url = currentTab.url;
        window.currentUrl = url; // Store URL for later use
        
        // ...existing code...

        // Request URL check from background.js
        console.log('Sending CHECK_URL message to background.js for URL:', url);
        chrome.runtime.sendMessage({ type: 'CHECK_URL', url: url }, (data) => {
            console.log('Received response from background.js:', data);
            window.lastResponseData = data; // Store for button handlers to use
            
            // ...existing code...
        });
    });
    
    // ...existing code...
});

// Listen for messages from background.js
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        console.log('Message received in popup:', request);
        if (request.action === "updateData") {
            window.lastResponseData = request.data;
            sendResponse({status: "data updated"});
        }
        return true; // Keep the message channel open for async response
    }
);