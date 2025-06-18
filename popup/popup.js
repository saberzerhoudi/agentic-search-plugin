// Popup UI functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Import the SecureStorage module
    const { SecureStorage } = await import('../utils/secure-storage.js');

    // Add width style
    const widthStyle = document.createElement('style');
    widthStyle.textContent = `
        body {
            width: 480px !important;
        }
        
        .modal-content {
            max-width: 440px;
        }
        
        .stat-grid {
            grid-template-columns: 1fr 1fr;
        }
        
        .stat-id {
            grid-column: span 2;
        }
        
        .action-bar {
            gap: 0.75rem;
        }
        
        .card-content {
            padding: 1.25rem;
        }
    `;
    document.head.appendChild(widthStyle);

    // Add modal style (only once)
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .modal-content {
            background-color: var(--card);
            padding: 1.5rem;
            border-radius: var(--radius);
            width: 90%;
            max-width: 440px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .modal-content h3 {
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            margin-top: 1.5rem;
        }
        
        .stat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        .stat {
            display: flex;
            flex-direction: column;
        }
        
        .stat-id {
            grid-column: span 2;
            margin-top: 0.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid var(--border);
        }
        
        .stat-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--primary);
        }
        
        .stat-label {
            font-size: 0.75rem;
            color: var(--muted-foreground);
        }
        
        .stat-id-value {
            font-family: monospace;
            font-size: 0.875rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    `;
    document.head.appendChild(modalStyle);

    // Check if API key is already stored
    async function checkForStoredKey() {
        const result = await browser.storage.local.get('encrypted_openai_key');
        return !!result.encrypted_openai_key;
    }

    const hasStoredKey = await checkForStoredKey();

    // Setup and access tabs for LLM Configuration
    const cloudTab = document.getElementById('cloud-tab');
    const localTab = document.getElementById('local-tab');
    const cloudForm = document.getElementById('cloud-llm-form');
    const localForm = document.getElementById('local-llm-form');

    if (cloudTab && localTab && cloudForm && localForm) {
        cloudTab.addEventListener('click', () => {
            cloudTab.classList.add('active');
            localTab.classList.remove('active');
            cloudForm.style.display = 'block';
            localForm.style.display = 'none';
        });

        localTab.addEventListener('click', () => {
            localTab.classList.add('active');
            cloudTab.classList.remove('active');
            localForm.style.display = 'block';
            cloudForm.style.display = 'none';
        });
    }

    // API key event listeners
    const saveApiKeyBtn = document.getElementById('save-api-key');
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', saveApiKey);

    // API key visibility toggle
    const toggleApiVisibility = document.getElementById('toggle-api-visibility');
    const apiKeyInput = document.getElementById('api-key');

    if (toggleApiVisibility && apiKeyInput) {
        toggleApiVisibility.addEventListener('click', () => {
            const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
            apiKeyInput.setAttribute('type', type);

            // Update icon based on visibility state
            if (type === 'text') {
                toggleApiVisibility.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"></path></svg>`;
            } else {
                toggleApiVisibility.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"></path></svg>`;
            }
        });
    }

    // Password strength meter
    const passwordInput = document.getElementById('encryption-password');
    const strengthBar = document.querySelector('.strength-bar');

    if (passwordInput && strengthBar) {
        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            let strength = 0;

            if (password.length >= 8) strength += 1;
            if (password.match(/[A-Z]/)) strength += 1;
            if (password.match(/[0-9]/)) strength += 1;
            if (password.match(/[^A-Za-z0-9]/)) strength += 1;

            strengthBar.className = 'strength-bar';

            if (strength === 0) {
                strengthBar.style.width = '0';
            } else if (strength <= 2) {
                strengthBar.classList.add('weak');
                strengthBar.style.width = '33.3%';
            } else if (strength === 3) {
                strengthBar.classList.add('medium');
                strengthBar.style.width = '66.6%';
            } else {
                strengthBar.classList.add('strong');
                strengthBar.style.width = '100%';
            }
        });
    }

    // Load current session information
    loadSessionInfo();

    // Load current settings
    loadSettings();

    // Local LLM model selection events
    const localModelSelect = document.getElementById('local-model');
    if (localModelSelect) {
        localModelSelect.addEventListener('change', updateModelInfo);
        // Initialize with default model
        updateModelInfo();
    }

    // Download model button
    const downloadModelBtn = document.getElementById('download-model');
    if (downloadModelBtn) {
        downloadModelBtn.addEventListener('click', downloadModel);
    }

    // Persona management buttons
    const loadPersonaBtn = document.getElementById('load-persona');
    const constructPersonaBtn = document.getElementById('construct-persona');
    const editPersonaBtn = document.getElementById('edit-persona');
    const exportPersonaBtn = document.getElementById('export-persona');

    if (loadPersonaBtn) loadPersonaBtn.addEventListener('click', loadPersona);
    if (constructPersonaBtn) constructPersonaBtn.addEventListener('click', constructPersona);
    if (editPersonaBtn) editPersonaBtn.addEventListener('click', editPersona);
    if (exportPersonaBtn) exportPersonaBtn.addEventListener('click', exportPersona);

    // Set up button handlers for other functions
    const exportBtn = document.getElementById('export-data');
    const clearBtn = document.getElementById('clear-data');
    const viewLogsBtn = document.getElementById('view-logs');
    const saveSettingsBtn = document.getElementById('save-settings');

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (clearBtn) clearBtn.addEventListener('click', clearData);
    if (viewLogsBtn) viewLogsBtn.addEventListener('click', openLogsPage);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

    // Connection status
    updateConnectionStatus();
});

