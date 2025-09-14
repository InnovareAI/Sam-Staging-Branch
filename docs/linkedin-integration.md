# LinkedIn Integration Documentation

## Overview

The SAM AI LinkedIn integration provides secure connection and management of LinkedIn accounts through the Unipile API. This system enables prospect research, personalized outreach, and LinkedIn messaging capabilities.

## Architecture

### Components

1. **LinkedInOnboarding.tsx** - React modal component for account connection
2. **API Route** - `/api/unipile/accounts` for backend Unipile integration
3. **Profile Management** - Connection status and account management in main app

### Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Integration**: Unipile API for LinkedIn connectivity
- **Verification**: Google reCAPTCHA for security challenges

## Features

### ✅ Account Connection Flow

1. **Initial Connection**
   - Official LinkedIn branding and logos
   - Secure credential input with password visibility toggle
   - Privacy-compliant design (no exposure of other users' accounts)

2. **Multi-Factor Authentication**
   - **Push Notifications**: Auto-polling for mobile approval
   - **Manual Codes**: 6-digit authentication code entry
   - Automatic detection and progression after approval

3. **CAPTCHA Verification**
   - Real Google reCAPTCHA integration
   - Dynamic script loading and widget rendering
   - Automatic response capture and validation

4. **Connection Management**
   - Real-time status checking
   - Connect/Disconnect functionality
   - Skip preferences with localStorage persistence

### ✅ Security Features

- Encrypted credential transmission
- No storage of LinkedIn credentials
- Session-based authentication
- Privacy-compliant account isolation
- Secure API key management

## API Integration

### Unipile Configuration

```env
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=your_api_key_here
```

### API Endpoints

#### GET `/api/unipile/accounts`
Returns LinkedIn connection status for the current session.

**Response:**
```json
{
  "success": true,
  "has_linkedin": true,
  "connection_status": "connected",
  "message": "LinkedIn integration is available",
  "timestamp": "2025-09-13T18:01:43.048Z"
}
```

#### POST `/api/unipile/accounts`
Creates or reconnects LinkedIn accounts.

**Request Body:**
```json
{
  "action": "create",
  "linkedin_credentials": {
    "username": "user@example.com",
    "password": "secure_password",
    "twoFaCode": "123456" // Optional
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "action": "created",
  "account": { /* Unipile account object */ },
  "timestamp": "2025-09-13T18:01:43.048Z"
}
```

**Response (2FA Required):**
```json
{
  "success": false,
  "error": "LinkedIn requires 2-factor authentication. Please complete the verification.",
  "requires_2fa": true,
  "checkpoint_type": "IN_APP_VALIDATION",
  "account_id": "account_id_here",
  "timestamp": "2025-09-13T18:01:43.048Z"
}
```

**Response (CAPTCHA Required):**
```json
{
  "success": false,
  "error": "LinkedIn requires CAPTCHA verification. Please complete the verification below.",
  "requires_captcha": true,
  "checkpoint_type": "CAPTCHA",
  "account_id": "account_id_here",
  "captcha_data": {
    "public_key": "3117BF26-4762-4F5A-8ED9-A85E69209A46",
    "data": "encrypted_captcha_data"
  },
  "timestamp": "2025-09-13T18:01:43.048Z"
}
```

#### DELETE `/api/unipile/accounts`
Disconnects LinkedIn accounts.

**Request Body:**
```json
{
  "account_id": "specific_account_id"
}
```

## Component Usage

### LinkedInOnboarding Modal

```tsx
import LinkedInOnboarding from '../components/LinkedInOnboarding';

function MyApp() {
  const [showLinkedInOnboarding, setShowLinkedInOnboarding] = useState(false);
  const [hasLinkedInConnection, setHasLinkedInConnection] = useState(false);

  const handleComplete = () => {
    setShowLinkedInOnboarding(false);
    setHasLinkedInConnection(true);
    // Refresh connection status
  };

  const handleSkip = () => {
    setShowLinkedInOnboarding(false);
    // Set skip preference
  };

  return (
    <>
      {/* Your app content */}
      <LinkedInOnboarding
        isOpen={showLinkedInOnboarding}
        onClose={handleSkip}
        onComplete={handleComplete}
      />
    </>
  );
}
```

### Connection Status Management

```tsx
// Check LinkedIn connection status
const checkLinkedInConnection = async () => {
  try {
    setLinkedInLoading(true);
    const response = await fetch('/api/unipile/accounts');
    if (response.ok) {
      const data = await response.json();
      setHasLinkedInConnection(data.has_linkedin || false);
    } else {
      setHasLinkedInConnection(false);
    }
  } catch (error) {
    console.error('LinkedIn status check failed:', error);
    setHasLinkedInConnection(false);
  } finally {
    setLinkedInLoading(false);
  }
};

// Disconnect LinkedIn accounts
const disconnectLinkedIn = async () => {
  const confirmed = window.confirm(
    'Are you sure you want to disconnect all LinkedIn accounts?'
  );
  
  if (confirmed) {
    try {
      setIsDisconnectingLinkedIn(true);
      // Call disconnect API
      setHasLinkedInConnection(false);
      localStorage.removeItem('linkedin-onboarding-skipped');
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnectingLinkedIn(false);
    }
  }
};
```

## User Interface

### Connection States

1. **Disconnected State**
   - Red status indicator
   - "Connect LinkedIn" button with official logo
   - Clear messaging about missing functionality

2. **Connected State**
   - Green status indicator
   - "Manage LinkedIn" and "Disconnect" buttons
   - Feature availability confirmation

3. **Loading States**
   - Spinner indicators during status checks
   - Loading text for connection attempts
   - Disabled buttons during operations

### Modal Flow

1. **Step 1: Welcome**
   - Feature benefits overview
   - Security assurance messaging
   - Connect/Skip options

2. **Step 2: Credentials**
   - Email/username input
   - Password input with visibility toggle
   - 2FA interface (when required)
   - CAPTCHA interface (when required)

3. **Step 3: Success**
   - Connection confirmation
   - Available features summary
   - Option to connect different account

## Verification Handling

### 2FA Integration

The system supports multiple 2FA methods:

**Push Notifications:**
- Automatic polling every 3 seconds
- Mobile device instructions
- Auto-progression on approval

**Manual Codes:**
- 6-digit code input
- Authenticator app/SMS support
- Real-time validation

### CAPTCHA Integration

Google reCAPTCHA v2 integration:

**Script Loading:**
```javascript
// Dynamic script loading
const script = document.createElement('script');
script.src = 'https://www.google.com/recaptcha/api.js';
script.async = true;
script.defer = true;
document.head.appendChild(script);
```

**Widget Rendering:**
```javascript
window.grecaptcha.render('linkedin-captcha', {
  sitekey: captchaData.public_key,
  callback: (response) => {
    setCaptchaResponse(response);
  },
  'expired-callback': () => {
    setCaptchaResponse('');
  }
});
```

## Error Handling

### Common Error Scenarios

1. **Invalid Credentials**
   - Clear error messaging
   - Retry functionality
   - No sensitive data exposure

2. **Network Issues**
   - Connection timeout handling
   - Retry mechanisms
   - User-friendly error messages

3. **API Rate Limits**
   - Exponential backoff
   - User notification
   - Retry scheduling

4. **Verification Failures**
   - CAPTCHA expiration handling
   - 2FA timeout management
   - Clear retry instructions

### Error Response Format

```json
{
  "success": false,
  "error": "User-friendly error message",
  "requires_2fa": false,
  "requires_captcha": false,
  "timestamp": "2025-09-13T18:01:43.048Z"
}
```

## Security Considerations

### Data Protection

- ✅ No credential storage
- ✅ Encrypted API transmission
- ✅ Session-based authentication
- ✅ Privacy-compliant account isolation
- ✅ Secure environment variable management

### Authentication Flow

- ✅ Multi-factor authentication support
- ✅ CAPTCHA verification
- ✅ Session validation
- ✅ Account reconnection logic
- ✅ Duplicate account prevention

### Privacy Compliance

- ✅ No cross-user data exposure
- ✅ Minimal data collection
- ✅ Clear consent messaging
- ✅ Data retention policies
- ✅ User control over connections

## Troubleshooting

### Common Issues

**1. Modal not showing verification interface**
- Check if CAPTCHA/2FA data is properly received
- Verify script loading for reCAPTCHA
- Check browser console for JavaScript errors

**2. Connection status not updating**
- Call `checkLinkedInConnection()` after operations
- Verify API endpoint accessibility
- Check network connectivity

**3. 2FA not auto-progressing**
- Ensure polling is active for push notifications
- Check mobile device for approval notifications
- Verify account has 2FA enabled

**4. CAPTCHA not loading**
- Check internet connectivity
- Verify reCAPTCHA script loading
- Check for ad blockers blocking reCAPTCHA

### Debug Information

Enable debug logging:
```javascript
// In LinkedInOnboarding component
console.log('CAPTCHA data:', captchaData);
console.log('2FA polling active:', pushNotificationPolling);
console.log('Connection status:', hasLinkedInConnection);
```

Monitor API requests:
```bash
# Check connection status
curl -X GET http://localhost:3002/api/unipile/accounts

# Test account creation
curl -X POST http://localhost:3002/api/unipile/accounts \
  -H "Content-Type: application/json" \
  -d '{"action":"create","linkedin_credentials":{"username":"test","password":"test"}}'
```

## Deployment Checklist

### Environment Variables
- [ ] `UNIPILE_DSN` configured
- [ ] `UNIPILE_API_KEY` configured
- [ ] API credentials tested

### Security
- [ ] HTTPS enabled for production
- [ ] API keys secured
- [ ] Error logging configured
- [ ] Rate limiting implemented

### Testing
- [ ] Connection flow tested
- [ ] 2FA scenarios verified
- [ ] CAPTCHA integration tested
- [ ] Disconnect functionality verified
- [ ] Error handling confirmed

### Monitoring
- [ ] Connection success/failure rates
- [ ] API response times
- [ ] User completion rates
- [ ] Error frequency tracking

## Future Enhancements

### Planned Features
- [ ] Multiple LinkedIn account support
- [ ] Connection health monitoring
- [ ] Advanced error recovery
- [ ] Performance optimization
- [ ] Enhanced security features

### API Improvements
- [ ] Webhook support for real-time updates
- [ ] Batch account operations
- [ ] Enhanced error reporting
- [ ] Connection diagnostics

---

**Version**: 1.0  
**Last Updated**: September 13, 2025  
**Author**: SAM AI Development Team