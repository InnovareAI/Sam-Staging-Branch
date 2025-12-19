/**
 * SAM LinkedIn Assistant - Content Script
 * Detects LinkedIn posts and adds "Generate Comment with SAM" buttons
 */

console.log('🤖 SAM LinkedIn Assistant loaded');

// Configuration
const CONFIG = {
  samApiUrl: '', // Will be loaded from storage
  workspaceId: '',
  checkInterval: 2000, // Check for new posts every 2 seconds
};

// Load config from Chrome storage
chrome.storage.sync.get(['samApiUrl', 'workspaceId', 'apiKey'], (data) => {
  if (data.samApiUrl) CONFIG.samApiUrl = data.samApiUrl;
  if (data.workspaceId) CONFIG.workspaceId = data.workspaceId;
  console.log('✅ SAM config loaded:', { apiUrl: CONFIG.samApiUrl, workspace: CONFIG.workspaceId });
});

// Track processed posts to avoid duplicates
const processedPosts = new Set();

/**
 * Extract post data from LinkedIn DOM
 */
function extractPostData(postElement) {
  try {
    // Get post text
    const postTextElement = postElement.querySelector('.feed-shared-update-v2__description');
    const postText = postTextElement?.innerText?.trim() || '';

    // Get author info
    const authorElement = postElement.querySelector('.update-components-actor__name');
    const authorName = authorElement?.innerText?.trim() || 'Unknown';

    const authorTitleElement = postElement.querySelector('.update-components-actor__description');
    const authorTitle = authorTitleElement?.innerText?.trim() || '';

    // Get post URL/ID
    const postUrlElement = postElement.querySelector('a[href*="/feed/update/"]');
    const postUrl = postUrlElement?.href || '';
    const postId = postUrl.match(/urn:li:activity:(\d+)/)?.[1] || Date.now().toString();

    // Get engagement metrics
    const likesElement = postElement.querySelector('.social-details-social-counts__reactions-count');
    const likesText = likesElement?.innerText?.trim() || '0';
    const likesCount = parseInt(likesText.replace(/,/g, '')) || 0;

    const commentsElement = postElement.querySelector('.social-details-social-counts__comments');
    const commentsText = commentsElement?.innerText?.trim() || '0 comments';
    const commentsCount = parseInt(commentsText.match(/\d+/)?.[0] || '0') || 0;

    return {
      id: postId,
      text: postText,
      author: {
        name: authorName,
        title: authorTitle,
      },
      engagement: {
        likes: likesCount,
        comments: commentsCount,
      },
      url: postUrl,
    };
  } catch (error) {
    console.error('Error extracting post data:', error);
    return null;
  }
}

/**
 * Create SAM button for a post
 */
function createSamButton(postElement, postData) {
  const button = document.createElement('button');
  button.className = 'sam-comment-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    <span>Generate with SAM</span>
  `;

  button.onclick = async () => {
    await generateComment(postElement, postData, button);
  };

  return button;
}

/**
 * Generate comment using SAM API
 */
async function generateComment(postElement, postData, button) {
  try {
    // Update button state
    button.disabled = true;
    button.innerHTML = `
      <span class="sam-spinner"></span>
      <span>Generating...</span>
    `;

    // Get API credentials
    const { samApiUrl, workspaceId, apiKey } = await chrome.storage.sync.get([
      'samApiUrl',
      'workspaceId',
      'apiKey',
    ]);

    if (!samApiUrl || !workspaceId) {
      throw new Error('SAM not configured. Please set API URL and Workspace ID in extension settings.');
    }

    // Create a simplified API endpoint for the extension
    // We'll call a new endpoint that accepts post text directly
    const response = await fetch(`${samApiUrl}/api/linkedin-commenting/generate-from-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || ''}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        post_text: postData.text,
        author_name: postData.author.name,
        author_title: postData.author.title,
        engagement: postData.engagement,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate comment');
    }

    const result = await response.json();

    if (result.skipped) {
      showNotification(postElement, '⏭️ SAM decided to skip this post: ' + result.reason, 'warning');
      return;
    }

    // Insert comment into LinkedIn's comment box
    insertCommentIntoLinkedIn(postElement, result.comment_text);

    // Show success notification
    showNotification(
      postElement,
      `✅ Comment generated (${Math.round(result.confidence_score * 100)}% confidence)`,
      'success'
    );

    // Reset button
    button.disabled = false;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Regenerate</span>
    `;
  } catch (error) {
    console.error('Error generating comment:', error);
    showNotification(postElement, `❌ Error: ${error.message}`, 'error');

    // Reset button
    button.disabled = false;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>Try Again</span>
    `;
  }
}

