/**
 * Logger utility for Google Search Tracker extension
 * Provides consistent logging functionality across the extension
 */

// Logger module
const Logger = {
    // Log levels
    levels: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    },
    
    // Current log level
    currentLevel: 1, // INFO by default
    
    // Debug logs
    debug(message, data = null) {
      if (this.currentLevel <= this.levels.DEBUG) {
        this._log('DEBUG', message, data);
      }
    },
    
    // Info logs
    info(message, data = null) {
      if (this.currentLevel <= this.levels.INFO) {
        this._log('INFO', message, data);
      }
    },
    
    // Warning logs
    warn(message, data = null) {
      if (this.currentLevel <= this.levels.WARN) {
        this._log('WARN', message, data);
      }
    },
    
    // Error logs
    error(message, data = null) {
      if (this.currentLevel <= this.levels.ERROR) {
        this._log('ERROR', message, data);
      }
    },
    
    // Internal logging function
    _log(level, message, data) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message
      };
      
      if (data) {
        logEntry.data = data;
      }
      
      // Log to console
      console.log(`[${level}] ${message}`, data || '');
      
      // Store in extension logs
      browser.storage.local.get('systemLogs', (result) => {
        const logs = result.systemLogs || [];
        logs.push(logEntry);
        
        // Limit logs to last 1000 entries
        if (logs.length > 1000) {
          logs.shift();
        }
        
        browser.storage.local.set({ systemLogs: logs });
      });
    },
    
    // Set log level
    setLogLevel(level) {
      if (this.levels[level] !== undefined) {
        this.currentLevel = this.levels[level];
      }
    },
    
    // Get all system logs
    async getLogs() {
      const result = await browser.storage.local.get('systemLogs');
      return result.systemLogs || [];
    },
    
    // Clear system logs
    async clearLogs() {
      await browser.storage.local.set({ systemLogs: [] });
    }
  };
  
  // Make logger available to other modules
  if (typeof browser !== 'undefined') {
    // In browser context
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'log') {
        Logger[message.level](message.message, message.data);
        sendResponse({ success: true });
      }
    });
  }
  
  // Export for use in other files
  if (typeof module !== 'undefined') {
    module.exports = Logger;
  }