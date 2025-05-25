document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('linkedin-url');
    const pasteBtn = document.getElementById('paste-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusMessage = document.getElementById('status-message');
    const progressContainer = document.getElementById('progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');

    // Load saved preferences
    loadPreferences();

    // Event listeners
    pasteBtn.addEventListener('click', pasteFromClipboard);
    urlInput.addEventListener('input', validateUrl);
    downloadBtn.addEventListener('click', startDownload);
    
    // Save preferences when changed
    document.querySelectorAll('input[name="layout"]').forEach(radio => {
        radio.addEventListener('change', savePreferences);
    });
    document.getElementById('dpi-select').addEventListener('change', savePreferences);

    async function pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            validateUrl();
            showStatus('URL pasted successfully!', 'success');
        } catch (err) {
            showStatus('Unable to paste from clipboard. Please paste manually.', 'error');
        }
    }

    function validateUrl() {
        const url = urlInput.value.trim();
        const isValid = isLinkedInUrl(url);
        downloadBtn.disabled = !isValid;
        
        if (url && !isValid) {
            showStatus('Please enter a valid LinkedIn post URL', 'error');
        } else if (isValid) {
            showStatus('Valid LinkedIn URL detected!', 'success');
        } else {
            hideStatus();
        }
    }

    function isLinkedInUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('linkedin.com') && 
                   (urlObj.pathname.includes('/posts/') || 
                    urlObj.pathname.includes('/feed/update/'));
        } catch {
            return false;
        }
    }

    async function startDownload() {
        const url = urlInput.value.trim();
        if (!isLinkedInUrl(url)) {
            showStatus('Please enter a valid LinkedIn URL', 'error');
            return;
        }

        setLoadingState(true);
        showProgress(0);
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get preferences
            const layout = document.querySelector('input[name="layout"]:checked').value;
            const dpi = parseInt(document.getElementById('dpi-select').value);
            
            showStatus('Navigating to LinkedIn post...', 'info');
            
            // Navigate to the LinkedIn post
            await chrome.tabs.update(tab.id, { url: url });
            
            // Wait for page to load
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });

            showProgress(25);
            showStatus('Extracting carousel data...', 'info');

            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractCarouselData',
                options: { layout, dpi }
            });

            if (response.success) {
                showProgress(50);
                showStatus('Processing images...', 'info');
                
                // Process in background script
                const result = await chrome.runtime.sendMessage({
                    action: 'processCarousel',
                    data: response.data,
                    options: { layout, dpi }
                });

                if (result.success) {
                    showProgress(100);
                    showStatus('Download completed successfully!', 'success');
                    
                    // Close popup after short delay
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                } else {
                    throw new Error(result.error || 'Failed to process carousel');
                }
            } else {
                throw new Error(response.error || 'Failed to extract carousel data');
            }

        } catch (error) {
            console.error('Download error:', error);
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            setLoadingState(false);
            hideProgress();
        }
    }

    function setLoadingState(isLoading) {
        downloadBtn.disabled = isLoading;
        btnText.style.display = isLoading ? 'none' : 'inline';
        btnLoader.style.display = isLoading ? 'inline-flex' : 'none';
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        statusMessage.classList.remove('hidden');
    }

    function hideStatus() {
        statusMessage.classList.add('hidden');
    }

    function showProgress(percentage) {
        progressContainer.classList.remove('hidden');
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }

    function hideProgress() {
        progressContainer.classList.add('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }

    function savePreferences() {
        const preferences = {
            layout: document.querySelector('input[name="layout"]:checked').value,
            dpi: document.getElementById('dpi-select').value
        };
        chrome.storage.sync.set({ preferences });
    }

    function loadPreferences() {
        chrome.storage.sync.get(['preferences'], function(result) {
            if (result.preferences) {
                const { layout, dpi } = result.preferences;
                
                if (layout) {
                    document.querySelector(`input[name="layout"][value="${layout}"]`).checked = true;
                }
                if (dpi) {
                    document.getElementById('dpi-select').value = dpi;
                }
            }
        });
    }
});