/**
 * Insert generated comment into LinkedIn's comment input
 */
function insertCommentIntoLinkedIn(postElement, commentText) {
  try {
    // Find the comment button to open the comment box
    const commentButton = postElement.querySelector('button[aria-label*="Comment"]');
    if (commentButton && !postElement.querySelector('.comments-comment-box')) {
      commentButton.click();
      // Wait for comment box to appear
      setTimeout(() => insertText(postElement, commentText), 500);
    } else {
      insertText(postElement, commentText);
    }
  } catch (error) {
    console.error('Error inserting comment:', error);
  }
}

function insertText(postElement, commentText) {
  // Find the comment input box
  const commentBox = postElement.querySelector('.ql-editor[contenteditable="true"]');

  if (commentBox) {
    // LinkedIn uses a rich text editor (Quill)
    commentBox.focus();
    commentBox.innerHTML = `<p>${commentText}</p>`;

    // Trigger input event to update LinkedIn's state
    const inputEvent = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(inputEvent);

    // Scroll to comment box
    commentBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight the comment box briefly
    commentBox.style.backgroundColor = '#fffbea';
    setTimeout(() => {
      commentBox.style.backgroundColor = '';
    }, 2000);
  } else {
    console.error('Could not find comment input box');
    throw new Error('Could not find comment input box');
  }
}

/**
 * Show notification banner on post
 */
function showNotification(postElement, message, type = 'info') {
  // Remove existing notification
  const existing = postElement.querySelector('.sam-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `sam-notification sam-notification-${type}`;
  notification.textContent = message;

  // Insert at top of post
  const feedShared = postElement.querySelector('.feed-shared-update-v2__description');
  if (feedShared) {
    feedShared.parentElement.insertBefore(notification, feedShared);
  }

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

/**
 * Process a LinkedIn post element
 */
function processPost(postElement) {
  // Check if already processed
  const postId = postElement.dataset.samProcessed;
  if (postId) return;

  // Extract post data
  const postData = extractPostData(postElement);
  if (!postData || !postData.text) return;

  // Mark as processed
  const uniqueId = `post-${postData.id}`;
  postElement.dataset.samProcessed = uniqueId;
  processedPosts.add(uniqueId);

  // Find the action bar (like, comment, share buttons)
  const actionBar = postElement.querySelector('.social-details-social-activity');
  if (!actionBar) return;

  // Create and insert SAM button
  const samButton = createSamButton(postElement, postData);

  // Insert button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'sam-button-container';
  buttonContainer.appendChild(samButton);

  // Insert after the action bar
  actionBar.parentElement.insertBefore(buttonContainer, actionBar.nextSibling);

  console.log('✅ Added SAM button to post:', postData.author.name);
}

/**
 * Scan page for LinkedIn posts
 */
function scanForPosts() {
  const posts = document.querySelectorAll('.feed-shared-update-v2');

  posts.forEach((post) => {
    processPost(post);
  });
}

// Initial scan
scanForPosts();

// Set up MutationObserver to detect new posts as user scrolls
const observer = new MutationObserver((mutations) => {
  scanForPosts();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Periodic scan as backup
setInterval(scanForPosts, CONFIG.checkInterval);

console.log('🔍 SAM is watching for LinkedIn posts...');
