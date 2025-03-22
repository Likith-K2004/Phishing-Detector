// This content script injects the sidebar into the webpage
(function() {
    console.log("Sidebar injector script running");
    
    // Check if sidebar already exists
    if (!document.getElementById('phishing-detector-sidebar')) {
        console.log("Creating new sidebar iframe");
        
        // Create iframe for sidebar
        const sidebar = document.createElement('iframe');
        sidebar.id = 'phishing-detector-sidebar';
        sidebar.src = chrome.runtime.getURL('sidebar.html');
        sidebar.style.position = 'fixed';
        sidebar.style.top = '0';
        sidebar.style.right = '-320px'; // Start off-screen
        sidebar.style.width = '320px';
        sidebar.style.height = '100%';
        sidebar.style.zIndex = '2147483647'; // Maximum z-index
        sidebar.style.border = 'none';
        sidebar.style.transition = 'right 0.3s ease-in-out';
        sidebar.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.2)';
        
        // Add to page
        document.body.appendChild(sidebar);
        console.log("Sidebar iframe added to page");
        
        // Make sure it's accessible even if body isn't ready yet
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', function() {
                document.body.appendChild(sidebar);
                console.log("Sidebar iframe added to page after DOM loaded");
            });
        }
    } else {
        console.log("Sidebar already exists, no need to create it again");
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log("Message received in sidebar-injector:", request);
        
        const sidebar = document.getElementById('phishing-detector-sidebar');
        if (!sidebar) {
            console.error("Sidebar element not found");
            sendResponse({status: 'error', message: 'Sidebar not found'});
            return;
        }
        
        // Show sidebar
        if (request.action === 'showSidebar') {
            console.log("Showing sidebar");
            sidebar.style.right = '0';
            sendResponse({status: 'sidebar shown'});
        }
        
        // Hide sidebar
        else if (request.action === 'hideSidebar') {
            console.log("Hiding sidebar");
            sidebar.style.right = '-320px';
            sendResponse({status: 'sidebar hidden'});
        }
        
        return true; // Keep the message channel open for async response
    });
    
    // Also listen for messages from the sidebar iframe
    window.addEventListener('message', function(event) {
        console.log("Window message received:", event.data);
        
        // Verify origin
        if (event.origin !== chrome.runtime.getURL('').slice(0, -1)) {
            console.log("Ignoring message from unknown origin:", event.origin);
            return;
        }
        
        const message = event.data;
        
        // Handle sidebar-specific actions
        if (message.action === 'hideSidebar') {
            console.log("Received hide request from sidebar iframe");
            const sidebar = document.getElementById('phishing-detector-sidebar');
            if (sidebar) {
                sidebar.style.right = '-320px';
                
                // Also notify background script
                chrome.runtime.sendMessage({action: 'hideSidebar'});
            }
        }
    });
    
    console.log("Sidebar injector setup complete");
})();
