// Set up initial state and listeners
let currentSession = {
    sessionId: generateSessionId(),
    startTime: new Date().toISOString(),
    events: []
};

let PerformanceManager;
let apiKeyHealthInterval;
let tempApiKey = null;

// Listen for tab updates to track navigation
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        handleTabUpdate(tabId, tab);
    }
});

// Listen for Google search navigation
browser.webNavigation.onCompleted.addListener((details) => {
    if (details.url.includes('google.com/search?')) {
        logGeneralAction('google_search', {
            url: details.url,
            timestamp: new Date().toISOString(),
            query: extractSearchQuery(details.url)
        });
    }
}, { url: [{ hostContains: 'google.com' }] });

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'logPageContent':
            logDetailedContent(message.url, message.content, message.type);
            break;
        case 'logUserAction':
            logGeneralAction(message.actionType, message.data);
            break;
        case 'getSessionStats':
            // Synchronous response
            sendResponse({
                sessionId: currentSession.sessionId,
                eventCount: currentSession.events.length,
                startTime: currentSession.startTime
            });
            break;
        case 'getPerformanceManager':
            // Synchronous response
            sendResponse({
                success: true,
                PerformanceManager: {
                    thresholds: {
                        maxContentSize: PerformanceManager?.thresholds?.maxContentSize || 100000,
                        contentProcessingTimeLimit: PerformanceManager?.thresholds?.contentProcessingTimeLimit || 5000
                    },
                    recordContentProcessing: function () { } // Provide a no-op function
                }
            });
            break;
        case 'openSettings':
            // Open the popup
            browser.browserAction.openPopup();
            break;
        case 'getStoredApiKey':
            // Handle this in a way that properly returns the Promise
            (async () => {
                try {
                    const result = await browser.storage.local.get('encrypted_openai_key');
                    sendResponse({
                        hasKey: !!result.encrypted_openai_key,
                        status: 'success'
                    });
                } catch (error) {
                    sendResponse({
                        hasKey: false,
                        status: 'error',
                        error: error.message
                    });
                }
            })();
            return true; // Keep the message channel open for the async response
        case 'apiKeyUnlocked':
            setupApiKeyHealthCheck();
            break;
        case 'storeApiKeyInBackground':
            tempApiKey = message.apiKey;
            sendResponse({ success: true });
            break;

        case 'getApiKeyForSession':
            sendResponse({ apiKey: tempApiKey });
            break;
    }

    // For actions that don't need to return a promise
    if (!['getApiKeyForSession', 'storeApiKeyInBackground', 'getStoredApiKey'].includes(message.action)) {
        return false;
    }

    return true; // Required for async response
});

// Handle tab updates
function handleTabUpdate(tabId, tab) {
    const url = tab.url;

    logGeneralAction('page_visit', {
        url: url,
        title: tab.title,
        timestamp: new Date().toISOString()
    });

    // We'll get page content from the content script
}

// Log general user actions (navigation, clicks, etc.)
function logGeneralAction(actionType, data) {
    const event = {
        type: actionType,
        timestamp: new Date().toISOString(),
        data: data
    };

    currentSession.events.push(event);

    // Save to storage periodically
    if (currentSession.events.length % 10 === 0) {
        saveSessionData();
    }
}


// Import Performance Manager

// Async loading to handle both module contexts and browser contexts
(async function loadDependencies() {
    if (typeof browser !== 'undefined') {
        // In browser context, load via content script
        try {
            // In a real extension, you would load this differently, but for simplicity
            const response = await fetch(browser.runtime.getURL('/utils/performance.js'));
            const text = await response.text();
            // Use Function constructor as a simple way to evaluate the module
            // In a real extension, use import() or a proper bundler
            PerformanceManager = (new Function(text + '; return PerformanceManager;'))();
        } catch (error) {
            console.error('Failed to load PerformanceManager:', error);
            // Fallback empty implementation
            PerformanceManager = {
                recordContentProcessing: () => 0,
                isContentTooLarge: () => false,
                queueStorageOperation: () => false
            };
        }
    } else if (typeof require !== 'undefined') {
        // In Node.js context
        PerformanceManager = require('./utils/performance');
    }
})();

