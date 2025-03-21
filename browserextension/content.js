// content.js

// Store checked URLs to avoid duplicate checks
const checkedUrls = new Set();

// Function to highlight phishing links
function highlightPhishingLink(link, isPhishing) {
    if (isPhishing) {
        // Change link color to red
        link.style.color = 'red';
        link.style.textDecoration = 'underline wavy red';

        // Add a warning title (tooltip)
        link.title = 'Warning: Potential phishing link!';

        // Add a warning icon next to the link
        const warningIcon = document.createElement('span');
        warningIcon.textContent = '⚠️';
        warningIcon.style.marginLeft = '5px';
        warningIcon.style.color = 'red';
        warningIcon.style.cursor = 'help';
        warningIcon.title = 'This link may be a phishing attempt.';
        link.parentNode.insertBefore(warningIcon, link.nextSibling);

        // Add click confirmation
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const proceed = confirm('Warning: This link may be a phishing attempt. Are you sure you want to proceed?');
            if (proceed) {
                window.location.href = link.href;
            }
        });

        // Add ARIA label for accessibility
        link.setAttribute('aria-label', 'Warning: Potential phishing link');
    }
}

// Function to check a batch of URLs
function checkUrls(urls) {
    // Filter out already checked URLs
    const newUrls = urls.filter(url => !checkedUrls.has(url));
    if (newUrls.length === 0) return;

    // Add URLs to checked set
    newUrls.forEach(url => checkedUrls.add(url));

    // Send a batch request to background.js
    chrome.runtime.sendMessage({ type: 'CHECK_URLS', urls: newUrls }, (results) => {
        console.log('Batch URL check results:', results);

        // Process each link on the page
        document.querySelectorAll('a').forEach(link => {
            const url = link.href;
            if (results[url]) {
                highlightPhishingLink(link, results[url].isPhishing);
            }
        });
    });
}

// Function to get all URLs from links on the page
function getAllLinkUrls() {
    const urls = [];
    document.querySelectorAll('a').forEach(link => {
        const url = link.href;
        if (url.startsWith('http') && !checkedUrls.has(url)) {
            urls.push(url);
        }
    });
    return urls;
}

// Initial check when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const urls = getAllLinkUrls();
    if (urls.length > 0) {
        checkUrls(urls);
    }
});

// Observe DOM changes to check new links dynamically (e.g., for single-page apps)
const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
            const urls = getAllLinkUrls();
            if (urls.length > 0) {
                checkUrls(urls);
            }
        }
    });
});

// Start observing the document for changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Listen for messages from background.js (e.g., for tab updates)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'URL_RESULT') {
        console.log('Content script received URL result:', message);
        // Highlight the current page's URL if it's phishing
        if (message.url === window.location.href) {
            if (message.isPhishing) {
                const warningDiv = document.createElement('div');
                warningDiv.style.position = 'fixed';
                warningDiv.style.top = '10px';
                warningDiv.style.right = '10px';
                warningDiv.style.backgroundColor = 'red';
                warningDiv.style.color = 'white';
                warningDiv.style.padding = '10px';
                warningDiv.style.zIndex = '10000';
                warningDiv.textContent = 'Warning: This page may be a phishing site!';
                document.body.appendChild(warningDiv);
            }
        }
    }
});