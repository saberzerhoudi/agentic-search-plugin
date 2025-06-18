// Utility functions for storage management
const StorageManager = {
    // Save data with compression for large content
    async saveData(key, data) {
      // For large content, consider using compression
      if (typeof data === 'string' && data.length > 100000) {
        // In a real implementation, you could use a compression library
        // For example: const compressed = LZString.compressToUTF16(data);
        // For this example, we'll just truncate
        data = data.substring(0, 100000) + "... [content truncated]";
      }
      
      const saveObj = {};
      saveObj[key] = data;
      return browser.storage.local.set(saveObj);
    },
    
    // Get data from storage
    async getData(key) {
      const result = await browser.storage.local.get(key);
      return result[key];
    },
    
    // Clear old data to prevent storage limits
    async maintainStorage() {
      const data = await browser.storage.local.get(null);
      const detailedLogs = data.detailedLogs || [];
      const sessions = data.sessions || [];
      
      // Keep only last 50 sessions
      if (sessions.length > 50) {
        const trimmedSessions = sessions.slice(-50);
        await browser.storage.local.set({ sessions: trimmedSessions });
      }
      
      // Keep detailed logs under size limit (50MB)
      if (detailedLogs.length > 200) {
        const trimmedLogs = detailedLogs.slice(-200);
        await browser.storage.local.set({ detailedLogs: trimmedLogs });
      }
    },
    
    // Export data as JSON
    async exportData() {
      const data = await browser.storage.local.get(null);
      const jsonString = JSON.stringify(data, null, 2);
      
      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      browser.downloads.download({
        url: url,
        filename: `google-search-tracker-export-${new Date().toISOString()}.json`,
        saveAs: true
      });
    }
  };
  
  // Export for use in other files
  if (typeof module !== 'undefined') {
    module.exports = StorageManager;
  }