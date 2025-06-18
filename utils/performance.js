// Performance monitoring and optimization
const PerformanceManager = {
    // Store performance metrics
    metrics: {
      contentProcessingTime: [],
      storageOperations: 0,
      largeContentCount: 0
    },
    
    // Configure thresholds
    thresholds: {
      maxContentSize: 1000000, // 1MB
      contentProcessingTimeLimit: 500, // ms
      batchStorageOperations: true,
      storageQueue: [],
      processingInterval: null
    },
    
    // Initialize performance monitoring
    init() {
      // Set up periodic storage processing if batching is enabled
      if (this.thresholds.batchStorageOperations) {
        this.thresholds.processingInterval = setInterval(() => {
          this.processStorageQueue();
        }, 60000); // Process queue every minute
      }
      
      // Monitor browser performance periodically
      setInterval(() => {
        this.adjustThresholds();
      }, 300000); // Check every 5 minutes
      
      console.log('Performance Manager initialized');
    },
    
    // Record content processing time
    recordContentProcessing(startTime) {
      const processingTime = Date.now() - startTime;
      this.metrics.contentProcessingTime.push(processingTime);
      
      // Keep only last 50 measurements
      if (this.metrics.contentProcessingTime.length > 50) {
        this.metrics.contentProcessingTime.shift();
      }
      
      return processingTime;
    },
    
    // Check if content is too large to process
    isContentTooLarge(content) {
      if (typeof content === 'string' && content.length > this.thresholds.maxContentSize) {
        this.metrics.largeContentCount++;
        return true;
      }
      
      return false;
    },
    
    // Queue storage operation instead of executing immediately
    queueStorageOperation(operation) {
      if (this.thresholds.batchStorageOperations) {
        this.thresholds.storageQueue.push(operation);
        return true;
      }
      
      return false; // Not queued, execute immediately
    },
    
    // Process queued storage operations
    processStorageQueue() {
      if (this.thresholds.storageQueue.length === 0) return;
      
      console.log(`Processing ${this.thresholds.storageQueue.length} queued storage operations`);
      
      // Group similar operations to reduce storage API calls
      const dataToStore = {};
      
      this.thresholds.storageQueue.forEach(operation => {
        if (operation.type === 'set') {
          // Merge all set operations
          Object.assign(dataToStore, operation.data);
        }
      });
      
      // Execute the batch storage operation
      if (Object.keys(dataToStore).length > 0) {
        browser.storage.local.set(dataToStore)
          .catch(error => console.error('Error in batch storage operation:', error));
      }
      
      // Clear the queue
      this.thresholds.storageQueue = [];
    },
    
    // Dynamically adjust thresholds based on performance
    adjustThresholds() {
      if (this.metrics.contentProcessingTime.length === 0) return;
      
      // Calculate average processing time
      const avgProcessingTime = this.metrics.contentProcessingTime.reduce((a, b) => a + b, 0) / 
        this.metrics.contentProcessingTime.length;
      
      // If processing is taking too long, reduce content size limit
      if (avgProcessingTime > this.thresholds.contentProcessingTimeLimit) {
        this.thresholds.maxContentSize = Math.max(100000, this.thresholds.maxContentSize * 0.8);
        console.log(`Adjusted content size limit to ${this.thresholds.maxContentSize} bytes due to performance concerns`);
      } else if (avgProcessingTime < this.thresholds.contentProcessingTimeLimit * 0.5) {
        // If processing is very fast, we can increase the limit slightly
        this.thresholds.maxContentSize = Math.min(2000000, this.thresholds.maxContentSize * 1.2);
      }
    }
  };
  
  // Initialize when loaded
  PerformanceManager.init();
  
  // Export for use in other files
  if (typeof module !== 'undefined') {
    module.exports = PerformanceManager;
  }