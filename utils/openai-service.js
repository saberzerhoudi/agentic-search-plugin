/**
* Service for interacting with OpenAI API
*/
class OpenAIService {
    constructor() {
        this.apiKey = null;
        this.isInitialized = false;
    }

    /**
     * Initialize with an API key
     * @param {string} apiKey - OpenAI API key
     */
    initialize(apiKey) {
        this.apiKey = apiKey;
        this.isInitialized = true;
    }

    /**
     * Check if API key is available in session storage
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async tryInitializeFromSession() {
        try {
            // Try to get from session storage first
            const sessionKey = sessionStorage.getItem('openai_key_temp');

            if (sessionKey) {
                console.log("Found API key in session storage");
                this.initialize(sessionKey);
                return true;
            }

            // If not in session storage, try to get from background script
            const response = await browser.runtime.sendMessage({
                action: 'getApiKeyForSession'
            });

            if (response && response.apiKey) {
                console.log("Retrieved API key from background script");
                this.initialize(response.apiKey);
                // Also store in session storage for next time
                sessionStorage.setItem('openai_key_temp', response.apiKey);
                return true;
            }
        } catch (error) {
            console.error("Error retrieving API key:", error);
        }

        return false;
    }

    /**
     * Check if an encrypted API key exists in storage
     * @returns {Promise<boolean>} Whether a key exists
     */
    async checkForStoredKey() {
        try {
            const result = await browser.storage.local.get('encrypted_openai_key');
            return !!result.encrypted_openai_key;
        } catch (error) {
            console.error("Error checking for stored API key:", error);
            return false;
        }
    }

    /**
     * Makes requests to OpenAI API
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} API response
     */
    async makeRequest(endpoint, params) {
        if (!this.isInitialized) {
            const initialized = await this.tryInitializeFromSession();
            if (!initialized) {
                throw new Error('OpenAI service not initialized with API key');
            }
        }

        try {
            const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw error;
        }
    }

    /**
     * Generate a completion using the OpenAI API
     * @param {Object} params - Completion parameters
     * @returns {Promise<Object>} Completion response
     */
    async createChatCompletion(params) {
        return this.makeRequest('chat/completions', params);
    }

    /**
 * Set up automatic clearing of API key after inactivity
 * @param {number} timeoutMinutes - Minutes of inactivity before clearing key
 */
    setupInactivityTimeout(timeoutMinutes = 30) {
        let inactivityTimer;

        const clearApiKey = () => {
            this.apiKey = null;
            this.isInitialized = false;
            sessionStorage.removeItem('openai_key_temp');
            console.log('API key cleared due to inactivity');
        };

        const resetTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(clearApiKey, timeoutMinutes * 60 * 1000);
        };

        // Reset timer on any user activity
        ['click', 'keypress', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, resetTimer, { passive: true });
        });

        // Initial timer setup
        resetTimer();
    }

    /**
     * Refine a search query to make it more effective
     * @param {string} originalQuery - The original search query
     * @returns {Promise<string>} The refined query
     */
    async refineSearchQuery(originalQuery) {
        if (!this.isInitialized) {
            const initialized = await this.tryInitializeFromSession();
            if (!initialized) {
                throw new Error('OpenAI service not initialized with API key');
            }
        }

        try {
            // Use a safer approach that works with CSP restrictions
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "You are a search query optimization assistant. Your job is to refine search queries to make them more effective, precise, and likely to return relevant results. Maintain the original intent but make the query clearer and more specific. Return only the refined query with no additional explanation or text."
                        },
                        {
                            role: "user",
                            content: `Refine this search query: "${originalQuery}"`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API request failed');
            }

            const data = await response.json();

            // Extract the refined query from the response
            const refinedQuery = data.choices[0].message.content.trim();
            console.log(`Original query: "${originalQuery}" → Refined: "${refinedQuery}"`);
            return refinedQuery;
        } catch (error) {
            console.error('Query refinement error:', error);
            // Return the original query if refinement fails
            return originalQuery;
        }
    }
}

// Create a singleton instance
const openAIService = new OpenAIService();

export { openAIService };