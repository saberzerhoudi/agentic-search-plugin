// At the beginning of your IIFE
(function () {
  // Avoid multiple executions
  if (window.pageContentTrackerInitialized) return;
  window.pageContentTrackerInitialized = true;

  // Reference to PerformanceManager
  let PerformanceManager;

  // Try to load PerformanceManager
  browser.runtime.sendMessage({
    action: 'getPerformanceManager'
  }).then(response => {
    if (response && response.success) {
      PerformanceManager = response.PerformanceManager;
      // Ensure the required methods exist
      if (!PerformanceManager.recordContentProcessing) {
        PerformanceManager.recordContentProcessing = () => { };
      }
    }
  }).catch(() => {
    // Create a fallback PerformanceManager
    PerformanceManager = {
      thresholds: {
        maxContentSize: 100000,
        contentProcessingTimeLimit: 5000
      },
      recordContentProcessing: () => { },
      isContentTooLarge: (content) => {
        if (typeof content === 'string') {
          return content.length > 100000;
        }
        return false;
      }
    };
  });

  // Extract readable content
  function extractPageContent() {
    // Start timing content processing
    const startTime = Date.now();

    // Use a lightweight algorithm to extract main content
    // This is a simplified version; consider using Readability or similar libraries

    // Remove script and style elements to get cleaner content
    const documentClone = document.cloneNode(true);
    const scripts = documentClone.getElementsByTagName('script');
    const styles = documentClone.getElementsByTagName('style');

    while (scripts.length > 0) {
      scripts[0].parentNode.removeChild(scripts[0]);
    }

    while (styles.length > 0) {
      styles[0].parentNode.removeChild(styles[0]);
    }

    // Get text content
    let textContent = document.body.innerText;
    let htmlContent = document.documentElement.outerHTML;

    // Check for size limits if PerformanceManager is available
    if (PerformanceManager) {
      const maxSize = PerformanceManager.thresholds?.maxContentSize || 100000;

      if (textContent.length > maxSize) {
        textContent = textContent.substring(0, maxSize) + "... [content truncated]";
      }

      if (htmlContent.length > maxSize * 5) {  // HTML can be larger
        htmlContent = htmlContent.substring(0, maxSize * 5) + "... [content truncated]";
      }
    } else {
      // Default limits if PerformanceManager is not available
      if (textContent.length > 100000) {
        textContent = textContent.substring(0, 100000) + "... [content truncated]";
      }

      if (htmlContent.length > 500000) {
        htmlContent = htmlContent.substring(0, 500000) + "... [content truncated]";
      }
    }

    const content = {
      title: document.title,
      url: window.location.href,
      text: textContent,
      html: htmlContent
    };

    // Record processing time if PerformanceManager is available
    if (PerformanceManager) {
      PerformanceManager.recordContentProcessing(startTime);
    }

    return content;
  }

  // Track user interactions
  function setupInteractionTracking() {
    // Track clicks
    document.addEventListener('click', (event) => {
      let target = event.target;
      let targetInfo = {
        tagName: target.tagName,
        id: target.id,
        classes: Array.from(target.classList).join(' '),
        text: target.textContent ? target.textContent.substring(0, 100) : '',
        href: target.href || (target.closest('a') ? target.closest('a').href : null)
      };

      browser.runtime.sendMessage({
        action: 'logUserAction',
        actionType: 'page_click',
        data: {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          target: targetInfo
        }
      });
    });

    // Track scroll depth
    let maxScrollDepth = 0;
    let lastScrollLog = 0;

    window.addEventListener('scroll', debounce(() => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const clientHeight = window.innerHeight;
      const scrollPercentage = Math.round((scrollTop + clientHeight) / scrollHeight * 100);

      if (scrollPercentage > maxScrollDepth) {
        maxScrollDepth = scrollPercentage;

        // Log scroll depth at 25% intervals or after 10 seconds
        if (maxScrollDepth >= lastScrollLog + 25 || Date.now() - lastScrollLog > 10000) {
          lastScrollLog = maxScrollDepth;

          browser.runtime.sendMessage({
            action: 'logUserAction',
            actionType: 'scroll_depth',
            data: {
              url: window.location.href,
              timestamp: new Date().toISOString(),
              depth: maxScrollDepth
            }
          });
        }
      }
    }, 500));

    // Track time spent on page
    const visitStart = Date.now();
    let lastActivityTime = Date.now();
    let isActive = true;

    // Update activity status
    function updateActivity() {
      lastActivityTime = Date.now();
      if (!isActive) {
        isActive = true;
      }
    }

    // Track user activity
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    // Log engagement data when leaving the page
    window.addEventListener('beforeunload', () => {
      const totalTime = Math.floor((Date.now() - visitStart) / 1000);

      browser.runtime.sendMessage({
        action: 'logUserAction',
        actionType: 'page_exit',
        data: {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          timeSpent: totalTime,
          scrollDepth: maxScrollDepth
        }
      });
    });
  }

  // Utility: Debounce function
  function debounce(func, delay) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  // Initialize
  function init() {
    // Wait for page to fully load
    if (document.readyState === 'complete') {
      captureContent();
      setupInteractionTracking();
    } else {
      window.addEventListener('load', () => {
        captureContent();
        setupInteractionTracking();
      });
    }
  }

  // Capture page content
  function captureContent() {
    // Small delay to ensure dynamic content is loaded
    setTimeout(() => {
      const content = extractPageContent();

      browser.runtime.sendMessage({
        action: 'logPageContent',
        url: window.location.href,
        type: 'web_page',
        content: content
      });
    }, 1500);
  }

  // Start
  init();
})();