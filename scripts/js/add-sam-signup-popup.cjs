/**
 * Add Signup Popup to SAM Page on InnovareAI.com
 *
 * Uses WordPress REST API to inject signup modal into the /sam page
 */

const https = require('https');

// WordPress credentials from .env.local
const WP_URL = 'https://innovareai.com';
const WP_USER = 'admin@innovareai.com';
const WP_APP_PASSWORD = 'AUM1a6SGg6QTmDpSuCXuujt0F231cvJb';

// Signup popup HTML to inject
const SIGNUP_POPUP_HTML = `
<!-- SAM AI Signup Modal -->
<div id="sam-signup-modal" style="display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
  <div style="position: relative; background: white; margin: 5% auto; padding: 40px; max-width: 500px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    <span id="sam-modal-close" style="position: absolute; top: 15px; right: 20px; font-size: 28px; font-weight: bold; cursor: pointer; color: #999;">&times;</span>

    <h2 style="text-align: center; margin-bottom: 10px; color: #1a1a1a;">Start Your Free Trial</h2>
    <p style="text-align: center; color: #666; margin-bottom: 30px;">Join thousands of sales teams using SAM AI</p>

    <form id="sam-signup-form" style="display: flex; flex-direction: column; gap: 15px;">
      <input type="text" id="signup-name" placeholder="Full Name" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="email" id="signup-email" placeholder="Work Email" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <input type="text" id="signup-company" placeholder="Company Name" required
        style="padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">

      <button type="submit"
        style="padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: transform 0.2s;">
        Start Free Trial →
      </button>
    </form>

    <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
      No credit card required • 14-day free trial
    </p>
  </div>
</div>

<script>
(function() {
  const modal = document.getElementById('sam-signup-modal');
  const closeBtn = document.getElementById('sam-modal-close');
  const form = document.getElementById('sam-signup-form');

  // Show modal on CTA button click
  document.addEventListener('click', function(e) {
    if (e.target.matches('.sam-cta-button, .start-trial-btn, [href*="signup"]')) {
      e.preventDefault();
      modal.style.display = 'block';
    }
  });

  // Close modal
  closeBtn.onclick = function() {
    modal.style.display = 'none';
  };

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  };

  // Handle form submission
  form.onsubmit = async function(e) {
    e.preventDefault();

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const company = document.getElementById('signup-company').value;

    // Redirect to app signup with pre-filled data
    const signupUrl = 'https://app.meet-sam.com/signup/innovareai?' +
      new URLSearchParams({
        name: name,
        email: email,
        company: company,
        source: 'sam-landing-page'
      });

    window.location.href = signupUrl;
  };
})();
</script>
`;

// Function to make WordPress REST API request
function wpRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

    const options = {
      hostname: 'innovareai.com',
      path: `/wp-json/wp/v2${endpoint}`,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function addSignupPopup() {
  console.log('🚀 Adding Signup Popup to SAM Page\n');

  try {
    // 1. Find the SAM page
    console.log('1. Finding SAM page...');
    const pages = await wpRequest('GET', '/pages?slug=sam');

    if (pages.length === 0) {
      console.log('   ❌ SAM page not found');
      console.log('   Available pages:');
      const allPages = await wpRequest('GET', '/pages?per_page=20');
      allPages.forEach(p => console.log(`   - ${p.slug} (ID: ${p.id})`));
      return;
    }

    const samPage = pages[0];
    console.log(`   ✅ Found SAM page (ID: ${samPage.id})`);
    console.log(`   URL: ${samPage.link}`);

    // 2. Get current page content
    console.log('\n2. Fetching current page content...');
    const currentContent = samPage.content.rendered || samPage.content.raw || '';
    console.log(`   Current content length: ${currentContent.length} characters`);

    // 3. Check if popup already exists
    if (currentContent.includes('sam-signup-modal')) {
      console.log('   ⚠️  Signup modal already exists on page');
      console.log('   Skipping injection to avoid duplicates');
      return;
    }

    // 4. Inject popup at end of content
    console.log('\n3. Injecting signup popup...');
    const updatedContent = currentContent + '\n\n' + SIGNUP_POPUP_HTML;

    const updateData = {
      content: updatedContent
    };

    const updated = await wpRequest('POST', `/pages/${samPage.id}`, updateData);

    console.log('   ✅ Popup injected successfully');
    console.log(`   Updated page: ${updated.link}`);

    // 5. Verify injection
    console.log('\n4. Verifying popup injection...');
    const verified = await wpRequest('GET', `/pages/${samPage.id}`);
    const verifiedContent = verified.content.rendered || verified.content.raw || '';

    if (verifiedContent.includes('sam-signup-modal')) {
      console.log('   ✅ Popup verified on page');
      console.log('\n✅ Signup popup successfully added to SAM page!');
      console.log('\n📝 Next steps:');
      console.log('   1. Visit https://innovareai.com/sam/');
      console.log('   2. Click any CTA button to test the popup');
      console.log('   3. Verify form submission redirects to app signup');
    } else {
      console.log('   ❌ Popup not found after update');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('401')) {
      console.log('\n💡 Authentication failed. Please verify:');
      console.log('   1. WordPress Application Password is correct');
      console.log('   2. Username is correct: admin@innovareai.com');
      console.log('   3. Application Password has not expired');
    }
  }
}

// Run the script
addSignupPopup();