// Update model information based on selection
function updateModelInfo() {
    const localModelSelect = document.getElementById('local-model');
    const modelSizeEl = document.getElementById('model-size');
    const modelMemoryEl = document.getElementById('model-memory');

    if (!localModelSelect || !modelSizeEl || !modelMemoryEl) return;

    const selectedModel = localModelSelect.value;

    // Update info based on selected model
    switch (selectedModel) {
        case 'smol2':
            modelSizeEl.textContent = '~500 MB';
            modelMemoryEl.textContent = '~1 GB RAM';
            break;
        case 'qwen25':
            modelSizeEl.textContent = '~800 MB';
            modelMemoryEl.textContent = '~1.5 GB RAM';
            break;
        case 'llama32':
            modelSizeEl.textContent = '~1 GB';
            modelMemoryEl.textContent = '~1.8 GB RAM';
            break;
        case 'falcon3':
            modelSizeEl.textContent = '~950 MB';
            modelMemoryEl.textContent = '~1.7 GB RAM';
            break;
        case 'deepseek':
            modelSizeEl.textContent = '~1.5 GB';
            modelMemoryEl.textContent = '~2 GB RAM';
            break;
        default:
            modelSizeEl.textContent = '500-1500 MB';
            modelMemoryEl.textContent = '1-2 GB RAM';
    }
}

// Simulate downloading a model
function downloadModel() {
    const downloadBtn = document.getElementById('download-model');
    const progressContainer = document.getElementById('download-progress');
    const progressBar = progressContainer.querySelector('.progress-bar');
    const progressText = progressContainer.querySelector('.progress-text');
    const modelStatusEl = document.getElementById('local-model-status');
    const localModelSelect = document.getElementById('local-model');

    if (!downloadBtn || !progressContainer || !progressBar || !progressText || !modelStatusEl) return;

    // Get selected model name for display
    const modelName = localModelSelect.options[localModelSelect.selectedIndex].text;

    // Show progress bar, hide button
    downloadBtn.style.display = 'none';
    progressContainer.style.display = 'block';

    let progress = 0;
    modelStatusEl.textContent = `Preparing to download ${modelName}...`;
    modelStatusEl.className = 'status-message info';

    // Simulate download progress
    const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);

            // Download complete
            modelStatusEl.textContent = `${modelName} downloaded successfully! The model is ready to use.`;
            modelStatusEl.className = 'status-message success';

            // After 2 seconds, reset UI for another download
            setTimeout(() => {
                downloadBtn.style.display = 'block';
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
                downloadBtn.textContent = 'Model Ready';
                downloadBtn.classList.remove('btn-primary');
                downloadBtn.classList.add('btn-secondary');
            }, 2000);
        }

        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }, 200);
}

