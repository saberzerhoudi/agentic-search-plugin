// Track Google search results page
(function () {
    // Avoid multiple executions
    if (window.googleSearchTrackerInitialized) return;
    window.googleSearchTrackerInitialized = true;

    let openAIService;
    let extensionSettings = null;
    const defaultExtensionSettings = {
        serpAgent: true,
        scrapingAgent: true,
        factCheckingAgent: false,
        allowedDomains: ''
    };
    // Function to dynamically import the OpenAI service
    async function importOpenAIService() {
        try {
            const module = await import(chrome.runtime.getURL('/utils/openai-service.js'));
            openAIService = module.openAIService;
            return true;
        } catch (error) {
            console.error('Failed to import OpenAI service:', error);
            return false;
        }
    }

    // Listen for messages (e.g., when API key is unlocked)
    browser.runtime.onMessage.addListener(async (message) => {
        if (message.action === 'apiKeyUnlocked') {
            console.log("API key has been unlocked. Retrying query refinement...");
            // Get the current query
            const originalQuery = getSearchQuery();
            if (originalQuery && originalQuery !== 'Unknown Query') {
                const refinedQuery = await refineQuery(originalQuery);
                if (refinedQuery && refinedQuery !== originalQuery) {
                    applyRefinedQuery(refinedQuery);

                    // Log the refinement
                    browser.runtime.sendMessage({
                        action: 'logUserAction',
                        actionType: 'query_refinement',
                        data: {
                            originalQuery,
                            refinedQuery,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }
        }
        if (message.action === 'settingsChanged') {
            try {
                const s = message.settings || {};
                extensionSettings = { ...defaultExtensionSettings, ...s };
            } catch (_) { }
        }
    });

    // Extract search query
    function getSearchQuery() {
        // Method 1: Get from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const queryFromUrl = urlParams.get('q');
        if (queryFromUrl) return queryFromUrl;

        // Method 2: Get from input field (Google keeps the query in the search input)
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput && searchInput.value) return searchInput.value;

        // Method 3: Get from title (Google includes the query in the page title)
        const titleMatch = document.title.match(/^(.+?) - Google Search$/);
        if (titleMatch && titleMatch[1]) return titleMatch[1];

        // Fallback
        return 'Unknown Query';
    }

    // Notification to prompt the user to set up their API key
    function notifyAPIKeyRequired() {
        // Check if notification already exists
        if (document.getElementById('api-key-notification')) return;

        // Create the toast notification container if it doesn't exist
        let toastContainer = document.getElementById('st-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'st-toast-container';
            toastContainer.className = 'st-ui';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                z-index: 9999;
                max-width: 380px;
                width: calc(100% - 40px);
            `;
            document.body.appendChild(toastContainer);
        }

        // Create notification with proper shadcn styling
        const notification = document.createElement('div');
        notification.id = 'api-key-notification';
        notification.className = 'st-toast';
        notification.style.cssText = `
            background-color: var(--st-card);
            color: var(--st-card-fg);
            border: 1px solid var(--st-border);
            border-radius: var(--st-border-radius);
            box-shadow: var(--st-shadow-lg);
            padding: 16px;
            transition: all 0.3s var(--st-spring);
            transform: translateY(10px);
            opacity: 0;
            overflow: hidden;
            position: relative;
        `;

        // Add a subtle gradient border
        const gradientBorder = document.createElement('div');
        gradientBorder.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #7c3aed, #3b82f6);
        `;
        notification.appendChild(gradientBorder);

        // Header container with icon
        const headerContainer = document.createElement('div');
        headerContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        `;

        // Icon for the notification
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '16');
        iconSvg.setAttribute('height', '16');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.setAttribute('stroke', 'currentColor');
        iconSvg.setAttribute('stroke-width', '2');
        iconSvg.setAttribute('stroke-linecap', 'round');
        iconSvg.setAttribute('stroke-linejoin', 'round');

        const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        iconPath.setAttribute('d', 'M12 16v-4m0-4h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z');

        iconSvg.appendChild(iconPath);

        // Title
        const titleElement = document.createElement('span');
        titleElement.textContent = 'AI Query Refinement';
        titleElement.style.cssText = 'font-weight: 600; font-size: 14px;';

        headerContainer.appendChild(iconSvg);
        headerContainer.appendChild(titleElement);

        // Message with improved typography
        const messageElement = document.createElement('p');
        messageElement.textContent = 'To use the query refinement feature, please set up your OpenAI API key in the extension settings.';
        messageElement.style.cssText = `
            margin: 0 0 14px 0;
            font-size: 14px;
            line-height: 1.5;
            color: var(--st-muted-fg);
        `;

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        `;

        // Open Settings button
        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        openBtn.className = 'st-button st-button-primary';
        openBtn.style.cssText = 'min-width: 0; padding: 0 12px; height: 32px; font-size: 12px;';
        openBtn.textContent = 'Open Settings';

        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.id = 'dismiss-notification';
        dismissBtn.className = 'st-button st-button-secondary';
        dismissBtn.style.cssText = 'min-width: 0; padding: 0 12px; height: 32px; font-size: 12px;';
        dismissBtn.textContent = 'Dismiss';

        buttonContainer.appendChild(dismissBtn);
        buttonContainer.appendChild(openBtn);

        // Construct the notification
        notification.appendChild(headerContainer);
        notification.appendChild(messageElement);
        notification.appendChild(buttonContainer);

        // Add to toast container
        toastContainer.appendChild(notification);

        // Animate in after a short delay
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
            notification.style.opacity = '1';
        }, 10);

        // Add event listeners
        openBtn.addEventListener('click', function () {
            browser.runtime.sendMessage({ action: 'openSettings' });
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        });

        dismissBtn.addEventListener('click', function () {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto dismiss after 8 seconds
        setTimeout(() => {
            if (document.getElementById('api-key-notification')) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(10px)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 8000);
    }

    // Refine search query using GPT-4o
    async function refineQuery(query) {
        try {
            // Make sure service is imported
            if (!openAIService) {
                console.log("Importing OpenAI service...");
                const imported = await importOpenAIService();
                if (!imported) {
                    console.error("Failed to import OpenAI service");
                    return null;
                }
            }

            console.log("Checking for initialized API key...");

            // First check if we already have an initialized key
            const initialized = await openAIService.tryInitializeFromSession();
            if (!initialized) {
                console.log("API key not initialized, checking if stored...");

                // Check if a key exists but is locked
                const hasStoredKey = await openAIService.checkForStoredKey();

                if (hasStoredKey) {
                    console.log("API key exists but is locked");
                    notifyAPIKeyLocked();
                } else {
                    console.log("No API key found");
                    notifyAPIKeyRequired();
                }
                return null;
            }

            console.log("API key is initialized, attempting query refinement");

            // Attempt to refine the query
            const refined = await openAIService.refineSearchQuery(query);
            try { sessionStorage.setItem('st_last_refined_query', refined || ''); } catch(_) {}
            return refined;
        } catch (error) {
            console.error('Query refinement failed:', error);
            return null;
        }
    }

    // notification to prompt the user to unlock their API key
    function notifyAPIKeyLocked() {
        // Check if notification already exists
        if (document.getElementById('api-key-notification')) return;

        // Create the toast notification container if it doesn't exist
        let toastContainer = document.getElementById('st-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'st-toast-container';
            toastContainer.className = 'st-ui';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
            gap: 8px;
            z-index: 9999;
            max-width: 380px;
            width: calc(100% - 40px);
        `;
            document.body.appendChild(toastContainer);
        }

        // Create notification with proper shadcn styling
        const notification = document.createElement('div');
        notification.id = 'api-key-notification';
        notification.className = 'st-toast';
        notification.style.cssText = `
        background-color: var(--st-card);
        color: var(--st-card-fg);
        border: 1px solid var(--st-border);
        border-radius: var(--st-border-radius);
        box-shadow: var(--st-shadow-lg);
        padding: 16px;
        transition: all 0.3s var(--st-spring);
        transform: translateY(10px);
        opacity: 0;
        overflow: hidden;
        position: relative;
    `;

        // Add a subtle gradient border
        const gradientBorder = document.createElement('div');
        gradientBorder.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, #f59e0b, #ef4444);
    `;
        notification.appendChild(gradientBorder);

        // Header container with icon
        const headerContainer = document.createElement('div');
        headerContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    `;

        // Icon for the notification - lock icon
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '16');
        iconSvg.setAttribute('height', '16');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.setAttribute('stroke', 'currentColor');
        iconSvg.setAttribute('stroke-width', '2');
        iconSvg.setAttribute('stroke-linecap', 'round');
        iconSvg.setAttribute('stroke-linejoin', 'round');

        const iconPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        iconPath1.setAttribute('x', '3');
        iconPath1.setAttribute('y', '11');
        iconPath1.setAttribute('width', '18');
        iconPath1.setAttribute('height', '11');
        iconPath1.setAttribute('rx', '2');
        iconPath1.setAttribute('ry', '2');

        const iconPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        iconPath2.setAttribute('d', 'M7 11V7a5 5 0 0110 0v4');

        iconSvg.appendChild(iconPath1);
        iconSvg.appendChild(iconPath2);

        // Title
        const titleElement = document.createElement('span');
        titleElement.textContent = 'API Key Locked';
        titleElement.style.cssText = 'font-weight: 600; font-size: 14px;';

        headerContainer.appendChild(iconSvg);
        headerContainer.appendChild(titleElement);

        // Message with improved typography
        const messageElement = document.createElement('p');
        messageElement.textContent = 'Your API key is stored but locked. Please unlock it in settings to use query refinement.';
        messageElement.style.cssText = `
        margin: 0 0 14px 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--st-muted-fg);
    `;

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    `;

        // Open Settings button
        const openBtn = document.createElement('button');
        openBtn.id = 'open-settings';
        openBtn.className = 'st-button st-button-primary';
        openBtn.style.cssText = 'min-width: 0; padding: 0 12px; height: 32px; font-size: 12px;';
        openBtn.textContent = 'Open Settings';

        // Dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.id = 'dismiss-notification';
        dismissBtn.className = 'st-button st-button-secondary';
        dismissBtn.style.cssText = 'min-width: 0; padding: 0 12px; height: 32px; font-size: 12px;';
        dismissBtn.textContent = 'Dismiss';

        buttonContainer.appendChild(dismissBtn);
        buttonContainer.appendChild(openBtn);

        // Construct the notification
        notification.appendChild(headerContainer);
        notification.appendChild(messageElement);
        notification.appendChild(buttonContainer);

        // Add to toast container
        toastContainer.appendChild(notification);

        // Animate in after a short delay
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
            notification.style.opacity = '1';
        }, 10);

        // Add event listeners
        openBtn.addEventListener('click', function () {
            browser.runtime.sendMessage({ action: 'openSettings' });
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        });

        dismissBtn.addEventListener('click', function () {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto dismiss after 8 seconds
        setTimeout(() => {
            if (document.getElementById('api-key-notification')) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(10px)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 8000);
    }

    // Apply the refined query to the search box
    function applyRefinedQuery(refinedQuery) {
        if (!refinedQuery) return;

        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput) {
            // Set the input value
            searchInput.value = refinedQuery;

            // Create a suggestion element
            showQuerySuggestion(refinedQuery);
        }
    }

    // Show a suggestion UI element for the refined query
    function showQuerySuggestion(refinedQuery) {
        // Remove any existing suggestion UI
        const existingSuggestion = document.getElementById('ai-query-suggestion');
        if (existingSuggestion) {
            existingSuggestion.remove();
        }

        // First, create the floating AI assistant button that's always visible
        createAssistantButton();

        // Then show the suggestion with animation
        animateSuggestion(refinedQuery);
    }

    // Create the floating AI assistant button
    function createAssistantButton() {
        if (document.getElementById('ai-assistant-button')) return;

        // Add shadcn-inspired styles - more comprehensive styling
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* Improved Modern UI Design System - shadcn UI inspired */
            :root {
                /* Base colors */
                --st-bg: #ffffff;
                --st-fg: #030712;
                
                /* Component colors */
                --st-card: #ffffff;
                --st-card-fg: #030712;
                --st-primary: #18181b;
                --st-primary-fg: #ffffff;
                --st-secondary: #f4f4f5;
                --st-secondary-fg: #18181b;
                --st-accent: #f0f9ff;
                --st-accent-fg: #0f172a;
                --st-destructive: #ef4444;
                --st-destructive-fg: #ffffff;
                --st-muted: #f4f4f5;
                --st-muted-fg: #71717a;
                
                /* Border */
                --st-border: #e4e4e7;
                --st-border-radius: 0.5rem;
                
                /* Shadows */
                --st-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
                --st-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
                --st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --st-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                
                /* Motion */
                --st-spring: cubic-bezier(0.2, 0.8, 0.2, 1);
            }
    
            /* Dark mode values */
            @media (prefers-color-scheme: dark) {
                :root {
                    --st-bg: #09090b;
                    --st-fg: #f2f2f2;
                    
                    --st-card: #18181b;
                    --st-card-fg: #f2f2f2;
                    --st-primary: #f2f2f2;
                    --st-primary-fg: #09090b;
                    --st-secondary: #27272a;
                    --st-secondary-fg: #f2f2f2;
                    --st-accent: #18181b;
                    --st-accent-fg: #f2f2f2;
                    --st-destructive: #ef4444;
                    --st-destructive-fg: #f2f2f2;
                    --st-muted: #27272a;
                    --st-muted-fg: #a1a1aa;
                    
                    --st-border: #27272a;
                    
                    --st-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
                    --st-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.3);
                    --st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
                    --st-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
                }
            }
    
            /* Base reset and typographic improvements */
            .st-ui * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
    
            /* Enhanced animations */
            @keyframes st-pulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.05); opacity: 0.4; }
                100% { transform: scale(1); opacity: 0.7; }
            }
            
            @keyframes st-shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            @keyframes st-floating {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-4px); }
                100% { transform: translateY(0px); }
            }
            
            @keyframes st-fade-in {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes st-bounce {
                0%, 100% { transform: translateY(0); }
                40% { transform: translateY(-6px); }
                60% { transform: translateY(-3px); }
            }
    
            /* Assistant Button - More polished with better states */
            .st-assistant-button {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 48px;
                height: 48px;
                border-radius: 24px;
                background-color: var(--st-primary);
                color: var(--st-primary-fg);
                box-shadow: var(--st-shadow-md);
                z-index: 1000;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                overflow: hidden;
                transition: all 0.3s var(--st-spring);
            }
            
            .st-assistant-button:hover {
                transform: translateY(-2px);
                box-shadow: var(--st-shadow-lg);
                background-color: #222;
            }
            
            .st-assistant-button:active {
                transform: translateY(0);
            }
            
            .st-assistant-button:focus-visible {
                outline: 2px solid var(--st-accent);
                outline-offset: 2px;
            }
            
            .st-pulse-container {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                border-radius: 24px;
                pointer-events: none;
            }
            
            .st-pulse {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 70%);
                animation: st-pulse 2s infinite;
            }
            
            .st-icon {
                position: relative;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                overflow: hidden;
            }
            
            .st-icon img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
            
            /* Dialog icon needs to be slightly bigger */
            .st-dialog-icon img {
                width: 24px;
                height: 24px;
            }
    
            /* Dialog styling - much more sophisticated */
            .st-dialog {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 48px;
                height: 48px;
                background-color: var(--st-card);
                color: var(--st-card-fg);
                border-radius: 24px;
                border: 1px solid var(--st-border);
                box-shadow: var(--st-shadow-lg);
                z-index: 1001;
                display: flex;
                transition: all 0.35s var(--st-spring);
                overflow: hidden;
            }
            
            .st-dialog.expanded {
                width: 420px;
                height: auto;
                max-height: 70vh;
                border-radius: var(--st-border-radius);
            }
            
            .st-dialog-icon {
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .st-dialog-content {
                flex: 1;
                opacity: 0;
                visibility: hidden;
                display: flex;
                flex-direction: column;
                padding: 14px 16px 14px 10px;
                transition: opacity 0.2s ease, visibility 0.2s ease;
                transform: translateX(10px);
            }
            
            .st-dialog.expanded .st-dialog-content {
                opacity: 1;
                visibility: visible;
                transform: translateX(0);
                transition-delay: 0.1s;
            }
            
            .st-message-container {
                flex: 1;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .st-message { font-size: 14px; line-height: 1.5; color: var(--st-card-fg); letter-spacing: -0.011em; font-weight: 500; margin-bottom: 8px; }
            .st-divider { height: 1px; background: var(--st-border); margin: 8px 0; }
            .st-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
            .st-header-title { font-weight: 600; font-size: 13px; color: var(--st-muted-fg); }
            
            .st-query {
                font-weight: 500;
                font-size: 15px;
                line-height: 1.4;
                color: var(--st-primary);
                background-color: var(--st-accent);
                border-radius: 3px;
                padding: 4px 6px;
                margin-top: 8px;
                border-left: 2px solid var(--st-primary);
                display: block;
            }
            
            .st-actions {
                display: flex;
                gap: 8px;
                margin-top: auto;
            }
            .st-thinking-steps {
                margin-top: 8px;
            }
            .st-thinking-step {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                font-style: italic;
                color: var(--st-muted-fg);
                font-size: 13px;
                margin: 2px 0;
            }
            .st-agent-icon {
                width: 14px;
                height: 14px;
                flex-shrink: 0;
                margin-top: 2px;
                color: var(--st-muted-fg);
            }
            .st-agent-result { margin-top: 8px; font-size: 13px; color: var(--st-card-fg); }
            .st-agent-result .line { padding: 6px 8px; border-radius: 6px; background: var(--st-secondary); margin-top: 6px; }
            .st-tag {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 8px;
                background: var(--st-accent);
                color: var(--st-accent-fg);
                font-size: 11px;
                margin-left: 6px;
            }
            /* Relevant snippet highlight on SERP */
            .st-relevant-snippet {
                background: rgba(79, 70, 229, 0.08);
                border-radius: 6px;
                padding: 4px 6px;
            }
            
            /* Button styling - matches shadcn buttons precisely */
            .st-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--st-border-radius);
                font-weight: 500;
                font-size: 13px;
                height: 36px;
                padding: 0 16px;
                transition: all 0.2s ease;
                cursor: pointer;
                white-space: nowrap;
                line-height: 1;
                border: none;
                box-shadow: var(--st-shadow-sm);
                position: relative;
                overflow: hidden;
            }
            
            .st-button:active {
                transform: translateY(1px);
            }
            
            .st-button-primary {
                background-color: var(--st-primary);
                color: var(--st-primary-fg);
            }
            
            .st-button-primary:hover {
                background-color: #000;
            }
            
            .st-button-primary:focus-visible {
                outline: 2px solid var(--st-accent);
                outline-offset: 2px;
            }
            
            .st-button-secondary {
                background-color: var(--st-secondary);
                color: var(--st-secondary-fg);
            }
            
            .st-button-secondary:hover {
                background-color: #e5e5e5;
            }
            
            /* Thinking animation - more subtle and sophisticated */
            .st-thinking {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
                gap: 4px;
                animation: st-floating 2s infinite ease-in-out;
            }
            
            .st-dot {
                width: 5px;
                height: 5px;
                background-color: var(--st-card-fg);
                border-radius: 50%;
                opacity: 0.7;
            }
            
            .st-dot:nth-child(1) { animation: st-bounce 1.4s infinite 0s ease-in-out; }
            .st-dot:nth-child(2) { animation: st-bounce 1.4s infinite 0.2s ease-in-out; }
            .st-dot:nth-child(3) { animation: st-bounce 1.4s infinite 0.4s ease-in-out; }
        `;
        document.head.appendChild(styleElement);

        // Create the button with proper structure
        const buttonContainer = document.createElement('button');
        buttonContainer.id = 'ai-assistant-button';
        buttonContainer.className = 'st-assistant-button st-ui';
        buttonContainer.setAttribute('aria-label', 'AI Assistant');

        // Pulse animation container
        const pulseContainer = document.createElement('div');
        pulseContainer.className = 'st-pulse-container';

        const pulseEffect = document.createElement('div');
        pulseEffect.className = 'st-pulse';
        pulseContainer.appendChild(pulseEffect);

        // Icon container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'st-icon';

        // Create robot image element
        const robotImage = document.createElement('img');
        robotImage.src = chrome.runtime.getURL('/assets/robot-icon.png');
        robotImage.alt = 'AI Assistant';

        iconContainer.appendChild(robotImage);

        buttonContainer.appendChild(pulseContainer);
        buttonContainer.appendChild(iconContainer);
        document.body.appendChild(buttonContainer);

        // Toggle suggestion visibility when clicked
        buttonContainer.addEventListener('click', () => {
            const suggestionDialog = document.getElementById('ai-suggestion-dialog');
            if (!suggestionDialog) {
                // If removed, recreate by re-running animateSuggestion with last query (if any)
                const lastQuery = sessionStorage.getItem('st_last_refined_query') || getSearchQuery();
                animateSuggestion(lastQuery || '');
                return;
            }
            if (suggestionDialog.classList.contains('expanded')) {
                suggestionDialog.classList.remove('expanded');
            } else {
                suggestionDialog.classList.add('expanded');
            }
        });

        // Make sure the button is always visible
        createObserver(buttonContainer);
    }

    // Create a new observer to ensure the button stays visible
    function createObserver(buttonElement) {
        // Check every second to make sure the button is in the DOM
        setInterval(() => {
            if (!document.getElementById('ai-assistant-button') && !document.getElementById('ai-suggestion-dialog')) {
                document.body.appendChild(buttonElement);
            }
        }, 1000);
    }

    // Animate the suggestion to expand from the button
    function animateSuggestion(refinedQuery) {
        // Get the button instance
        const buttonContainer = document.getElementById('ai-assistant-button');
        if (!buttonContainer) return;

        // Remove existing suggestion dialog if present
        const existingDialog = document.getElementById('ai-suggestion-dialog');
        if (existingDialog) existingDialog.remove();

        // Create the dialog with improved structure
        const suggestionDialog = document.createElement('div');
        suggestionDialog.id = 'ai-suggestion-dialog';
        suggestionDialog.className = 'st-dialog st-ui';

        // Create the thinking animation dots - improved version
        const thinkingContainer = document.createElement('div');
        thinkingContainer.className = 'st-thinking';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'st-dot';
            thinkingContainer.appendChild(dot);
        }

        suggestionDialog.appendChild(thinkingContainer);
        document.body.appendChild(suggestionDialog);

        // Hide the original button while suggestion is active
        buttonContainer.style.display = 'none';

        // After a short delay, show the suggestion content
        setTimeout(() => {
            // Remove thinking dots
            thinkingContainer.remove();

            // Create header with icon and title
            const iconContainer = document.createElement('div');
            iconContainer.className = 'st-dialog-icon';

            // Use the robot image instead of SVG
            const robotImage = document.createElement('img');
            robotImage.src = chrome.runtime.getURL('/assets/robot-icon.png'); // Make sure this path is correct
            robotImage.alt = 'AI Assistant';

            iconContainer.appendChild(robotImage);

            // Create the content container with improved structure
            const contentContainer = document.createElement('div');
            contentContainer.className = 'st-dialog-content';
            contentContainer.style.maxHeight = '70vh';
            contentContainer.style.overflowY = 'auto';

            // Message container for better organization
            const messageContainer = document.createElement('div');
            messageContainer.className = 'st-message-container';

            const headerRow = document.createElement('div');
            headerRow.className = 'st-header';
            const headerTitle = document.createElement('div');
            headerTitle.className = 'st-header-title';
            headerTitle.textContent = 'Assistant';
            headerRow.appendChild(headerTitle);
            messageContainer.appendChild(headerRow);

            // Only show query suggestion when the user is at the query formulation step
            const isQueryFormulation = !!document.querySelector('form input[name="q"]');
            if (isQueryFormulation) {
                const messageEl = document.createElement('div');
                messageEl.className = 'st-message';
                messageEl.textContent = 'I found a better search query:';

                const queryEl = document.createElement('div');
                queryEl.className = 'st-query';
                queryEl.textContent = refinedQuery;

                messageContainer.appendChild(messageEl);
                messageContainer.appendChild(queryEl);
            }

            // Thinking steps and agent decisions
            const thinkingStepsContainer = document.createElement('div');
            thinkingStepsContainer.className = 'st-thinking-steps';

            const steps = buildAgentDecisionSteps();
            steps.forEach((text) => {
                const row = document.createElement('div');
                row.className = 'st-thinking-step';
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.setAttribute('class', 'st-agent-icon');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                // Simple agent head: circle + shoulders
                path.setAttribute('d', 'M12 4a4 4 0 110 8 4 4 0 010-8zm6 12c0-2.21-3.58-4-6-4s-6 1.79-6 4v2h12v-2z');
                path.setAttribute('fill', 'currentColor');
                icon.appendChild(path);
                const textNode = document.createElement('span');
                textNode.style.flex = '1';
                let i = 0;
                const typer = setInterval(() => {
                    textNode.textContent = text.slice(0, i++);
                    if (i > text.length) clearInterval(typer);
                }, 12 + Math.min(40, Math.round(Math.random() * 12)));
                row.appendChild(icon);
                row.appendChild(textNode);
                messageContainer.appendChild(row);
            });
            

            // Action buttons with improved styling
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'st-actions';

            // Use button with icon
            const useBtn = document.createElement('button');
            useBtn.className = 'st-button st-button-primary';

            // Add an icon to the button
            const useBtnContent = document.createElement('span');
            useBtnContent.style.display = 'flex';
            useBtnContent.style.alignItems = 'center';
            useBtnContent.style.gap = '6px';

            // Search icon
            const searchSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            searchSvg.setAttribute('width', '14');
            searchSvg.setAttribute('height', '14');
            searchSvg.setAttribute('viewBox', '0 0 24 24');
            searchSvg.setAttribute('fill', 'none');
            searchSvg.setAttribute('stroke', 'currentColor');
            searchSvg.setAttribute('stroke-width', '2');
            searchSvg.setAttribute('stroke-linecap', 'round');
            searchSvg.setAttribute('stroke-linejoin', 'round');

            const searchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            searchPath.setAttribute('d', 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z');

            searchSvg.appendChild(searchPath);

            const useBtnText = document.createTextNode('Use Suggestion');
            useBtnContent.appendChild(searchSvg);
            useBtnContent.appendChild(useBtnText);
            useBtn.appendChild(useBtnContent);

            // Dismiss button
            const dismissBtn = document.createElement('button');
            dismissBtn.className = 'st-button st-button-secondary';
            dismissBtn.textContent = 'Dismiss';

            actionsContainer.appendChild(useBtn);
            actionsContainer.appendChild(dismissBtn);

            contentContainer.appendChild(messageContainer);
            contentContainer.appendChild(actionsContainer);

            suggestionDialog.appendChild(iconContainer);
            suggestionDialog.appendChild(contentContainer);

            // Expand the dialog with animation
            setTimeout(() => {
                suggestionDialog.classList.add('expanded');
            }, 100);

            // Invoke enabled agents with simple implementations and show thinking
            invokeAgentsAndReport(messageContainer);

            // Button handlers
            useBtn.addEventListener('click', () => {
                const searchInput = document.querySelector('input[name="q"]');
                if (searchInput) {
                    searchInput.value = refinedQuery;
                    // Automatically submit the form
                    const searchForm = searchInput.closest('form');
                    if (searchForm) searchForm.submit();
                }
                collapseSuggestion();
            });

            dismissBtn.addEventListener('click', () => {
                collapseSuggestion();
            });
        }, 1500); // Thinking animation duration
    }

    // Collapse the suggestion dialog and show the button again
    function collapseSuggestion() {
        const suggestionDialog = document.getElementById('ai-suggestion-dialog');
        const buttonContainer = document.getElementById('ai-assistant-button');

        if (suggestionDialog) {
            // Animate closing
            suggestionDialog.classList.remove('expanded');

            // Remove after animation
            setTimeout(() => {
                suggestionDialog.remove();
                // Show the original button again
                if (buttonContainer) buttonContainer.style.display = 'flex';
            }, 300);
        }
    }

    // Extract search results - robust selectors across SERP variants
    function extractSearchResults() {
        const results = [];
        const containers = document.querySelectorAll('div.g, div.MjjYud, div.srg > div.g');
        containers.forEach((element, index) => {
            // title & url
            const linkElement = element.querySelector('a[href^="http"]');
            const titleElement = element.querySelector('h3');
            // snippet candidates
            let snippetElement = element.querySelector('div.VwiC3b');
            if (!snippetElement) snippetElement = element.querySelector('div[data-content-feature="1"]');
            if (!snippetElement) snippetElement = element.querySelector('span.aCOpRe');
            if (!snippetElement) snippetElement = element.querySelector('div[role="heading"][aria-level="3"] + div');

            if (titleElement && linkElement) {
                results.push({
                    position: index + 1,
                    title: titleElement.textContent.trim(),
                    url: linkElement.href,
                    snippet: snippetElement ? snippetElement.textContent.trim() : ''
                });
            }
        });
        return results;
    }

    // Log search page data
    function logSearchPage() {
        const query = getSearchQuery();
        const results = extractSearchResults();
        const content = document.documentElement.outerHTML;

        browser.runtime.sendMessage({
            action: 'logUserAction',
            actionType: 'search_results_view',
            data: {
                query: query,
                resultsCount: results.length,
                timestamp: new Date().toISOString(),
                results: results
            }
        });

        browser.runtime.sendMessage({
            action: 'logPageContent',
            url: window.location.href,
            type: 'google_serp',
            content: content
        });
    }

    // Track result clicks
    function setupResultClickTracking() {
        document.addEventListener('click', (event) => {
            let target = event.target;

            // Find closest anchor
            while (target && target.tagName !== 'A') {
                target = target.parentElement;
            }

            if (target && target.href && !target.href.startsWith('javascript:')) {
                browser.runtime.sendMessage({
                    action: 'logUserAction',
                    actionType: 'search_result_click',
                    data: {
                        url: target.href,
                        text: target.textContent.trim(),
                        timestamp: new Date().toISOString(),
                        query: getSearchQuery()
                    }
                });
            }
        });
    }

    // Track pagination
    function setupPaginationTracking() {
        const paginationElement = document.getElementById('navcnt');
        if (paginationElement) {
            paginationElement.addEventListener('click', (event) => {
                browser.runtime.sendMessage({
                    action: 'logUserAction',
                    actionType: 'search_pagination',
                    data: {
                        query: getSearchQuery(),
                        timestamp: new Date().toISOString()
                    }
                });
            });
        }
    }

    // Initialize tracking
    async function init() {
        try {
            // Import OpenAI service first
            await importOpenAIService();

            // Give the page time to fully render
            setTimeout(async () => {
                try {
                    // Get the current query
                    const originalQuery = getSearchQuery();

                    // Log the page first
                    logSearchPage();

                    // Set up tracking
                    setupResultClickTracking();
                    setupPaginationTracking();

                    // Only attempt query refinement if there's a non-empty query
                    if (originalQuery && originalQuery !== 'Unknown Query') {
                        // Check if we have access to the OpenAI API key in this session
                        const refinedQuery = await refineQuery(originalQuery);
                        if (refinedQuery && refinedQuery !== originalQuery) {
                            applyRefinedQuery(refinedQuery);

                            // Log the refinement
                            browser.runtime.sendMessage({
                                action: 'logUserAction',
                                actionType: 'query_refinement',
                                data: {
                                    originalQuery,
                                    refinedQuery,
                                    timestamp: new Date().toISOString()
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error in Google search tracking:", error);
                }
            }, 1000);

            // Track changes in results (for infinite scroll or dynamic content)
            const observer = new MutationObserver(debounce(() => {
                logSearchPage();
            }, 1000));

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (error) {
            console.error("Failed to initialize Google search tracking:", error);
        }
    }

    // Utility: Debounce function to avoid excessive logging
    function debounce(func, delay) {
        let timeout;
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // Start tracking
    init();

    // Load settings from storage
    async function loadExtensionSettings() {
        try {
            const result = await browser.storage.local.get('settings');
            const s = (result && result.settings) ? result.settings : {};
            extensionSettings = { ...defaultExtensionSettings, ...s };
        } catch (e) {
            extensionSettings = { ...defaultExtensionSettings };
        }
    }

    // Robust SERP detection across Google layouts/TLDs
    function isOnSerp() {
        try {
            const u = new URL(location.href);
            const hostIsGoogle = /google\./.test(u.hostname);
            const pathLooksSerp = u.pathname.startsWith('/search');
            const structural = document.querySelector('#search') || document.querySelector('div.g, div.MjjYud, div.srg > div.g');
            return Boolean(structural) || (hostIsGoogle && pathLooksSerp);
        } catch (_) {
            const structural = document.querySelector('#search') || document.querySelector('div.g, div.MjjYud, div.srg > div.g');
            return Boolean(structural);
        }
    }

    // Build list of decision steps (strings)
    function buildAgentDecisionSteps() {
        const steps = [];
        const isSerp = isOnSerp();
        const s = extensionSettings || defaultExtensionSettings;
        if (s.serpAgent) {
            steps.push(' Consider SERP Agent — ' + (isSerp ? 'SERP detected; will highlight likely relevant results.' : 'Not on search results; skipping.'));
        } else {
            steps.push('SERP Agent disabled in settings; skipping.');
        }

        if (s.scrapingAgent) {
            steps.push('Consider Scraping Agent — Will gather key text snippets for quick context.');
        } else {
            steps.push('Scraping Agent disabled in settings; skipping.');
        }

        if (s.factCheckingAgent) {
            steps.push('Consider Fact-Checking Agent — Will flag claims that need verification.');
        } else {
            steps.push('Fact-Checking Agent disabled in settings; skipping.');
        }
        return steps;
    }

    // Invoke agents and write brief results below thinking steps
    function invokeAgentsAndReport(containerEl) {
        const s = extensionSettings || defaultExtensionSettings;
        const resultsEl = document.createElement('div');
        resultsEl.className = 'st-agent-result';
        containerEl.appendChild(resultsEl);

        // SERP Agent
        if (s.serpAgent && isOnSerp()) {
            try {
                const relevant = runSerpAgent(s);
                appendResult(resultsEl, `SERP Agent: highlighted ${relevant} result(s).`);
            } catch (e) {
                appendResult(resultsEl, 'SERP Agent: failed to run.');
            }
        }

        // Scraping Agent
        if (s.scrapingAgent) {
            try {
                const count = runScrapingAgent();
                appendResult(resultsEl, `Scraping Agent: captured ${count} snippet(s).`);
            } catch (e) {
                appendResult(resultsEl, 'Scraping Agent: failed to run.');
            }
        }

        // Fact-Checking Agent
        if (s.factCheckingAgent) {
            try {
                const flagged = runFactCheckingAgent();
                appendResult(resultsEl, `Fact-Checking Agent: flagged ${flagged} claim(s) for review.`);
            } catch (e) {
                appendResult(resultsEl, 'Fact-Checking Agent: failed to run.');
            }
        }
    }

    function appendResult(parent, text) {
        const line = document.createElement('div');
        line.className = 'line';
        line.textContent = text;
        parent.appendChild(line);
    }

    // Simple SERP Agent: highlight relevant results (by allowed domains or top 3)
    function runSerpAgent(s) {
        const results = extractSearchResults();
        const domains = (s.allowedDomains || '').split(',').map(x => x.trim()).filter(Boolean);
        let highlighted = 0;
        const containers = document.querySelectorAll('div.g, div.MjjYud, div.srg > div.g');

        results.forEach((r, idx) => {
            const el = containers[idx];
            if (!el) return;
            let relevant = false;
            if (domains.length > 0) {
                try {
                    const url = new URL(r.url);
                    relevant = domains.some(d => url.hostname.includes(d));
                } catch (_) {}
            }
            if (!relevant && idx < 3) relevant = true; // default relevance: top-3
            if (relevant) {
                // Highlight card
                el.style.boxShadow = '0 0 0 2px rgba(79,70,229,0.45)';
                el.style.borderRadius = '8px';
                // Highlight snippet specifically
                let snippetNode = el.querySelector('div.VwiC3b, div[data-content-feature="1"], span.aCOpRe');
                if (snippetNode) snippetNode.classList.add('st-relevant-snippet');
                // Tag title
                const tag = document.createElement('span');
                tag.className = 'st-tag';
                tag.textContent = 'Relevant';
                const h3 = el.querySelector('h3');
                if (h3) h3.appendChild(tag);
                highlighted += 1;
            }
        });

        // Log the entire structured SERP content
        try {
            browser.runtime.sendMessage({
                action: 'logUserAction',
                actionType: 'serp_scrape',
                data: {
                    timestamp: new Date().toISOString(),
                    results
                }
            });
        } catch (_) {}

        return highlighted;
    }

    // Simple Scraping Agent: collect snippets from top results and log
    function runScrapingAgent() {
        const results = extractSearchResults();
        // Prefer current page content when not on SERP; on SERP use top results' snippets
        let snippets = [];
        const isSerp = isOnSerp();
        if (!isSerp) {
            // Extract meaningful text from current page
            const article = document.querySelector('article');
            const main = document.querySelector('main');
            const candidates = [article, main, document.body].filter(Boolean);
            const text = candidates.map(el => el.innerText || '').join('\n');
            const chunks = text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 60);
            snippets = chunks.slice(0, 3).map(s => ({ url: location.href, snippet: s.slice(0, 400) }));
        } else {
            const top = results.slice(0, 3);
            snippets = top.map(r => ({ url: r.url, snippet: (r.snippet || '').slice(0, 280) }));
        }
        browser.runtime.sendMessage({
            action: 'logUserAction',
            actionType: 'scraping_preview',
            data: { timestamp: new Date().toISOString(), items: snippets }
        });
        return snippets.length;
    }

    // Simple Fact-Checking Agent: flag snippets with numbers or certain keywords
    function runFactCheckingAgent() {
        const results = extractSearchResults();
        const keywords = /(study|report|claims?|percent|%|research|source)/i;
        let flagged = 0;
        results.slice(0, 5).forEach(r => {
            if (!r || !r.snippet) return;
            if (keywords.test(r.snippet) || /\d{2,}/.test(r.snippet)) {
                flagged += 1;
            }
        });
        if (flagged > 0) {
            browser.runtime.sendMessage({
                action: 'logUserAction',
                actionType: 'fact_check_flags',
                data: { timestamp: new Date().toISOString(), flagged }
            });
        }
        return flagged;
    }

    // Load settings at startup
    (async () => { await loadExtensionSettings(); })();
})();