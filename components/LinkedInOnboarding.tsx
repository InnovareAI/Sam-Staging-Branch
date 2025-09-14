'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ArrowRight, Shield, Users, MessageSquare, Eye, EyeOff } from 'lucide-react';

// TypeScript declarations for reCAPTCHA
declare global {
  interface Window {
    grecaptcha: {
      render: (container: string, options: {
        sitekey: string;
        callback: (response: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
      }) => void;
    };
  }
}

interface LinkedInOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// LinkedIn Logo Component
const LinkedInLogo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

export default function LinkedInOnboarding({ isOpen, onClose, onComplete }: LinkedInOnboardingProps) {
  const [step, setStep] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [linkedInCredentials, setLinkedInCredentials] = useState({
    username: '',
    password: '',
    twoFaCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<'push' | 'code'>('push');
  const [pendingAccountId, setPendingAccountId] = useState('');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaData, setCaptchaData] = useState<{public_key: string, data: string} | null>(null);
  const [pushNotificationPolling, setPushNotificationPolling] = useState(false);
  const [captchaResponse, setCaptchaResponse] = useState('');

  // Polling effect for push notification approval
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    if (needs2FA && twoFAMethod === 'push' && pushNotificationPolling) {
      pollInterval = setInterval(async () => {
        try {
          // Check if LinkedIn connection is now active
          const statusResponse = await fetch('/api/unipile/accounts');
          const statusData = await statusResponse.json();
          
          if (statusData.success && statusData.has_linkedin) {
            // Push notification was approved - proceed to success
            setStep(3);
            setNeeds2FA(false);
            setPushNotificationPolling(false);
            setConnecting(false);
          }
        } catch (error) {
          console.error('Push notification polling error:', error);
        }
      }, 3000); // Check every 3 seconds
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [needs2FA, twoFAMethod, pushNotificationPolling]);

  // Load reCAPTCHA script and render widget when needed
  useEffect(() => {
    if (needsCaptcha && captchaData?.public_key) {
      console.log('🔧 Loading CAPTCHA script and widget:', {
        needsCaptcha,
        hasPublicKey: !!captchaData?.public_key,
        publicKey: captchaData.public_key?.substring(0, 20) + '...',
        scriptExists: !!document.querySelector('script[src*="recaptcha"]')
      });

      // Load reCAPTCHA script if not already loaded
      if (!document.querySelector('script[src*="recaptcha"]')) {
        console.log('📜 Loading Google reCAPTCHA script...');
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        
        script.onload = () => {
          console.log('✅ reCAPTCHA script loaded successfully');
          setTimeout(renderCaptcha, 500); // Small delay to ensure script is ready
        };
        
        script.onerror = (error) => {
          console.error('❌ Failed to load reCAPTCHA script:', error);
          setConnectionError('Failed to load CAPTCHA verification. Please check your internet connection or disable ad blockers.');
        };
      } else {
        console.log('📜 reCAPTCHA script already loaded, rendering widget...');
        // Script already loaded, render immediately with small delay
        setTimeout(renderCaptcha, 100);
      }
    }
  }, [needsCaptcha, captchaData]);

  const renderCaptcha = () => {
    console.log('🎯 Attempting to render CAPTCHA widget:', {
      hasGrecaptcha: !!window.grecaptcha,
      hasPublicKey: !!captchaData?.public_key,
      publicKey: captchaData?.public_key?.substring(0, 20) + '...',
      containerExists: !!document.getElementById('linkedin-captcha')
    });

    if (!window.grecaptcha) {
      console.warn('⚠️ Google reCAPTCHA not available yet, retrying in 1 second...');
      setTimeout(renderCaptcha, 1000);
      return;
    }

    if (!captchaData?.public_key) {
      console.error('❌ No CAPTCHA public key available');
      setConnectionError('CAPTCHA configuration error. Please try again or contact support.');
      return;
    }

    const captchaContainer = document.getElementById('linkedin-captcha');
    if (!captchaContainer) {
      console.error('❌ CAPTCHA container not found in DOM');
      return;
    }

    // Clear any existing widget
    captchaContainer.innerHTML = '';
    
    try {
      console.log('🎨 Rendering reCAPTCHA widget with site key:', captchaData.public_key);
      
      const widgetId = window.grecaptcha.render('linkedin-captcha', {
        sitekey: captchaData.public_key,
        callback: (response: string) => {
          console.log('✅ CAPTCHA completed successfully, response length:', response.length);
          setCaptchaResponse(response);
        },
        'expired-callback': () => {
          console.warn('⏰ CAPTCHA expired, user needs to solve again');
          setCaptchaResponse('');
          setConnectionError('CAPTCHA expired. Please solve the verification again.');
        },
        'error-callback': () => {
          console.error('❌ CAPTCHA error occurred');
          setCaptchaResponse('');
          setConnectionError('CAPTCHA verification failed. Please refresh the page and try again.');
        }
      });
      
      console.log('📦 reCAPTCHA widget created with ID:', widgetId);
      
    } catch (error) {
      console.error('💥 Error rendering CAPTCHA widget:', error);
      setConnectionError(`CAPTCHA loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Show fallback message
      if (captchaContainer) {
        captchaContainer.innerHTML = `
          <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded text-center">
            <p class="text-yellow-300 text-sm mb-2">⚠️ CAPTCHA Widget Failed to Load</p>
            <p class="text-xs text-yellow-400">This might be due to:</p>
            <ul class="text-xs text-yellow-400 mt-1">
              <li>• Ad blocker blocking reCAPTCHA</li>
              <li>• Network connectivity issues</li>
              <li>• Browser compatibility</li>
            </ul>
            <p class="text-xs text-yellow-300 mt-2 font-medium">
              Please complete verification in the LinkedIn mobile app instead.
            </p>
          </div>
        `;
      }
    }
  };

  if (!isOpen) return null;

  const handleConnectLinkedIn = async () => {
    setConnecting(true);
    setConnectionError('');
    
    try {
      // Check current LinkedIn connection status first
      const statusResponse = await fetch('/api/unipile/accounts');
      const statusData = await statusResponse.json();
      
      if (statusData.success && statusData.has_linkedin) {
        // System has LinkedIn accounts - verify by attempting create (will return already_connected)
        const verifyResponse = await fetch('/api/unipile/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            linkedin_credentials: {
              username: 'verify@check.com', // Dummy credentials just to check
              password: 'verify123'
            }
          })
        });

        const verifyData = await verifyResponse.json();
        
        if (verifyData.success && verifyData.action === 'already_connected') {
          // LinkedIn is already connected and running
          setStep(3);
          setConnecting(false);
          return;
        }
      }

      // If no credentials provided yet, go to step 2 to collect them
      if (!linkedInCredentials.username || !linkedInCredentials.password) {
        setStep(2);
        setConnecting(false);
        return;
      }

      // Attempt to create LinkedIn account connection
      const createResponse = await fetch('/api/unipile/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: needsCaptcha && pendingAccountId ? 'complete_captcha' : 'create',
          ...(needsCaptcha && pendingAccountId && { 
            account_id: pendingAccountId,
            captcha_response: captchaResponse 
          }),
          linkedin_credentials: {
            username: linkedInCredentials.username,
            password: linkedInCredentials.password,
            ...(linkedInCredentials.twoFaCode && { twoFaCode: linkedInCredentials.twoFaCode }),
            ...(captchaResponse && { captchaResponse: captchaResponse })
          }
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error('LinkedIn API error:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          errorData
        });
        
        // Handle specific HTTP status codes
        if (createResponse.status === 503) {
          throw new Error('LinkedIn integration is temporarily unavailable. Please try again later.');
        } else if (createResponse.status === 422) {
          // This is handled below for 2FA/CAPTCHA requirements
        } else if (createResponse.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        // Continue with error data for 422 responses (2FA/CAPTCHA)
        const createData = errorData;
      } else {
        var createData = await createResponse.json();
      }
      
      if (createData.success) {
        // Handle CAPTCHA completion
        if (createData.action === 'captcha_completed') {
          console.log('CAPTCHA verification completed successfully');
          setNeedsCaptcha(false);
          setCaptchaResponse('');
          setCaptchaData(null);
          setConnectionError('');
          setStep(3);
          return;
        }

        // Check if this is actually a successful connection or requires 2FA
        // If response is successful but account isn't in running state, it likely needs 2FA
        const verifyConnection = await fetch('/api/unipile/accounts');
        const verifyData = await verifyConnection.json();
        
        console.log('Post-creation verification:', { 
          createSuccess: createData.success,
          hasLinkedInAfterCreation: verifyData.has_linkedin,
          createData 
        });

        // If creation was "successful" but LinkedIn connection doesn't show as available,
        // it likely means 2FA is required but not properly detected
        if (!verifyData.has_linkedin) {
          setNeeds2FA(true);
          setConnectionError('Your LinkedIn account requires 2-factor authentication. Please complete the verification process.');
          // Don't go to success step yet
          return;
        }

        setStep(3);
        setNeeds2FA(false);
        setNeedsCaptcha(false);
        // Update success message based on action type
        if (createData.action === 'already_connected') {
          console.log(`LinkedIn already connected - ${createData.running_accounts} accounts running`);
        }
      } else if (createData.requires_captcha) {
        // LinkedIn requires CAPTCHA
        setNeedsCaptcha(true);
        setCaptchaData(createData.captcha_data);
        setConnectionError('LinkedIn requires CAPTCHA verification. Please complete the verification below.');
        if (createData.account_id) {
          setPendingAccountId(createData.account_id);
        }
      } else if (createData.requires_2fa || (createData.error && (createData.error.includes('2FA') || createData.error.includes('two-factor') || createData.error.includes('verification')))) {
        // LinkedIn requires 2FA
        setNeeds2FA(true);
        setConnectionError('LinkedIn requires 2FA verification. Please complete the authentication.');
        if (createData.account_id) {
          setPendingAccountId(createData.account_id);
        }
        
        // Start polling if push notification method is selected
        if (twoFAMethod === 'push') {
          setPushNotificationPolling(true);
        }
      } else if (createData.error && createData.error.includes('LinkedIn accounts exist but are disconnected')) {
        setConnectionError('Your LinkedIn accounts need to be reconnected. Please contact support for assistance.');
      } else if (createData.error === 'LinkedIn account already exists') {
        // This shouldn't happen with the new logic, but just in case
        setStep(3);
      } else {
        setConnectionError(createData.error || 'Failed to connect LinkedIn account');
      }
      
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      
      // Provide more specific error messages based on the error type
      if (error instanceof Error) {
        if (error.message.includes('credentials not configured') || 
            error.message.includes('503')) {
          setConnectionError('LinkedIn integration is temporarily unavailable. Please try again later or contact support.');
        } else if (error.message.includes('Network')) {
          setConnectionError('Network error. Please check your connection and try again.');
        } else {
          setConnectionError('Unable to connect LinkedIn at this time. Please try again.');
        }
      } else {
        setConnectionError('Unable to connect LinkedIn at this time. Please try again.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-[#0A66C2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkedInLogo size={32} className="text-[#0A66C2]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome to SAM AI!</h2>
            <p className="text-gray-400 mb-6">
              Let's connect your LinkedIn account to unlock SAM's powerful sales features.
            </p>
            
            <div className="space-y-3 mb-8 text-left">
              <div className="flex items-center space-x-3 text-gray-300">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <span>Send personalized LinkedIn messages</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Users className="w-5 h-5 text-green-400" />
                <span>Research prospects and companies</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Shield className="w-5 h-5 text-purple-400" />
                <span>Secure, encrypted connection</span>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <LinkedInLogo size={16} />
              <span>Connect LinkedIn Account</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onClose}
              className="w-full text-gray-400 hover:text-gray-300 text-sm mt-3"
            >
              Skip for now
            </button>
          </div>
        );

      case 2:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-[#0A66C2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkedInLogo size={32} className="text-[#0A66C2]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Connect Your LinkedIn</h2>
            <p className="text-gray-400 mb-6">
              Enter your LinkedIn credentials to connect your account securely.
            </p>

            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="text-left">
                  <p className="text-white font-medium text-sm">Secure & Private</p>
                  <p className="text-gray-400 text-sm">We use secure authentication. Your credentials are encrypted and never stored by SAM AI.</p>
                </div>
              </div>
            </div>

            {/* LinkedIn Credentials Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-left">
                  LinkedIn Email/Username
                </label>
                <input
                  type="email"
                  value={linkedInCredentials.username}
                  onChange={(e) => setLinkedInCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="your-email@example.com"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  disabled={connecting}
                />
              </div>
              
              <div>
                <label className="block text-white text-sm font-medium mb-2 text-left">
                  LinkedIn Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={linkedInCredentials.password}
                    onChange={(e) => setLinkedInCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Your LinkedIn password"
                    className="w-full px-3 py-2 pr-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    disabled={connecting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-300"
                    disabled={connecting}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {needs2FA && (
                <div>
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm">LinkedIn 2FA Required</h3>
                        <p className="text-blue-300 text-xs">Choose your verification method</p>
                      </div>
                    </div>
                    
                    {/* 2FA Method Selection */}
                    <div className="flex space-x-2 mb-4">
                      <button
                        onClick={() => {
                          setTwoFAMethod('push');
                          // Start polling when switching to push method
                          if (needs2FA) {
                            setPushNotificationPolling(true);
                          }
                        }}
                        className={`flex-1 p-2 rounded text-xs ${
                          twoFAMethod === 'push' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        📱 Push Notification
                      </button>
                      <button
                        onClick={() => {
                          setTwoFAMethod('code');
                          // Stop polling when switching to code method
                          setPushNotificationPolling(false);
                        }}
                        className={`flex-1 p-2 rounded text-xs ${
                          twoFAMethod === 'code' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        🔢 Enter Code
                      </button>
                    </div>

                    {twoFAMethod === 'push' ? (
                      <div>
                        <div className="text-blue-300 text-sm">
                          <p className="mb-2">📱 <strong>Check your mobile device:</strong></p>
                          <ul className="space-y-1 text-xs ml-4">
                            <li>• Open the LinkedIn app on your phone</li>
                            <li>• Look for the login approval notification</li>
                            <li>• Tap "Approve" to complete the connection</li>
                          </ul>
                        </div>
                        <div className="mt-3 flex items-center space-x-2 text-blue-300 text-xs">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                          <span>Waiting for approval...</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-white text-sm font-medium mb-2 text-left">
                          Authentication Code
                        </label>
                        <input
                          type="text"
                          value={linkedInCredentials.twoFaCode}
                          onChange={(e) => setLinkedInCredentials(prev => ({ ...prev, twoFaCode: e.target.value }))}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="w-full px-3 py-2 bg-gray-800 border border-blue-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 text-center text-lg tracking-widest"
                          disabled={connecting}
                        />
                        <p className="text-gray-400 text-xs mt-1 text-left">
                          Check your authenticator app or SMS for the 6-digit code
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {needsCaptcha && captchaData && (
                <div>
                  <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm">LinkedIn Verification Required</h3>
                        <p className="text-orange-300 text-xs">Please complete verification on LinkedIn directly</p>
                      </div>
                    </div>
                    
                    {/* CAPTCHA Interface */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <div className="text-center">
                        <div className="inline-block bg-gray-700 p-2 rounded-lg mb-4">
                          {/* Google reCAPTCHA container */}
                          <div 
                            id="linkedin-captcha"
                            style={{ minHeight: '78px' }}
                          >
                            {!captchaResponse && (
                              <div className="text-gray-600 text-sm p-4">
                                <div className="animate-pulse">Loading CAPTCHA...</div>
                                <div className="text-xs mt-2">
                                  Site key: {captchaData.public_key?.substring(0, 20)}...
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-blue-300 text-sm mb-3">
                          Please follow these steps to complete LinkedIn verification:
                        </p>
                        
                        <div className="space-y-2 text-left mb-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-blue-400 font-bold">1.</span>
                            <span className="text-white text-xs">Open LinkedIn mobile app or linkedin.com</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-blue-400 font-bold">2.</span>
                            <span className="text-white text-xs">Complete any CAPTCHA or verification prompts</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-green-400 font-bold">3.</span>
                            <span className="text-white text-xs">Return here and check the box below</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual Verification Confirmation */}
                    <div>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!captchaResponse}
                          onChange={(e) => setCaptchaResponse(e.target.checked ? 'manual_verification_confirmed' : '')}
                          className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-white text-sm">
                          I have completed the verification on LinkedIn
                        </span>
                      </label>
                      <p className="text-gray-400 text-xs mt-2 ml-7">
                        Check this box after you've completed the CAPTCHA or security verification on LinkedIn
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {connectionError && (
              <div className={`border rounded-lg p-3 mb-4 ${
                needs2FA 
                  ? 'bg-blue-900/20 border-blue-500/30' 
                  : needsCaptcha 
                    ? 'bg-orange-900/20 border-orange-500/30'
                    : 'bg-red-900/20 border-red-500/30'
              }`}>
                <p className={`text-sm ${
                  needs2FA 
                    ? 'text-blue-300' 
                    : needsCaptcha 
                      ? 'text-orange-300' 
                      : 'text-red-300'
                }`}>{connectionError}</p>
              </div>
            )}

            <button
              onClick={handleConnectLinkedIn}
              disabled={
                connecting || 
                !linkedInCredentials.username || 
                !linkedInCredentials.password ||
                (needs2FA && twoFAMethod === 'code' && !linkedInCredentials.twoFaCode) ||
                false // Allow users to proceed after LinkedIn app verification
              }
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <LinkedInLogo size={16} />
              <span>
                {connecting 
                  ? needs2FA 
                    ? twoFAMethod === 'push'
                      ? 'Waiting for push notification approval...'
                      : 'Verifying code...'
                    : needsCaptcha
                      ? 'Processing verification...'
                      : 'Connecting...'
                  : needsCaptcha
                    ? captchaResponse
                      ? 'Continue with Verification'
                      : 'Verification Complete - Click to Continue'
                    : needs2FA && twoFAMethod === 'code'
                      ? 'Verify Authentication Code'
                      : 'Connect LinkedIn Account'
                }
              </span>
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full text-gray-400 hover:text-gray-300 text-sm mt-3"
              disabled={connecting}
            >
              Back
            </button>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Successfully Connected!</h2>
            <p className="text-gray-400 mb-6">
              Your LinkedIn account has been connected successfully. You can now use SAM AI's powerful LinkedIn features.
            </p>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-green-300 text-sm">
                ✅ <strong>Connected:</strong> Your LinkedIn account is now ready for personalized outreach, lead research, and automated messaging.
              </p>
            </div>

            <button
              onClick={onComplete}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle size={16} />
              <span>Start Using SAM AI</span>
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full text-blue-400 hover:text-blue-300 text-sm mt-3"
            >
              Connect Different Account
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
          
          {/* Step indicator */}
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              {[1, 2, 3].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`w-2 h-2 rounded-full ${
                    stepNum <= step ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {renderStep()}
        </div>
      </div>
    </div>
  );
}