// Load persona from file
function loadPersona() {
    const personaStatusEl = document.getElementById('persona-status');

    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.pmodel';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Show file picker
    fileInput.click();

    fileInput.addEventListener('change', async (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const personaData = JSON.parse(e.target.result);

                        // Validate persona data structure
                        if (!personaData.name || !personaData.type) {
                            throw new Error('Invalid persona model format');
                        }

                        // Store in local storage
                        await browser.storage.local.set({
                            activePersona: personaData
                        });

                        personaStatusEl.textContent = `Persona "${personaData.name}" loaded successfully!`;
                        personaStatusEl.className = 'status-message success';

                        // Notify any active tabs
                        await notifyTabsPersonaChanged(personaData.name);

                    } catch (parseError) {
                        personaStatusEl.textContent = `Error parsing persona file: ${parseError.message}`;
                        personaStatusEl.className = 'status-message error';
                    }
                };

                reader.onerror = () => {
                    personaStatusEl.textContent = 'Error reading file';
                    personaStatusEl.className = 'status-message error';
                };

                reader.readAsText(file);

            } catch (error) {
                personaStatusEl.textContent = `Error loading persona: ${error.message}`;
                personaStatusEl.className = 'status-message error';
            }
        }

        // Clean up
        document.body.removeChild(fileInput);
    });
}

// Construct persona from current session data
async function constructPersona() {
    const personaStatusEl = document.getElementById('persona-status');

    try {
        personaStatusEl.textContent = 'Analyzing session data...';
        personaStatusEl.className = 'status-message info';

        // Create modal for persona creation
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Create New Persona</h3>
                <div class="form-group">
                    <label for="persona-name">Persona Name</label>
                    <input type="text" id="persona-name" placeholder="My Search Assistant" />
                </div>
                <div class="form-group">
                    <label for="persona-type">Persona Type</label>
                    <select id="persona-type" class="select">
                        <option value="markov">Probabilistic (Markov Model)</option>
                        <option value="llm">LLM-Based (Agent)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="persona-sessions">Data Source</label>
                    <select id="persona-sessions" class="select">
                        <option value="current">Current Session Only</option>
                        <option value="all" selected>All Available Sessions</option>
                        <option value="week">Last 7 Days</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button id="create-persona" class="btn btn-primary">Create Persona</button>
                    <button id="cancel-persona" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('cancel-persona').addEventListener('click', () => {
            document.body.removeChild(modal);
            personaStatusEl.textContent = '';
            personaStatusEl.className = '';
        });

        document.getElementById('create-persona').addEventListener('click', async () => {
            const name = document.getElementById('persona-name').value.trim();
            const type = document.getElementById('persona-type').value;
            const dataSource = document.getElementById('persona-sessions').value;

            if (!name) {
                alert('Please enter a name for your persona');
                return;
            }

            // Simulate persona construction
            document.body.removeChild(modal);
            personaStatusEl.textContent = 'Building persona model... This may take a moment.';

            // Simulate processing delay
            setTimeout(async () => {
                try {
                    // Create a sample persona object
                    const newPersona = {
                        name: name,
                        type: type,
                        source: dataSource,
                        created: new Date().toISOString(),
                        model: {
                            // Model structure would depend on the type selected
                            version: '1.0',
                            parameters: {
                                // Sample parameters
                                contextLength: type === 'markov' ? 3 : 5,
                                threshold: 0.75,
                                topK: 10
                            }
                        }
                    };

                    // Store in local storage
                    await browser.storage.local.set({
                        activePersona: newPersona
                    });

                    personaStatusEl.textContent = `Persona "${name}" created successfully!`;
                    personaStatusEl.className = 'status-message success';

                    // Notify any active tabs
                    await notifyTabsPersonaChanged(name);

                } catch (error) {
                    personaStatusEl.textContent = `Error creating persona: ${error.message}`;
                    personaStatusEl.className = 'status-message error';
                }
            }, 2000);
        });

    } catch (error) {
        personaStatusEl.textContent = `Error: ${error.message}`;
        personaStatusEl.className = 'status-message error';
    }
}

