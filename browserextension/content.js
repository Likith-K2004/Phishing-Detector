// content.js

// Store checked URLs to avoid duplicate checks
const checkedUrls = new Set();
let pendingUrls = [];
let checkTimeout = null;
const BATCH_DELAY = 3000; // Increase to 3 seconds before sending batch (was 1 second)
const MAX_BATCH_SIZE = 3; // Reduce to maximum 3 URLs to check in one batch (was 5)
const OBSERVER_DEBOUNCE = 3000; // Increase to 3 seconds (was 1 second)

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

// Debounced function to check URLs
function debouncedCheckUrls() {
    if (checkTimeout) {
        clearTimeout(checkTimeout);
    }
    
    checkTimeout = setTimeout(() => {
        if (pendingUrls.length > 0) {
            // Take only a subset of URLs to avoid overwhelming the API
            const urlsToCheck = pendingUrls.slice(0, MAX_BATCH_SIZE);
            pendingUrls = pendingUrls.slice(MAX_BATCH_SIZE);
            
            // If more URLs remain, schedule another check
            if (pendingUrls.length > 0) {
                debouncedCheckUrls();
            }
            
            checkUrls(urlsToCheck);
        }
    }, BATCH_DELAY);
}

// Function to check a batch of URLs with better error handling
function checkUrls(urls) {
    // Add additional filtering to prevent API overload
    if (urls.length === 0) return;
    
    // Respect the global cooldown period
    const now = Date.now();
    if (window.lastRequestTime && (now - window.lastRequestTime < 2000)) {
        console.log('Request cooldown in effect, delaying check...');
        setTimeout(() => checkUrls(urls), 2000);
        return;
    }
    
    window.lastRequestTime = now;

    // Filter out already checked URLs
    const newUrls = urls.filter(url => !checkedUrls.has(url));
    if (newUrls.length === 0) return;

    console.log(`Checking ${newUrls.length} URLs`);

    // Add URLs to checked set
    newUrls.forEach(url => checkedUrls.add(url));

    // Send a batch request to background.js
    chrome.runtime.sendMessage({ type: 'CHECK_URLS', urls: newUrls }, (results) => {
        if (!results) {
            console.error('No results received from background script');
            return;
        }
        
        if (results.error) {
            console.error('Error checking URLs:', results.error);
            // If rate limited, schedule a retry after a longer delay
            if (results.rateLimited) {
                setTimeout(() => {
                    // Put URLs back in the queue
                    newUrls.forEach(url => checkedUrls.delete(url));
                    pendingUrls = [...newUrls, ...pendingUrls]; 
                    debouncedCheckUrls();
                }, 10000); // Increase to 10 seconds before retrying (was 5 seconds)
            }
            return;
        }

        // Process each link on the page
        document.querySelectorAll('a').forEach(link => {
            const url = link.href;
            if (results[url] && results[url].isPhishing) {
                highlightPhishingLink(link, true);
            }
        });
    });
}

// Function to get all URLs from links on the page with smarter filtering
function getAllLinkUrls() {
    const urls = [];
    const maxUrlsToCollect = 10; // Limit to 10 URLs per collection to prevent overwhelming
    
    document.querySelectorAll('a').forEach(link => {
        if (urls.length >= maxUrlsToCollect) return;
        
        const url = link.href;
        // More aggressive filtering
        if (url && 
            url.startsWith('http') && 
            !url.includes('#') && // Skip anchors
            !url.includes('?') && // Skip query parameters for simplicity
            url.length < 200 && // Skip very long URLs
            !checkedUrls.has(url) && 
            !pendingUrls.includes(url)) {
            urls.push(url);
        }
    });
    return urls;
}

// Initial check when the page loads with longer delay
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const urls = getAllLinkUrls();
        if (urls.length > 0) {
            pendingUrls = urls;
            debouncedCheckUrls();
        }
    }, 5000); // Increase to 5 seconds after page load before checking (was 2 seconds)
});

// Less frequent observer with longer debounce
const observer = new MutationObserver((mutations) => {
    // Only check if we find actual link changes
    let hasLinkChanges = false;
    for (const mutation of mutations) {
        if (mutation.type === 'childList' || 
            (mutation.type === 'attributes' && mutation.attributeName === 'href')) {
            hasLinkChanges = true;
            break;
        }
    }
    
    if (!hasLinkChanges) return;
    
    // Debounce DOM changes more aggressively
    if (checkTimeout) {
        clearTimeout(checkTimeout);
    }
    
    checkTimeout = setTimeout(() => {
        const urls = getAllLinkUrls();
        if (urls.length > 0) {
            pendingUrls = [...pendingUrls, ...urls];
            debouncedCheckUrls();
        }
    }, OBSERVER_DEBOUNCE);
});

// Configure observer to be less sensitive
observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: true,
    attributeFilter: ['href'],
    attributeOldValue: false
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