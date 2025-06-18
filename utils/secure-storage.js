/**
* Secure storage utility for sensitive API keys
*/
export const SecureStorage = {
    // Encryption key (derived from user password/pin)
    encryptionKey: null,

    /**
     * Initialize secure storage with a user password
     * @param {string} password User-provided password or PIN
     * @returns {Promise<boolean>} Success status
     */
    async initialize(password) {
        try {
            // Create a key from the password
            const encoder = new TextEncoder();
            const passwordData = encoder.encode(password);

            // Use Web Crypto API to derive a key
            const keyMaterial = await window.crypto.subtle.importKey(
                "raw",
                passwordData,
                { name: "PBKDF2" },
                false,
                ["deriveKey"]
            );

            // Salt should ideally be stored separately and securely
            // For simplicity, we're using a fixed salt here
            const salt = encoder.encode("firefox-extension-salt");

            // Derive the actual encryption key
            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );

            return true;
        } catch (error) {
            console.error("Failed to initialize secure storage:", error);
            return false;
        }
    },

    /**
     * Encrypt a value
     * @param {string} value Value to encrypt
     * @returns {Promise<string>} Encrypted value as base64
     */
    async encrypt(value) {
        if (!this.encryptionKey) {
            throw new Error("Secure storage not initialized");
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(value);

            // Generate a random IV for each encryption
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // Encrypt the data
            const encryptedData = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                this.encryptionKey,
                data
            );

            // Combine IV and encrypted data
            const result = new Uint8Array(iv.length + encryptedData.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encryptedData), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error("Encryption failed:", error);
            throw error;
        }
    },

    /**
     * Decrypt a value
     * @param {string} encryptedValue Base64 encrypted value
     * @returns {Promise<string>} Decrypted value
     */
    async decrypt(encryptedValue) {
        if (!this.encryptionKey) {
            throw new Error("Secure storage not initialized");
        }

        try {
            // Convert from base64
            const encryptedData = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));

            // Extract IV (first 12 bytes)
            const iv = encryptedData.slice(0, 12);
            const data = encryptedData.slice(12);

            // Decrypt
            const decryptedData = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                this.encryptionKey,
                data
            );

            // Convert back to string
            return new TextDecoder().decode(decryptedData);
        } catch (error) {
            console.error("Decryption failed:", error);
            throw error;
        }
    },

    /**
     * Store an API key securely
     * @param {string} key The API key to store
     * @returns {Promise<boolean>} Success status
     */
    async storeApiKey(key) {
        try {
            const encryptedKey = await this.encrypt(key);
            await browser.storage.local.set({ 'encrypted_openai_key': encryptedKey });
            return true;
        } catch (error) {
            console.error("Failed to store API key:", error);
            return false;
        }
    },

    /**
     * Retrieve the API key
     * @returns {Promise<string|null>} The API key or null if not found
     */
    async getApiKey() {
        try {
            const result = await browser.storage.local.get('encrypted_openai_key');
            if (!result.encrypted_openai_key) return null;

            return await this.decrypt(result.encrypted_openai_key);
        } catch (error) {
            console.error("Failed to retrieve API key:", error);
            return null;
        }
    }
};
