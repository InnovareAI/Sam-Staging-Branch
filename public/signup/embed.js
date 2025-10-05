/**
 * SAM AI Signup Modal Embed Script
 *
 * Usage in WordPress/Elementor:
 * 1. Add this script to your page:
 *    <script src="https://app.meet-sam.com/signup/embed.js"></script>
 *
 * 2. Add a button to trigger the modal:
 *    <button onclick="SAMSignup.open()">Start Free Trial</button>
 *
 * 3. (Optional) Auto-open on page load:
 *    <script>
 *      window.addEventListener('load', () => SAMSignup.open());
 *    </script>
 */

(function() {
  'use strict';

  const SAMSignup = {
    modal: null,
    iframe: null,

    /**
     * Open the signup modal
     */
    open: function() {
      if (this.modal) {
        this.modal.style.display = 'flex';
        return;
      }

      this.createModal();
    },

    /**
     * Close the signup modal
     */
    close: function() {
      if (this.modal) {
        this.modal.style.display = 'none';
      }
    },

    /**
     * Create modal overlay and iframe
     */
    createModal: function() {
      // Create modal overlay
      this.modal = document.createElement('div');
      this.modal.id = 'sam-signup-modal';
      this.modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        padding: 20px;
      `;

      // Create iframe container
      const container = document.createElement('div');
      container.style.cssText = `
        position: relative;
        width: 100%;
        max-width: 800px;
        height: 90vh;
        max-height: 900px;
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      `;

      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        font-size: 28px;
        line-height: 1;
        cursor: pointer;
        z-index: 1;
        color: #333;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
      `;
      closeBtn.onmouseover = () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 1)';
        closeBtn.style.transform = 'scale(1.1)';
      };
      closeBtn.onmouseout = () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.9)';
        closeBtn.style.transform = 'scale(1)';
      };
      closeBtn.onclick = () => this.close();

      // Create iframe
      this.iframe = document.createElement('iframe');

      // Use localhost for local testing, production URL otherwise
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.iframe.src = isLocal
        ? 'http://localhost:3000/signup/innovareai'
        : 'https://app.meet-sam.com/signup/innovareai';

      this.iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 12px;
      `;
      this.iframe.title = 'SAM AI Signup';

      // Assemble modal
      container.appendChild(closeBtn);
      container.appendChild(this.iframe);
      this.modal.appendChild(container);
      document.body.appendChild(this.modal);

      // Close on outside click
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });

      // Close on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal.style.display === 'flex') {
          this.close();
        }
      });

      // Listen for signup completion message from iframe
      window.addEventListener('message', (event) => {
        if (event.origin !== 'https://app.meet-sam.com') return;

        if (event.data.type === 'SAM_SIGNUP_COMPLETE') {
          // Close modal and redirect to workspace
          this.close();
          if (event.data.workspaceId) {
            window.location.href = `https://app.meet-sam.com/workspace/${event.data.workspaceId}`;
          }
        }
      });
    }
  };

  // Expose globally
  window.SAMSignup = SAMSignup;
})();