// Edit current persona
async function editPersona() {
    const personaStatusEl = document.getElementById('persona-status');

    try {
        // Get current persona
        const result = await browser.storage.local.get('activePersona');
        const persona = result.activePersona;

        if (!persona) {
            personaStatusEl.textContent = 'No active persona to edit. Please create or load a persona first.';
            personaStatusEl.className = 'status-message info';
            return;
        }

        // Create modal for persona editing
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Edit Persona</h3>
                <div class="form-group">
                    <label for="edit-persona-name">Persona Name</label>
                    <input type="text" id="edit-persona-name" value="${persona.name}" />
                </div>
                <div class="form-group">
                    <label>Persona Type</label>
                    <input type="text" value="${persona.type === 'markov' ? 'Probabilistic (Markov Model)' : 'LLM-Based (Agent)'}" disabled />
                </div>
                <div class="form-group">
                    <label for="edit-threshold">Response Threshold</label>
                    <input type="range" id="edit-threshold" min="0" max="100" value="${(persona.model?.parameters?.threshold || 0.75) * 100}" />
                    <div class="range-value"><span id="threshold-value">${(persona.model?.parameters?.threshold || 0.75) * 100}%</span></div>
                </div>
                <div class="form-group">
                    <label for="edit-topk">Top K Suggestions</label>
                    <input type="number" id="edit-topk" min="1" max="50" value="${persona.model?.parameters?.topK || 10}" />
                </div>
                <div class="modal-actions">
                    <button id="save-persona-edits" class="btn btn-primary">Save Changes</button>
                    <button id="cancel-persona-edits" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Range slider value update
        const thresholdSlider = document.getElementById('edit-threshold');
        const thresholdValue = document.getElementById('threshold-value');

        thresholdSlider.addEventListener('input', () => {
            thresholdValue.textContent = `${thresholdSlider.value}%`;
        });

        document.getElementById('cancel-persona-edits').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('save-persona-edits').addEventListener('click', async () => {
            const name = document.getElementById('edit-persona-name').value.trim();
            const threshold = parseInt(document.getElementById('edit-threshold').value) / 100;
            const topK = parseInt(document.getElementById('edit-topk').value);

            if (!name) {
                alert('Persona name cannot be empty');
                return;
            }

            // Update persona
            persona.name = name;
            if (!persona.model) persona.model = {};
            if (!persona.model.parameters) persona.model.parameters = {};
            persona.model.parameters.threshold = threshold;
            persona.model.parameters.topK = topK;
            persona.lastModified = new Date().toISOString();

            // Save changes
            await browser.storage.local.set({
                activePersona: persona
            });

            document.body.removeChild(modal);

            personaStatusEl.textContent = 'Persona updated successfully!';
            personaStatusEl.className = 'status-message success';

            // Notify any active tabs
            await notifyTabsPersonaChanged(name);
        });

    } catch (error) {
        personaStatusEl.textContent = `Error: ${error.message}`;
        personaStatusEl.className = 'status-message error';
    }
}

