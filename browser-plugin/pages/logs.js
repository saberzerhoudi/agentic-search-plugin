// Logs page functionality
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let allLogs = [];
    let filteredLogs = [];
    let currentPage = 1;
    const logsPerPage = 50;

    // Load initial logs
    loadLogs();

    // Set up event listeners
    document.getElementById('refresh').addEventListener('click', loadLogs);
    document.getElementById('export-filtered').addEventListener('click', exportFilteredLogs);
    document.getElementById('log-type').addEventListener('change', filterLogs);
    document.getElementById('date-filter').addEventListener('change', filterLogs);
    document.getElementById('prev-page').addEventListener('click', goToPrevPage);
    document.getElementById('next-page').addEventListener('click', goToNextPage);
    document.getElementById('close-details').addEventListener('click', closeDetails);

    // Handle clicks outside the modal to close it
    document.getElementById('log-details').addEventListener('click', (e) => {
        if (e.target === document.getElementById('log-details')) {
            closeDetails();
        }
    });

    // Load logs from storage
    async function loadLogs() {
        try {
            // Show loading state
            document.getElementById('logs-body').innerHTML = `
                <tr>
                    <td colspan="4" class="loading">
                        <div class="loader"></div>
                        <span>Loading logs...</span>
                    </td>
                </tr>
            `;

            // Load general logs
            const result = await browser.storage.local.get(['sessions', 'detailedLogs']);

            allLogs = [];

            // Process session logs
            if (result.sessions) {
                result.sessions.forEach(session => {
                    if (session.events) {
                        session.events.forEach(event => {
                            allLogs.push({
                                timestamp: event.timestamp,
                                type: event.type,
                                url: event.data?.url || 'N/A',
                                data: event.data,
                                category: 'action'
                            });
                        });
                    }
                });
            }

            // Process detailed logs
            if (result.detailedLogs) {
                result.detailedLogs.forEach(log => {
                    // Extract query for SERP logs
                    let query = 'N/A';
                    if (log.type === 'google_serp') {
                        // Try different ways to get the query
                        if (log.content && typeof log.content === 'object' && log.content.query) {
                            query = log.content.query;
                        } else if (log.content && typeof log.content === 'string') {
                            // Try to extract from URL if content is a string (HTML)
                            const urlMatch = log.url.match(/[?&]q=([^&]+)/);
                            if (urlMatch && urlMatch[1]) {
                                query = decodeURIComponent(urlMatch[1].replace(/\+/g, ' '));
                            }
                        }
                    }

                    allLogs.push({
                        timestamp: log.timestamp,
                        type: log.type,
                        url: log.url,
                        content: log.content,
                        query: query,
                        category: log.type === 'google_serp' ? 'serp' : 'page'
                    });
                });
            }

            // Sort logs by timestamp, newest first
            allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Apply filters and display
            filterLogs();
        } catch (error) {
            console.error('Error loading logs:', error);
            document.getElementById('logs-body').innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <p>Error loading logs: ${error.message}</p>
                    </td>
                </tr>
            `;
        }
    }

    // Filter logs based on selected criteria
    function filterLogs() {
        const logType = document.getElementById('log-type').value;
        const dateFilter = document.getElementById('date-filter').value;

        filteredLogs = allLogs.filter(log => {
            // Filter by log type
            if (logType !== 'all') {
                if (logType === 'search' && log.type !== 'google_search') return false;
                if (logType === 'serp' && log.category !== 'serp') return false;
                if (logType === 'page' && log.category !== 'page') return false;
                if (logType === 'action' && log.category !== 'action') return false;
            }

            // Filter by date
            if (dateFilter) {
                const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                if (logDate !== dateFilter) return false;
            }

            return true;
        });

        // Reset to first page
        currentPage = 1;
        displayLogs();
    }

    // Display logs for current page
    function displayLogs() {
        const startIndex = (currentPage - 1) * logsPerPage;
        const endIndex = startIndex + logsPerPage;
        const logsToDisplay = filteredLogs.slice(startIndex, endIndex);

        const tbody = document.getElementById('logs-body');
        tbody.innerHTML = '';

        if (logsToDisplay.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <p>No logs found matching the current filters.</p>
                    </td>
                </tr>
            `;
            return;
        }

        logsToDisplay.forEach((log, index) => {
            const row = document.createElement('tr');

            // Format timestamp
            const date = new Date(log.timestamp);
            const formattedDate = date.toLocaleString();

            // Create type badge with appropriate styling
            const typeBadge = getTypeBadge(log.type, log.category);

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${typeBadge}</td>
                <td class="url-cell">${truncateText(log.url, 50)}</td>
                <td>
                    <button class="button view-details" data-index="${startIndex + index}">
                        View
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Add click handlers for view buttons
        document.querySelectorAll('.view-details').forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.getAttribute('data-index'));
                showLogDetails(filteredLogs[index]);
            });
        });

        // Update pagination
        updatePagination();
    }

    // Create a styled badge for log types
    function getTypeBadge(type, category) {
        let badgeClass = '';
        let label = type;

        switch (category) {
            case 'serp':
                badgeClass = 'badge-blue';
                break;
            case 'page':
                badgeClass = 'badge-green';
                break;
            case 'action':
                badgeClass = 'badge-amber';
                break;
            default:
                badgeClass = 'badge-gray';
        }

        return `<span class="badge ${badgeClass}">${label}</span>`;
    }

    // Update pagination controls
    function updatePagination() {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages || 1}`;

        document.getElementById('prev-page').disabled = currentPage <= 1;
        document.getElementById('next-page').disabled = currentPage >= totalPages;
    }

    // Go to previous page
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            displayLogs();
        }
    }

    // Go to next page
    function goToNextPage() {
        const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayLogs();
        }
    }

    // Show details for a specific log
    function showLogDetails(log) {
        const detailsDiv = document.getElementById('log-details');
        const contentDiv = document.getElementById('detail-content');

        // Format the content based on log type
        let detailsHTML = `
            <div class="detail-section">
                <div class="detail-field">
                    <span class="detail-label">Timestamp:</span>
                    <span class="detail-value">${new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${getTypeBadge(log.type, log.category)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">URL:</span>
                    <span class="detail-value url-link">
                        <a href="${log.url}" target="_blank">${log.url}</a>
                    </span>
                </div>
            </div>
        `;

        if (log.category === 'serp') {
            // Display query with better fallbacks
            const query = log.query !== 'N/A' ? log.query :
                (log.content && log.content.query) ? log.content.query :
                    'No query found';

            detailsHTML += `
                <div class="detail-section">
                    <h3>Search Results</h3>
                    <div class="detail-field">
                        <span class="detail-label">Query:</span>
                         <span class="detail-value query-text">${query}</span>
                    </div>
                </div>
                <div class="content-preview">
                    <h4>Results Data</h4>
                    <pre>${formatJsonContent(log.content)}</pre>
                </div>
            `;
        } else if (log.category === 'page') {
            detailsHTML += `
                <div class="detail-section">
                    <h3>Page Content</h3>
                    <div class="detail-field">
                        <span class="detail-label">Title:</span>
                        <span class="detail-value">${log.content && log.content.title || 'N/A'}</span>
                    </div>
                </div>
                <div class="content-preview">
                    <h4>Text Content</h4>
                    <pre>${log.content && log.content.text ? formatTextContent(log.content.text) : 'No content available'}</pre>
                </div>
            `;
        } else if (log.category === 'action') {
            detailsHTML += `
                <div class="detail-section">
                    <h3>User Action</h3>
                </div>
                <div class="content-preview">
                    <h4>Action Details</h4>
                    <pre>${formatJsonContent(log.data)}</pre>
                </div>
            `;
        }

        contentDiv.innerHTML = detailsHTML;
        detailsDiv.style.display = 'flex';
    }

    // Format JSON content for display
    function formatJsonContent(content) {
        if (!content) return 'No content available';

        try {
            // If it's already a string, parse it to ensure it's valid JSON
            if (typeof content === 'string') {
                // Try to parse, but if it fails just return the string
                try {
                    content = JSON.parse(content);
                } catch (e) {
                    return escapeHtml(truncateText(content, 10000));
                }
            }

            // Pretty print the JSON
            return escapeHtml(truncateText(JSON.stringify(content, null, 2), 10000));
        } catch (e) {
            console.error('Error formatting JSON:', e);
            return 'Error formatting content';
        }
    }

    // Format text content with line breaks preserved
    function formatTextContent(text) {
        if (!text) return 'No content available';
        return escapeHtml(truncateText(text, 10000));
    }

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Close details panel
    function closeDetails() {
        document.getElementById('log-details').style.display = 'none';
    }

    // Export filtered logs
    function exportFilteredLogs() {
        if (filteredLogs.length === 0) {
            showToast('No logs to export with current filters.', 'warning');
            return;
        }

        const jsonString = JSON.stringify(filteredLogs, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        browser.downloads.download({
            url: url,
            filename: `google-search-tracker-logs-export-${new Date().toISOString().split('T')[0]}.json`,
            saveAs: true
        }).then(() => {
            showToast('Logs exported successfully!', 'success');
        }).catch(error => {
            showToast(`Export error: ${error.message}`, 'error');
        });
    }

    // Show a toast notification
    function showToast(message, type = 'info') {
        // Remove existing toast if present
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Add toast to the document
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Utility: Truncate long text
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
});