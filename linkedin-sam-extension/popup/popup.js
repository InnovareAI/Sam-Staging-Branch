/**
 * SAM LinkedIn Assistant - Popup Script
 */

// Load saved configuration
document.addEventListener('DOMContentLoaded', () => {
  loadConfiguration();
  loadStats();
  setupEventListeners();
});

function loadConfiguration() {
  chrome.storage.sync.get(['samApiUrl', 'workspaceId', 'apiKey'], (data) => {
    if (data.samApiUrl) {
      document.getElementById('samApiUrl').value = data.samApiUrl;
    }
    if (data.workspaceId) {
      document.getElementById('workspaceId').value = data.workspaceId;
    }
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
    }

    // Update status
    updateStatus(data);
  });
}

function updateStatus(data) {
  const statusElement = document.getElementById('status');
  const statusDot = statusElement.querySelector('.status-dot');
  const statusText = statusElement.querySelector('.status-text');

  if (data.samApiUrl && data.workspaceId) {
    statusElement.classList.add('connected');
    statusText.textContent = 'Connected';
  } else {
    statusElement.classList.remove('connected');
    statusText.textContent = 'Not configured';
  }
}

function loadStats() {
  chrome.storage.local.get(['commentsGenerated', 'postsProcessed'], (data) => {
    const commentsGenerated = data.commentsGenerated || 0;
    const postsProcessed = data.postsProcessed || 0;

    document.getElementById('commentsGenerated').textContent = commentsGenerated;
    document.getElementById('postsProcessed').textContent = postsProcessed;

    // Show stats section if there are any stats
    if (commentsGenerated > 0 || postsProcessed > 0) {
      document.getElementById('statsSection').style.display = 'block';
    }
  });
}

function setupEventListeners() {
  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveConfiguration);

  // Reset stats button
  document.getElementById('resetStatsBtn').addEventListener('click', resetStats);

  // Help link
  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/your-repo/sam-extension/wiki' });
  });

  // Enter key to save
  document.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveConfiguration();
      }
    });
  });
}

async function saveConfiguration() {
  const saveBtn = document.getElementById('saveBtn');
  const messageEl = document.getElementById('saveMessage');

  // Get values
  const samApiUrl = document.getElementById('samApiUrl').value.trim();
  const workspaceId = document.getElementById('workspaceId').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();

  // Validate
  if (!samApiUrl) {
    showMessage('Please enter SAM API URL', 'error');
    return;
  }

  if (!workspaceId) {
    showMessage('Please enter Workspace ID', 'error');
    return;
  }

  // Validate URL format
  try {
    new URL(samApiUrl);
  } catch (e) {
    showMessage('Invalid API URL format', 'error');
    return;
  }

  // Update button state
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    // Test connection to SAM
    const response = await fetch(`${samApiUrl}/api/linkedin-commenting/settings?workspace_id=${workspaceId}`, {
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to connect to SAM. Please check your API URL and Workspace ID.');
    }

    // Save to Chrome storage
    await chrome.storage.sync.set({
      samApiUrl,
      workspaceId,
      apiKey,
    });

    // Update status
    updateStatus({ samApiUrl, workspaceId, apiKey });

    showMessage('✅ Configuration saved successfully!', 'success');

    // Reload content script on active LinkedIn tab
    chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id);
      });
    });
  } catch (error) {
    console.error('Error saving configuration:', error);
    showMessage(`❌ ${error.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Configuration';
  }
}

function showMessage(text, type) {
  const messageEl = document.getElementById('saveMessage');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}

function resetStats() {
  if (confirm('Are you sure you want to reset all statistics?')) {
    chrome.storage.local.set({
      commentsGenerated: 0,
      postsProcessed: 0,
    }, () => {
      loadStats();
      showMessage('Stats reset successfully', 'success');
    });
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COMMENT_GENERATED') {
    // Increment stats
    chrome.storage.local.get(['commentsGenerated', 'postsProcessed'], (data) => {
      chrome.storage.local.set({
        commentsGenerated: (data.commentsGenerated || 0) + 1,
        postsProcessed: (data.postsProcessed || 0) + 1,
      }, () => {
        loadStats();
      });
    });
  }
});
