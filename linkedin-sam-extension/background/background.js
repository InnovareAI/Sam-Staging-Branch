/**
 * SAM LinkedIn Assistant - Background Service Worker
 */

console.log('🤖 SAM Background Service Worker loaded');

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('SAM LinkedIn Assistant installed');

    // Open welcome page
    chrome.tabs.create({
      url: 'popup/popup.html'
    });
  } else if (details.reason === 'update') {
    console.log('SAM LinkedIn Assistant updated');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_COMMENT') {
    handleCommentGeneration(message.data, sender.tab.id)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

async function handleCommentGeneration(data, tabId) {
  try {
    // Get configuration
    const config = await chrome.storage.sync.get(['samApiUrl', 'workspaceId', 'apiKey']);

    if (!config.samApiUrl || !config.workspaceId) {
      throw new Error('SAM not configured. Please configure in extension popup.');
    }

    // Make API request to SAM
    const response = await fetch(`${config.samApiUrl}/api/linkedin-commenting/generate-from-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : '',
      },
      body: JSON.stringify({
        workspace_id: config.workspaceId,
        ...data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate comment');
    }

    const result = await response.json();

    // Update stats
    chrome.storage.local.get(['commentsGenerated'], (stats) => {
      chrome.storage.local.set({
        commentsGenerated: (stats.commentsGenerated || 0) + 1,
      });
    });

    return result;
  } catch (error) {
    console.error('Error generating comment:', error);
    throw error;
  }
}

// Badge updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.commentsGenerated) {
    const count = changes.commentsGenerated.newValue || 0;
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#ec4899' });
    }
  }
});
