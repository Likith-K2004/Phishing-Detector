document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const urlInput = document.getElementById('urlInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const confidenceBar = document.getElementById('confidenceBar');
    const domainAge = document.getElementById('domainAge');
    const sslStatus = document.getElementById('sslStatus');
    const urlScore = document.getElementById('urlScore');
    const redirectCount = document.getElementById('redirectCount');
    const reportBtn = document.getElementById('reportBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const themeToggle = document.getElementById('themeToggle');
    const closeBtn = document.getElementById('closeBtn');
    const collapseBtn = document.getElementById('collapseBtn');
    const chartsContainer = document.getElementById('chartsContainer');
    const learnMoreBtn = document.getElementById('learnMoreBtn');
    const educationPanel = document.getElementById('educationPanel');

    // Chart instances
    let analyticsChart = null;
    let featureRadarChart = null;

    // Current URL and analysis data storage
    let currentUrl = '';
    let currentAnalysis = null;
    
    // Check if dark mode is preferred
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDarkScheme) {
        document.body.classList.remove('light');
        document.body.classList.add('dark');
        themeToggle.textContent = '☀️';
    }

    // Initialize with current tab's URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
            urlInput.value = tabs[0].url;
            currentUrl = tabs[0].url;
            
            // Automatically analyze the current URL
            analyzeUrl(currentUrl);
        }
    });

    // Theme toggle
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark');
        document.body.classList.toggle('light');
        themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    });

    // Close button
    closeBtn.addEventListener('click', function() {
        // Send message to background script to hide sidebar
        chrome.runtime.sendMessage({action: 'hideSidebar'});
    });

    // Collapse button
    collapseBtn.addEventListener('click', function() {
        // Toggle collapse state
        document.body.style.transform = 'translateX(320px)';
        
        // Change button to expand
        collapseBtn.innerHTML = '<div class="toggle-icon">‹</div>';
        
        // Change button function to expand
        collapseBtn.removeEventListener('click', arguments.callee);
        collapseBtn.addEventListener('click', function() {
            document.body.style.transform = 'translateX(0)';
            collapseBtn.innerHTML = '<div class="toggle-icon">›</div>';
            
            // Reset to collapse function
            collapseBtn.removeEventListener('click', arguments.callee);
            collapseBtn.addEventListener('click', arguments.callee);
        });
    });

    // Analyze button
    analyzeBtn.addEventListener('click', function() {
        const url = urlInput.value.trim();
        if (url) {
            analyzeUrl(url);
        } else {
            alert('Please enter a valid URL');
        }
    });

    // Report button
    reportBtn.addEventListener('click', function() {
        const cybercrimeReportUrl = "https://cybercrime.gov.in/Webform/Accept.aspx";
        chrome.tabs.create({ url: cybercrimeReportUrl });
    });

    // Download button
    downloadBtn.addEventListener('click', function() {
        if (currentAnalysis) {
            generatePDFReport(currentAnalysis, currentUrl);
        } else {
            alert('Please analyze a URL first');
        }
    });
    
    // Learn More button
    learnMoreBtn.addEventListener('click', function() {
        resultsContainer.style.display = 'none';
        educationPanel.style.display = 'block';
    });
    
    // Close education panel
    document.getElementById('closeEducation').addEventListener('click', function() {
        educationPanel.style.display = 'none';
        resultsContainer.style.display = 'block';
    });
    
    // Understood button
    document.getElementById('understoodBtn').addEventListener('click', function() {
        educationPanel.style.display = 'none';
        resultsContainer.style.display = 'block';
    });
    
    // Next tip button
    document.getElementById('nextTip').addEventListener('click', function() {
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

    // Function to analyze URL
    function analyzeUrl(url) {
        // Show loading state
        loadingIndicator.style.display = 'block';
        resultsContainer.style.display = 'none';
        educationPanel.style.display = 'none';
        
        // Store current URL
        currentUrl = url;
        
        // Send message to background script for analysis
        chrome.runtime.sendMessage(
            { type: 'CHECK_URL', url: url },
            function(response) {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';
                
                if (!response || response.status === 'error') {
                    showError(response?.message || 'Analysis failed');
                    return;
                }
                
                // Store the analysis results
                currentAnalysis = response;
                
                // Display results
                showResults(response);
                
                // If phishing is detected, prepare educational content
                if (response.isPhishing) {
                    prepareEducationalContent(response, url);
                    learnMoreBtn.style.display = 'block';
                } else {
                    learnMoreBtn.style.display = 'none';
                }
            }
        );
    }

    // Function to show error
    function showError(message) {
        resultsContainer.style.display = 'block';
        resultIcon.innerHTML = '❌';
        resultTitle.textContent = 'Error: ' + message;
        resultTitle.className = 'result-title';
        confidenceBar.style.width = '0%';
        
        // Reset indicators
        domainAge.textContent = '-';
        sslStatus.textContent = '-';
        urlScore.textContent = '-';
        redirectCount.textContent = '-';
        
        // Reset dots
        document.querySelectorAll('.severity-dot').forEach(dot => {
            dot.classList.remove('active');
        });
        
        // Hide charts
        chartsContainer.style.display = 'none';
    }

    // Function to show results
    function showResults(data) {
        resultsContainer.style.display = 'block';
        
        // Update UI based on phishing status
        if (data.isPhishing) {
            resultIcon.innerHTML = '⚠️';
            resultTitle.textContent = 'Phishing Detected!';
            resultTitle.className = 'result-title phishing';
            confidenceBar.style.backgroundColor = '#c62828';
            
            // Add phishing class to body
            document.body.classList.remove('safe');
            document.body.classList.add('phishing');

            // Log phishing detection to file
            logPhishingDetection(data, currentUrl);
        } else {
            resultIcon.innerHTML = '✅';
            resultTitle.textContent = 'Safe Website';
            resultTitle.className = 'result-title safe';
            confidenceBar.style.backgroundColor = '#2e7d32';
            
            // Add safe class to body
            document.body.classList.remove('phishing');
            document.body.classList.add('safe');
        }
        
        // Update confidence bar
        confidenceBar.style.width = `${data.phishingConfidence * 100}%`;
        
        // Update severity dots
        const severityLevel = Math.ceil(data.phishingConfidence * 5);
        document.querySelectorAll('.severity-dot').forEach((dot, index) => {
            dot.classList.toggle('active', index < severityLevel);
        });
        
        // Update technical indicators
        domainAge.textContent = `${data.features.domain_age_days} days`;
        sslStatus.textContent = data.features.has_ssl ? 'Present' : 'Missing';
        urlScore.textContent = (data.features.suspicious_url_score * 100).toFixed(1) + '%';
        redirectCount.textContent = data.features.redirect_count;
        
        // Make sure the charts container is visible
        chartsContainer.style.display = 'block';
        
        // Initialize or update charts - with a slight delay to ensure the container is fully visible
        setTimeout(() => {
            initializeCharts(data);
        }, 100);
    }

    // Function to log phishing detection
    function logPhishingDetection(data, url) {
        const detectionLog = {
            timestamp: new Date().toISOString(),
            url: url,
            features: data.features,
            predictions: {
                naive_bayes: {
                    prediction: data.naiveBayes?.prediction || "unknown",
                    legitimate_confidence: data.naiveBayes?.legitimateConfidence || 0,
                    phishing_confidence: data.naiveBayes?.phishingConfidence || 0
                },
                logistic_regression: {
                    prediction: data.logisticRegression?.prediction || "unknown",
                    legitimate_confidence: data.logisticRegression?.legitimateConfidence || 0,
                    phishing_confidence: data.logisticRegression?.phishingConfidence || 0
                },
                bert: {
                    prediction: data.bert?.prediction || "unknown",
                    legitimate_confidence: data.bert?.legitimateConfidence || 0,
                    phishing_confidence: data.bert?.phishingConfidence || 0
                }
            },
            final_prediction: {
                verdict: "phishing",
                legitimate_confidence: data.legitimateConfidence,
                phishing_confidence: data.phishingConfidence
            }
        };
        
        // Send log to background script to save to file
        chrome.runtime.sendMessage({
            action: 'logPhishingDetection',
            detectionLog: detectionLog
        });
        
        console.log("Phishing detection logged:", detectionLog);
    }

    // Function to initialize charts
    function initializeCharts(data) {
        try {
            console.log('Initializing charts with data:', data);
            
            if (typeof Chart === 'undefined') {
                console.error('Chart.js library not found - charts will not be displayed');
                chartsContainer.innerHTML = '<p style="color: red; padding: 10px;">Charts could not be loaded. Please check the console for errors.</p>';
                return;
            }
            
            // Get canvas contexts
            const analyticsCanvas = document.getElementById('analyticsChart');
            const radarCanvas = document.getElementById('featureRadarChart');
            
            if (!analyticsCanvas || !radarCanvas) {
                console.error('Chart canvas elements not found:', {
                    analyticsCanvas: !!analyticsCanvas,
                    radarCanvas: !!radarCanvas
                });
                return;
            }
            
            const ctxAnalytics = analyticsCanvas.getContext('2d');
            const ctxRadar = radarCanvas.getContext('2d');
            
            // Make sure canvases are visible and properly sized
            analyticsCanvas.style.display = 'block';
            radarCanvas.style.display = 'block';
            
            // Destroy existing charts if they exist
            if (analyticsChart) {
                console.log('Destroying existing analytics chart');
                analyticsChart.destroy();
            }
            if (featureRadarChart) {
                console.log('Destroying existing radar chart');
                featureRadarChart.destroy();
            }
            
            console.log('Creating new analytics chart');
            // Create analytics chart
            analyticsChart = new Chart(ctxAnalytics, {
                type: 'bar',
                data: {
                    labels: ['Safe', 'Phishing'],
                    datasets: [{
                        data: [data.legitimateConfidence, data.phishingConfidence],
                        backgroundColor: ['#2e7d32', '#c62828']
                    }]
                },
                options: { 
                    scales: { y: { beginAtZero: true, max: 1 } },
                    plugins: { legend: { display: false } }
                }
            });
            
            console.log('Creating new radar chart');
            // Create radar chart
            featureRadarChart = new Chart(ctxRadar, {
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
            
            console.log('Charts initialized successfully');
        } catch (error) {
            console.error('Error initializing charts:', error);
            chartsContainer.innerHTML = `<p style="color: red; padding: 10px;">Error initializing charts: ${error.message}</p>`;
        }
    }

    // Function to prepare educational content
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
        if (data.features.similarity_flag) {
            redFlags.push({
                icon: '🔤',
                text: `This domain looks similar to popular sites but is slightly different. It might be trying to trick you.`
            });
        }
        if (data.features.suspicious_url_score > 0.3) {
            redFlags.push({
                icon: '🔗',
                text: 'Suspicious URL pattern detected that is commonly used in phishing attacks.'
            });
        }
        if (data.phishingConfidence > 0.8) {
            redFlags.push({
                icon: '🔍',
                text: 'Our AI detected this as a high-risk site based on its content and structure.'
            });
        }
        if (data.features.domain_age_days < 30) {
            redFlags.push({
                icon: '🕒',
                text: `This domain is very new (${data.features.domain_age_days} days old), which is often a sign of phishing.`
            });
        }
        if (!data.features.has_ssl) {
            redFlags.push({
                icon: '🔓',
                text: 'This site lacks a valid SSL certificate (no HTTPS).'
            });
        }
        if (data.features.redirect_count > 2) {
            redFlags.push({
                icon: '🔄',
                text: `This site has multiple redirects (${data.features.redirect_count}), which can be a phishing tactic.`
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
                content: "Always verify that you're on the correct website. Look for subtle misspellings like \"g00gle.com\" instead of \"google.com\"."
            },
            {
                title: "Look for HTTPS",
                content: "Secure websites use HTTPS (look for the lock icon). While not all HTTPS sites are safe, most legitimate sites use it."
            },
            {
                title: "Be cautious with personal information",
                content: "Never enter personal details, passwords or credit card information unless you're 100% sure the site is legitimate."
            },
            {
                title: "Watch for urgency tactics",
                content: "Phishing attempts often create false urgency. Be suspicious of \"Act now!\" or \"Your account will be closed!\" messages."
            }
        ];

        tips.forEach((tip, index) => {
            const slide = document.createElement('div');
            slide.className = 'tip-slide';
            slide.style.display = index === 0 ? 'block' : 'none';
            slide.dataset.index = index;

            slide.innerHTML = `
                <div class="tip-title">${tip.title}</div>
                <p>${tip.content}</p>
            `;

            tipsCarousel.appendChild(slide);
        });
    }

    // Function to generate PDF report
    function generatePDFReport(data, url) {
        try {
            // Get jsPDF
            const jsPDF = window.jspdf?.jsPDF || window.jsPDF || jspdf?.jsPDF;
            if (!jsPDF) {
                throw new Error('jsPDF library not found');
            }
            
            // Create PDF document
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // Add title
            doc.setFontSize(18);
            doc.setTextColor(220, 53, 69); // Red color for warning
            doc.text('Phishing Detection Report', pageWidth / 2, 20, { align: 'center' });
            
            // Add timestamp
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const date = new Date().toLocaleString();
            doc.text(`Generated on: ${date}`, pageWidth / 2, 30, { align: 'center' });
            
            // Start content
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            let yPos = 40;
            
            // Add URL
            doc.text(`URL: ${url}`, 20, yPos);
            yPos += 10;
            
            // Add date again as part of the main content
            doc.text(`Date: ${date}`, 20, yPos);
            yPos += 10;
            
            // Add verdict with proper color
            if (data.isPhishing) {
                doc.setTextColor(220, 53, 69); // Red for phishing
                doc.text("Verdict: PHISHING DETECTED", 20, yPos);
            } else {
                doc.setTextColor(40, 167, 69); // Green for safe
                doc.text("Verdict: SAFE WEBSITE", 20, yPos);
            }
            yPos += 10;
            
            // Add confidence scores
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Phishing Confidence: ${(data.phishingConfidence * 100).toFixed(1)}%`, 20, yPos);
            yPos += 8;
            doc.text(`Legitimate Confidence: ${(data.legitimateConfidence * 100).toFixed(1)}%`, 20, yPos);
            yPos += 15;
            
            // Technical indicators section
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text('Technical Indicators:', 20, yPos);
            yPos += 10;
            
            doc.setFontSize(12);
            doc.text(`• Domain Age: ${data.features.domain_age_days} days`, 20, yPos);
            yPos += 8;
            doc.text(`• SSL Certificate: ${data.features.has_ssl ? 'Present' : 'Missing'}`, 20, yPos);
            yPos += 8;
            doc.text(`• Redirect Count: ${data.features.redirect_count}`, 20, yPos);
            yPos += 8;
            doc.text(`• Suspicious URL Score: ${(data.features.suspicious_url_score * 100).toFixed(1)}%`, 20, yPos);
            yPos += 15;
            
            // Recommendations
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text('Recommendations:', 20, yPos);
            yPos += 10;
            
            doc.setFontSize(12);
            doc.text('• Do not enter personal information on this site', 20, yPos);
            yPos += 8;
            doc.text('• Do not download files from this site', 20, yPos);
            yPos += 8;
            doc.text('• Close this website immediately', 20, yPos);
            yPos += 20;
            
            // Footer
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Generated by Phishing Detector', pageWidth / 2, yPos, { align: 'center' });
            
            // Save the PDF
            doc.save('phishing-report.pdf');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF report. Please try again.');
        }
    }
});
