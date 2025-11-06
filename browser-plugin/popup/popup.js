// Popup UI functionality
document.addEventListener('DOMContentLoaded', () => {
    const els = {
        // Tabs
        tabButtons: () => document.querySelectorAll('.tab-btn'),
        tabPanels: () => document.querySelectorAll('.tab-panel'),
        // Session
        sessionInfo: document.getElementById('session-info'),
        // Tracking
        contentCapture: document.getElementById('content-capture'),
        logLevel: document.getElementById('log-level'),
        // Controls
        maxSteps: document.getElementById('max-steps'),
        highlightElements: document.getElementById('highlight-elements'),
        thinkingMode: document.getElementById('thinking-mode'),
        visionMode: document.getElementById('vision-mode'),
        flashMode: document.getElementById('flash-mode'),
        // Agents
        serpAgent: document.getElementById('serp-agent'),
        scrapingAgent: document.getElementById('scraping-agent'),
        factCheckingAgent: document.getElementById('fact-checking-agent'),
        // Knowledge
        useIndexedFiles: document.getElementById('use-indexed-files'),
        folderPath: document.getElementById('folder-path'),
        selectFolderBtn: document.getElementById('select-folder-btn'),
        // Data mgmt
        viewLogs: document.getElementById('view-logs'),
        exportData: document.getElementById('export-data'),
        clearData: document.getElementById('clear-data'),
        // Models & API (segmented)
        segments: () => document.querySelectorAll('.segment'),
        cloudConfig: document.getElementById('cloud-config'),
        localConfig: document.getElementById('local-config'),
        llmProvider: document.getElementById('llm-provider'),
        apiKeyInput: document.getElementById('api-key'),
        toggleApiVisibility: document.getElementById('toggle-api-visibility'),
        saveApiKeyBtn: document.getElementById('save-api-key'),
        apiKeyStatus: document.getElementById('api-key-status'),
        localModel: document.getElementById('local-model'),
        modelSize: document.getElementById('model-size'),
        modelMemory: document.getElementById('model-memory'),
        downloadModelBtn: document.getElementById('download-model'),
        downloadProgress: document.getElementById('download-progress'),
        progressBar: () => document.querySelector('#download-progress .progress-bar'),
        progressText: () => document.querySelector('#download-progress .progress-text'),
        localModelStatus: document.getElementById('local-model-status'),
        // System
        databaseBackend: document.getElementById('database-backend'),
        proactivityLevelSelect: document.getElementById('proactivity-level-select'),
        proactivityDesc: document.getElementById('proactivity-desc'),
        proactivityTypeBoxes: () => document.querySelectorAll('input[name="proactivity-type"]'),
        // Footer
        saveStatus: document.getElementById('save-status'),
        connectionStatus: document.getElementById('connection-status'),
    };

    const defaultSettings = {
        // Tracking
        contentCapture: true,
        logLevel: 'detailed',
        // Controls
        maxSteps: 25,
        highlightElements: true,
        thinkingMode: true,
        visionMode: false,
        flashMode: false,
        // Agents
        serpAgent: true,
        scrapingAgent: true,
        factCheckingAgent: false,
        // Knowledge
        useIndexedFiles: false,
        folderPath: '',
        // Models & API
        llmProvider: 'openai',
        apiKeySaved: false,
        // Local model
        localModel: 'smol2',
        // System
        databaseBackend: 'indexeddb',
        proactivityLevel: 'assistive',
        proactivityTypes: [],
    };

    const PROACTIVITY_DESCRIPTIONS = {
        off: 'Off — only on explicit commands',
        hints: 'Hints Only — non-intrusive suggestions',
        assistive: 'Assistive — suggest and summarize on demand',
        active: 'Active — auto-summarize current page',
        autonomous: 'Autonomous — explore related pages',
    };

    let saveTimeout;

    // Tabs
    function setupTabs() {
        const buttons = els.tabButtons();
        const panels = els.tabPanels();
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const id = btn.getAttribute('data-tab');
                panels.forEach(p => p.classList.toggle('active', p.id === id));
            });
        });
    }

    // Session