// Export persona to file
async function exportPersona() {
    const personaStatusEl = document.getElementById('persona-status');

    try {
        // Get current persona
        const result = await browser.storage.local.get('activePersona');
        const persona = result.activePersona;

        if (!persona) {
            personaStatusEl.textContent = 'No active persona to export. Please create or load a persona first.';
            personaStatusEl.className = 'status-message info';
            return;
        }

        // Create blob and download
        const blob = new Blob([JSON.stringify(persona, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${persona.name.replace(/\s+/g, '_')}.pmodel`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        personaStatusEl.textContent = `Persona "${persona.name}" exported successfully!`;
        personaStatusEl.className = 'status-message success';

    } catch (error) {
        personaStatusEl.textContent = `Error exporting persona: ${error.message}`;
        personaStatusEl.className = 'status-message error';
    }
}

// Notify tabs that the persona has changed
async function notifyTabsPersonaChanged(personaName) {
    try {
        const tabs = await browser.tabs.query({
            url: "*://*.google.com/search?*"
        });

        for (const tab of tabs) {
            await browser.tabs.sendMessage(tab.id, {
                action: 'personaChanged',
                personaName: personaName,
                timestamp: Date.now()
            }).catch(err => console.error(`Failed to notify tab ${tab.id}:`, err));
        }
    } catch (error) {
        console.error('Error notifying tabs:', error);
    }
}

// API key validation
async function validateApiKey(apiKey, provider = 'openai') {
    try {
        let endpoint, headers;

        switch (provider) {
            case 'anthropic':
                endpoint = 'https://api.anthropic.com/v1/models';
                headers = {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                };
                break;
            case 'cohere':
                endpoint = 'https://api.cohere.ai/v1/models';
                headers = {
                    'Authorization': `Bearer ${apiKey}`
                };
                break;
            case 'mistral':
                endpoint = 'https://api.mistral.ai/v1/models';
                headers = {
                    'Authorization': `Bearer ${apiKey}`
                };
                break;
            case 'openai':
            default:
                endpoint = 'https://api.openai.com/v1/models';
                headers = {
                    'Authorization': `Bearer ${apiKey}`
                };
        }

        const response = await fetch(endpoint, { headers });

        if (response.ok) {
            return { valid: true };
        } else {
            const error = await response.json();
            return {
                valid: false,
                message: error.error?.message || 'API key validation failed'
            };
        }
    } catch (error) {
        return {
            valid: false,
            message: error.message || 'Network error during API key validation'
        };
    }
}

// Save and encrypt API key
async function saveApiKey() {
    const llmProviderSelect = document.getElementById('llm-provider');
    const apiKey = document.getElementById('api-key').value.trim();
    const password = document.getElementById('encryption-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const statusEl = document.getElementById('api-key-status');
    const provider = llmProviderSelect ? llmProviderSelect.value : 'openai';

    // Validate inputs
    if (!apiKey) {
        statusEl.textContent = 'Please enter an API key.';
        statusEl.className = 'status-message error';
        return;
    }

    if (password !== confirmPassword) {
        statusEl.textContent = 'Passwords do not match.';
        statusEl.className = 'status-message error';
        return;
    }

    if (password.length < 8) {
        statusEl.textContent = 'Password should be at least 8 characters.';
        statusEl.className = 'status-message error';
        return;
    }

    // Validate the API key with provider
    statusEl.textContent = 'Validating API key...';
    statusEl.className = 'status-message info';

    const validation = await validateApiKey(apiKey, provider);
    if (!validation.valid) {
        statusEl.textContent = `Invalid API key: ${validation.message}`;
        statusEl.className = 'status-message error';
        return;
    }

    try {
        // Initialize secure storage with the password
        await SecureStorage.initialize(password);

        // Store the API key and provider
        const success = await SecureStorage.storeApiKey(apiKey);

        // Store the provider
        await browser.storage.local.set({
            llm_provider: provider
        });

        if (success) {
            statusEl.textContent = `${getProviderName(provider)} API key stored securely.`;
            statusEl.className = 'status-message success';

            // Clear sensitive data
            document.getElementById('api-key').value = '';
            document.getElementById('encryption-password').value = '';
            document.getElementById('confirm-password').value = '';

            // Store in session storage and background
            sessionStorage.setItem('api_key_temp', apiKey);
            browser.runtime.sendMessage({
                action: 'storeApiKeyInBackground',
                apiKey: apiKey,
                provider: provider
            });

            // Notify background script and active tabs
            browser.runtime.sendMessage({
                action: 'apiKeyUnlocked',
                provider: provider
            });

            notifyTabsApiKeyChanged(provider);
        } else {
            statusEl.textContent = 'Failed to store API key.';
            statusEl.className = 'status-message error';
        }
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'status-message error';
    }
}

// Get friendly provider name
function getProviderName(provider) {
    switch (provider) {
        case 'anthropic': return 'Anthropic (Claude)';
        case 'cohere': return 'Cohere';
        case 'mistral': return 'Mistral AI';
        case 'openai': return 'OpenAI';
        default: return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
}

// Notify tabs that API key has changed
async function notifyTabsApiKeyChanged(provider) {
    try {
        const tabs = await browser.tabs.query({
            url: "*://*.google.com/search?*"
        });

        for (const tab of tabs) {
            await browser.tabs.sendMessage(tab.id, {
                action: 'apiKeyChanged',
                provider: provider,
                timestamp: Date.now()
            }).catch(err => console.error(`Failed to notify tab ${tab.id}:`, err));
        }
    } catch (error) {
        console.error('Error notifying tabs:', error);
    }
}

// Update connection status indicator
function updateConnectionStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('connection-status');

    if (statusDot && statusText) {
        if (navigator.onLine) {
            statusDot.classList.add('online');
            statusDot.classList.remove('offline');
            statusText.innerHTML = '<span class="status-dot online"></span> Connected';
        } else {
            statusDot.classList.add('offline');
            statusDot.classList.remove('online');
            statusText.innerHTML = '<span class="status-dot offline"></span> Offline';
        }
    }
}

// Load and display current session information
async function loadSessionInfo() {
    const sessionInfoElement = document.getElementById('session-info');
    if (!sessionInfoElement) return;

    try {
        const response = await browser.runtime.sendMessage({
            action: 'getSessionStats'
        });

        if (response) {
            const startTime = new Date(response.startTime);

            sessionInfoElement.innerHTML = `
                <div class="stat-grid">
                    <div class="stat">
                        <span class="stat-value">${response.eventCount}</span>
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
                        <span class="stat-id-value">${response.sessionId}</span>
                    </div>
                </div>
            `;

            sessionInfoElement.classList.remove('skeleton');
        } else {
            sessionInfoElement.textContent = 'No active session found.';
            sessionInfoElement.classList.remove('skeleton');
        }
    } catch (error) {
        console.error('Error loading session data:', error);
        sessionInfoElement.textContent = 'Error loading session data.';
        sessionInfoElement.classList.remove('skeleton');
    }
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format date for display
function formatDate(date) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Load settings
async function loadSettings() {
    try {
        const result = await browser.storage.local.get('settings');
        const settings = result.settings || {
            contentCapture: true,
            queryAnalysis: true,
            browsingPattern: true,
            logLevel: 'detailed',
            dataRetention: 'week'
        };

        const contentCaptureEl = document.getElementById('content-capture');
        const queryAnalysisEl = document.getElementById('query-analysis');
        const browsingPatternEl = document.getElementById('browsing-pattern');
        const logLevelEl = document.getElementById('log-level');
        const dataRetentionEl = document.getElementById('data-retention');

        if (contentCaptureEl) contentCaptureEl.checked = settings.contentCapture;
        if (queryAnalysisEl) queryAnalysisEl.checked = settings.queryAnalysis;
        if (browsingPatternEl) browsingPatternEl.checked = settings.browsingPattern;
        if (logLevelEl) logLevelEl.value = settings.logLevel;
        if (dataRetentionEl) dataRetentionEl.value = settings.dataRetention;
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings
async function saveSettings() {
    const contentCaptureEl = document.getElementById('content-capture');
    const queryAnalysisEl = document.getElementById('query-analysis');
    const browsingPatternEl = document.getElementById('browsing-pattern');
    const logLevelEl = document.getElementById('log-level');
    const dataRetentionEl = document.getElementById('data-retention');
    const saveBtn = document.getElementById('save-settings');

    if (!saveBtn) return;

    try {
        const settings = {
            contentCapture: contentCaptureEl ? contentCaptureEl.checked : true,
            queryAnalysis: queryAnalysisEl ? queryAnalysisEl.checked : true,
            browsingPattern: browsingPatternEl ? browsingPatternEl.checked : true,
            logLevel: logLevelEl ? logLevelEl.value : 'detailed',
            dataRetention: dataRetentionEl ? dataRetentionEl.value : 'week'
        };

        await browser.storage.local.set({ settings });

        // Show success notification
        const statusEl = document.createElement('div');
        statusEl.className = 'status-message success';
        statusEl.textContent = 'Settings saved successfully!';

        saveBtn.parentNode.insertBefore(statusEl, saveBtn.nextSibling);

        setTimeout(() => {
            statusEl.remove();
        }, 3000);

        // Notify background script of settings change
        browser.runtime.sendMessage({
            action: 'settingsChanged',
            settings: settings
        });
    } catch (error) {
        console.error('Error saving settings:', error);

        const statusEl = document.createElement('div');
        statusEl.className = 'status-message error';
        statusEl.textContent = 'Failed to save settings.';

        saveBtn.parentNode.insertBefore(statusEl, saveBtn.nextSibling);

        setTimeout(() => {
            statusEl.remove();
        }, 3000);
    }
}

// Export all data
async function exportData() {
    try {
        await browser.runtime.sendMessage({
            action: 'exportData'
        });
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data.');
    }
}

// Clear all stored data
async function clearData() {
    // Create a modal for confirmation
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Confirm Data Deletion</h3>
            <p>Are you sure you want to clear all stored data? This action cannot be undone.</p>
            <div class="modal-actions">
                <button id="confirm-clear" class="btn btn-danger">Delete All Data</button>
                <button id="cancel-clear" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('confirm-clear').addEventListener('click', async () => {
        try {
            await browser.storage.local.clear();

            // Reinitialize with default settings
            await browser.storage.local.set({
                sessions: [],
                detailedLogs: [],
                settings: {
                    contentCapture: true,
                    queryAnalysis: true,
                    browsingPattern: true,
                    logLevel: 'detailed',
                    dataRetention: 'week'
                }
            });

            // Show success message
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Success</h3>
                    <p>All data has been cleared successfully.</p>
                    <div class="modal-actions">
                        <button id="close-modal" class="btn btn-primary">Close</button>
                    </div>
                </div>
            `;

            document.getElementById('close-modal').addEventListener('click', () => {
                modal.remove();
            });

            loadSessionInfo();
            loadSettings();
        } catch (error) {
            console.error('Error clearing data:', error);

            // Show error message
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Error</h3>
                    <p>Failed to clear data: ${error.message}</p>
                    <div class="modal-actions">
                        <button id="close-modal" class="btn btn-primary">Close</button>
                    </div>
                </div>
            `;

            document.getElementById('close-modal').addEventListener('click', () => {
                modal.remove();
            });
        }
    });

    document.getElementById('cancel-clear').addEventListener('click', () => {
        modal.remove();
    });
}

// Open logs page in a new tab
function openLogsPage() {
    browser.tabs.create({
        url: '/pages/logs.html'
    });
}

// Listen for online/offline events
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);