// Then modify the logDetailedContent function to use PerformanceManager
function logDetailedContent(url, content, type) {
    // Check content size
    if (PerformanceManager && PerformanceManager.isContentTooLarge(content)) {
        console.warn(`Content for ${url} is too large, truncating`);
        if (typeof content === 'string') {
            content = content.substring(0, PerformanceManager.thresholds.maxContentSize) +
                "... [content truncated due to size]";
        } else if (content && typeof content === 'object') {
            // For objects, stringify then truncate
            const jsonStr = JSON.stringify(content);
            if (jsonStr.length > PerformanceManager.thresholds.maxContentSize) {
                content = JSON.parse(jsonStr.substring(0, PerformanceManager.thresholds.maxContentSize) +
                    '"... [content truncated due to size]"}');
            }
        }
    }

    // Start timing content processing
    const startTime = Date.now();

    // Try to queue the operation for batched processing
    if (PerformanceManager && PerformanceManager.queueStorageOperation({
        type: 'set',
        data: {
            'detailedLogs': [
                {
                    url: url,
                    timestamp: new Date().toISOString(),
                    type: type,
                    content: content
                }
            ]
        }
    })) {
        // If successfully queued, we're done
        return;
    }

    // Otherwise, continue with immediate storage
    browser.storage.local.get('detailedLogs', (result) => {
        const logs = result.detailedLogs || [];
        logs.push({
            url: url,
            timestamp: new Date().toISOString(),
            type: type,
            content: content
        });

        // Limit the size of detailed logs to avoid performance issues
        while (JSON.stringify(logs).length > 50 * 1024 * 1024) { // 50 MB limit
            logs.shift();
        }

        browser.storage.local.set({ detailedLogs: logs });
    });

    // Record processing time
    if (PerformanceManager) {
        PerformanceManager.recordContentProcessing(startTime);
    }
}

// Helper functions
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function extractSearchQuery(url) {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('q') || '';
}

function saveSessionData() {
    browser.storage.local.get('sessions', (result) => {
        const sessions = result.sessions || [];

        // Find if current session already exists
        const existingSessionIndex = sessions.findIndex(s => s.sessionId === currentSession.sessionId);

        if (existingSessionIndex !== -1) {
            sessions[existingSessionIndex] = currentSession;
        } else {
            sessions.push(currentSession);
        }

        browser.storage.local.set({ sessions });
    });
}

// Initialize storage
browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.set({
        sessions: [],
        detailedLogs: [],
        settings: {
            contentCapture: true,
            logLevel: 'detailed'
        }
    });
});

// Check API key health every 24 hours if it's in use

// Set up the interval when an API key is first used
function setupApiKeyHealthCheck() {
    if (apiKeyHealthInterval) {
        clearInterval(apiKeyHealthInterval);
    }

    apiKeyHealthInterval = setInterval(async () => {
        // Only check if we have an active key
        const hasKey = sessionStorage.getItem('openai_key_temp');
        if (!hasKey) return;

        try {
            // Get the key from session storage
            const apiKey = sessionStorage.getItem('openai_key_temp');

            // Simple health check request
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                // Key might be revoked or invalid
                const error = await response.json();
                console.warn('API key health check failed:', error.error?.message);

                // Notify the user
                browser.notifications.create({
                    type: 'basic',
                    iconUrl: browser.runtime.getURL('icons/icon-48.png'),
                    title: 'OpenAI API Key Issue',
                    message: 'There may be an issue with your API key. Please check your settings.'
                });

                // Clear the invalid key
                sessionStorage.removeItem('openai_key_temp');
            }
        } catch (error) {
            console.error('API key health check error:', error);
        }
    }, 24 * 60 * 60 * 1000); // Check once a day
}

// Listen for message from the settings page when key is unlocked
browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'apiKeyUnlocked') {
        setupApiKeyHealthCheck();
    }
});

// Initialize when extension is loaded
browser.runtime.onStartup.addListener(() => {
    // Check if we have a key in session storage
    if (sessionStorage.getItem('openai_key_temp')) {
        setupApiKeyHealthCheck();
    }
});