async function loadSessionInfo() {
        if (!els.sessionInfo) return;
    try {
            const response = await browser.runtime.sendMessage({ action: 'getSessionStats' });
        if (response) {
            const startTime = new Date(response.startTime);
                els.sessionInfo.innerHTML = `
                <div class="stat-grid">
                    <div class="stat">
                            <span class="stat-value">${response.eventCount ?? 0}</span>
                        <span class="stat-label">Events</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${formatTime(startTime)}</span>
                        <span class="stat-label">Started</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${formatDate(startTime)}</span>
                        <span class="stat-label">Date</span>
                    </div>
                    <div class="stat stat-id">
                        <span class="stat-label">Session ID</span>
                            <span class="stat-id-value">${response.sessionId ?? '-'}</span>
                        </div>
                </div>
            `;
                els.sessionInfo.classList.remove('skeleton');
        } else {
                els.sessionInfo.textContent = 'No active session found.';
                els.sessionInfo.classList.remove('skeleton');
            }
        } catch (e) {
            console.error('Error loading session data:', e);
            els.sessionInfo.textContent = 'Error loading session data.';
            els.sessionInfo.classList.remove('skeleton');
        }
    }
    function formatTime(date) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function formatDate(date) { return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); }

    // Models segmented
    function setupSegments() {
        const segments = els.segments();
        segments.forEach(seg => {
            seg.addEventListener('click', () => {
                segments.forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                const target = seg.getAttribute('data-target');
                document.querySelectorAll('.segment-panel').forEach(panel => {
                    panel.style.display = (panel.id === target) ? '' : 'none';
                    panel.classList.toggle('active', panel.id === target);
                });
            });
        });
    }

    // Local model info
    function updateModelInfo() {
        const select = els.localModel;
        if (!select) return;
        const val = select.value;
        switch (val) {
            case 'smol2': setModelInfo('~500 MB', '~1 GB RAM'); break;
            case 'qwen25': setModelInfo('~800 MB', '~1.5 GB RAM'); break;
            case 'llama32': setModelInfo('~1 GB', '~1.8 GB RAM'); break;
            case 'falcon3': setModelInfo('~950 MB', '~1.7 GB RAM'); break;
            case 'deepseek': setModelInfo('~1.5 GB', '~2 GB RAM'); break;
            default: setModelInfo('500-1500 MB', '1-2 GB RAM');
        }
    }
    function setModelInfo(size, mem) {
        if (els.modelSize) els.modelSize.textContent = size;
        if (els.modelMemory) els.modelMemory.textContent = mem;
    }

    function downloadModel() {
        const btn = els.downloadModelBtn;
        const container = els.downloadProgress;
        const bar = els.progressBar();
        const text = els.progressText();
        const status = els.localModelStatus;
        const localSelect = els.localModel;

        if (!btn || !container || !bar || !text || !status || !localSelect) return;

        const modelName = localSelect.options[localSelect.selectedIndex].text;
        btn.style.display = 'none';
        container.style.display = 'block';
        let progress = 0;
        status.textContent = `Preparing to download ${modelName}...`;
        status.classList.add('visible');

        const interval = setInterval(() => {
            progress += Math.random() * 6;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                status.textContent = `${modelName} downloaded successfully. Ready to use.`;
                setTimeout(() => {
                    btn.style.display = 'inline-flex';
                    container.style.display = 'none';
                    bar.style.width = '0%';
                }, 1600);
            }
            bar.style.width = `${progress}%`;
            text.textContent = `${Math.round(progress)}%`;
        }, 180);
    }

    // Cloud: API key
    function toggleApiVisibility() {
        const input = els.apiKeyInput;
        if (!input) return;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
    }

    async function saveApiKey() {
        const provider = els.llmProvider ? els.llmProvider.value : 'openai';
        const apiKey = els.apiKeyInput ? els.apiKeyInput.value.trim() : '';
        if (!apiKey) {
            showInlineStatus(els.apiKeyStatus, 'Please enter an API key.', true);
            return;
        }
        try {
            // Persist provider + key (non-encrypted)
            await browser.storage.local.set({ llm_provider: provider, api_key: apiKey });

            // Make the key immediately usable by content scripts:
            // 1) Put it in sessionStorage so openai-service.tryInitializeFromSession() succeeds
            sessionStorage.setItem('openai_key_temp', apiKey);

            // 2) Cache in background so content scripts can fetch it via getApiKeyForSession
            browser.runtime.sendMessage({ action: 'storeApiKeyInBackground', apiKey, provider }).catch(() => {});

            // 3) Notify listeners to retry flows that depend on an unlocked key
            browser.runtime.sendMessage({ action: 'apiKeyUnlocked', provider }).catch(() => {});
            browser.runtime.sendMessage({ action: 'apiKeyChanged', provider, timestamp: Date.now() }).catch(() => {});

            if (els.apiKeyInput) els.apiKeyInput.value = '';
            if (els.apiKeyStatus) {
                els.apiKeyStatus.className = 'alert alert-success';
                els.apiKeyStatus.style.display = '';
                els.apiKeyStatus.textContent = `${providerDisplay(provider)} API key saved.`;
            }
        } catch (e) {
            console.error(e);
            if (els.apiKeyStatus) {
                els.apiKeyStatus.className = 'alert alert-error';
                els.apiKeyStatus.style.display = '';
                els.apiKeyStatus.textContent = 'Failed to save API key.';
            }
        }
    }

    function providerDisplay(p) {
        switch (p) {
            case 'anthropic': return 'Anthropic (Claude)';
            case 'cohere': return 'Cohere';
            case 'mistral': return 'Mistral AI';
            default: return 'OpenAI';
        }
    }

    // Data mgmt
    function openLogsPage() {
        browser.tabs.create({ url: '/pages/logs.html' });
    }
    async function exportAllData() {
        try { await browser.runtime.sendMessage({ action: 'exportData' }); }
        catch (e) { console.error('Error exporting data:', e); alert('Failed to export data.'); }
    }
    async function clearAllData() {
        if (!confirm('Clear all stored data? This cannot be undone.')) return;
        try {
            await browser.storage.local.clear();
            await browser.storage.local.set({
                sessions: [],
                detailedLogs: [],
                settings: defaultSettings
            });
            showSaved();
            await loadSettings();
            await loadSessionInfo();
        } catch (e) {
            console.error('Error clearing data:', e);
            alert('Failed to clear data.');
        }
    }

    // Settings load/save
    async function loadSettings() {
        try {
            const { settings } = await browser.storage.local.get('settings');
            const s = { ...defaultSettings, ...settings };

            // Tracking
            if (els.contentCapture) els.contentCapture.checked = s.contentCapture;
            if (els.logLevel) els.logLevel.value = s.logLevel;

            // Controls
            if (els.maxSteps) els.maxSteps.value = s.maxSteps;
            if (els.highlightElements) els.highlightElements.checked = s.highlightElements;
            if (els.thinkingMode) els.thinkingMode.checked = s.thinkingMode;
            if (els.visionMode) els.visionMode.checked = s.visionMode;
            if (els.flashMode) els.flashMode.checked = s.flashMode;

            // Agents
            if (els.serpAgent) els.serpAgent.checked = s.serpAgent;
            if (els.scrapingAgent) els.scrapingAgent.checked = s.scrapingAgent;
            if (els.factCheckingAgent) els.factCheckingAgent.checked = s.factCheckingAgent;

            // Knowledge
            if (els.useIndexedFiles) els.useIndexedFiles.checked = s.useIndexedFiles;
            if (els.folderPath) els.folderPath.value = s.folderPath;

            // Models & API
            if (els.llmProvider) els.llmProvider.value = s.llmProvider;
            if (els.localModel) { els.localModel.value = s.localModel; updateModelInfo(); }

            // System
            if (els.databaseBackend) els.databaseBackend.value = s.databaseBackend;
            if (els.proactivityLevelSelect) {
                els.proactivityLevelSelect.value = s.proactivityLevel;
                if (els.proactivityDesc) els.proactivityDesc.textContent = PROACTIVITY_DESCRIPTIONS[s.proactivityLevel] || '';
            }
            els.proactivityTypeBoxes().forEach(cb => { cb.checked = (s.proactivityTypes || []).includes(cb.value); });
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    function saveSettings() {
        clearTimeout(saveTimeout);

        const proactivityTypes = Array.from(els.proactivityTypeBoxes()).filter(cb => cb.checked).map(cb => cb.value);
        const s = {
            // Tracking
            contentCapture: els.contentCapture ? els.contentCapture.checked : true,
            logLevel: els.logLevel ? els.logLevel.value : 'detailed',
            // Controls
            maxSteps: els.maxSteps ? parseInt(els.maxSteps.value || '25', 10) : 25,
            highlightElements: els.highlightElements ? els.highlightElements.checked : true,
            thinkingMode: els.thinkingMode ? els.thinkingMode.checked : true,
            visionMode: els.visionMode ? els.visionMode.checked : false,
            flashMode: els.flashMode ? els.flashMode.checked : false,
            // Agents
            serpAgent: els.serpAgent ? els.serpAgent.checked : true,
            scrapingAgent: els.scrapingAgent ? els.scrapingAgent.checked : true,
            factCheckingAgent: els.factCheckingAgent ? els.factCheckingAgent.checked : false,
            // Knowledge
            useIndexedFiles: els.useIndexedFiles ? els.useIndexedFiles.checked : false,
            folderPath: els.folderPath ? (els.folderPath.value || '').trim() : '',
            // Models & API
            llmProvider: els.llmProvider ? els.llmProvider.value : 'openai',
            localModel: els.localModel ? els.localModel.value : 'smol2',
            // System
            databaseBackend: els.databaseBackend ? els.databaseBackend.value : 'indexeddb',
            proactivityLevel: els.proactivityLevelSelect ? els.proactivityLevelSelect.value : 'assistive',
            proactivityTypes,
        };

        browser.storage.local.set({ settings: s }).then(showSaved).catch(e => console.error('Error saving settings:', e));
        browser.runtime.sendMessage({ action: 'settingsChanged', settings: s }).catch(() => {});
    }

    function showSaved() {
        if (!els.saveStatus) return;
        els.saveStatus.textContent = 'Saved';
        els.saveStatus.classList.add('visible');
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => els.saveStatus.classList.remove('visible'), 1200);
    }

    function showInlineStatus(node, text, isError) {
        if (!node) return;
        node.textContent = text;
        node.classList.add('visible');
        node.style.color = isError ? '#991b1b' : '#065f46';
        setTimeout(() => node.classList.remove('visible'), 2000);
    }

    function updateConnectionStatus() {
        const statusDot = document.querySelector('.status-dot');
        if (!statusDot || !els.connectionStatus) return;
        if (navigator.onLine) {
            statusDot.classList.add('online'); statusDot.classList.remove('offline');
            els.connectionStatus.innerHTML = '<span class="status-dot online"></span> Connected';
        } else {
            statusDot.classList.add('offline'); statusDot.classList.remove('online');
            els.connectionStatus.innerHTML = '<span class="status-dot offline"></span> Offline';
        }
    }

    function setupEvents() {
        // Inputs auto-save
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const type = (input.type === 'range' || input.type === 'text' || input.type === 'password' || input.tagName === 'TEXTAREA') ? 'input' : 'change';
            input.addEventListener(type, () => {
                if (input === els.proactivityLevelSelect && els.proactivityDesc) {
                    els.proactivityDesc.textContent = PROACTIVITY_DESCRIPTIONS[els.proactivityLevelSelect.value] || '';
                }
                saveSettings();
            });
        });

        // Segments
        setupSegments();

        // Model info / download
        if (els.localModel) els.localModel.addEventListener('change', updateModelInfo);
        if (els.downloadModelBtn) els.downloadModelBtn.addEventListener('click', downloadModel);

        // API key
        if (els.toggleApiVisibility) els.toggleApiVisibility.addEventListener('click', toggleApiVisibility);
        if (els.saveApiKeyBtn) els.saveApiKeyBtn.addEventListener('click', saveApiKey);

        // Data mgmt
        if (els.viewLogs) els.viewLogs.addEventListener('click', openLogsPage);
        if (els.exportData) els.exportData.addEventListener('click', exportAllData);
        if (els.clearData) els.clearData.addEventListener('click', clearAllData);

        // Folder dialog (note: browsers restrict folder pickers)
        if (els.selectFolderBtn) els.selectFolderBtn.addEventListener('click', () => {
            alert('Please paste the full folder path. Folder pickers are restricted in extensions.');
        });

        // Connectivity
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
    }

    function init() {
        setupTabs();
        setupEvents();
        updateConnectionStatus();
        loadSettings();
        loadSessionInfo();
        updateModelInfo();
    }

    init();
});