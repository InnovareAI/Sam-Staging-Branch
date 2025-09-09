'use client';

import { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from "next/image";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building, Mail, Lock, User } from 'lucide-react';

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: user info, 2: verify email, 3: create org

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoaded) return;
    
    setIsLoading(true);
    setError('');

    try {
      // Step 1: Create the user account
      const result = await signUp.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        emailAddress: formData.email,
        password: formData.password,
      });

      // Step 2: Send verification email
      if (result.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep(2);
        setIsLoading(false);
        return;
      }

      // If no verification needed, proceed to create organization
      if (result.status === 'complete') {
        await handleCompleteSignup(result);
      }
      
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.errors?.[0]?.message || 'Sign up failed');
      setIsLoading(false);
    }
  };

  const handleCompleteSignup = async (signUpResult: any) => {
    try {
      // Set the session as active
      await setActive({ session: signUpResult.createdSessionId });
      
      // Create organization after successful sign up
      if (formData.organizationName) {
        // We'll create the organization via API call since we need to be authenticated
        const response = await fetch('/api/organizations/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.organizationName,
            slug: formData.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-')
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create organization');
        }
      }
      
      router.push('/');
      
    } catch (err: any) {
      console.error('Organization creation error:', err);
      setError('Account created but organization setup failed. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const [verificationCode, setVerificationCode] = useState('');

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoaded) return;
    
    setIsLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode
      });

      if (result.status === 'complete') {
        await handleCompleteSignup(result);
      }
      
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.errors?.[0]?.message || 'Verification failed');
      setIsLoading(false);
    }
  };

  // Step 2: Email verification
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Image 
              src="/SAM.jpg" 
              alt="Sam AI" 
              width={64}
              height={64}
              className="rounded-full mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-gray-400">Enter the verification code sent to {formData.email}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <form onSubmit={handleVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Verification Code
                </label>
                <Input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="bg-gray-700 border-gray-600 text-white text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !isLoaded}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 font-medium"
              >
                {isLoading ? 'Verifying...' : 'Verify & Create Account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button 
                onClick={() => setStep(1)}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                Back to sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: User registration form
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Image 
            src="/SAM.jpg" 
            alt="SAM AI" 
            width={100}
            height={100}
            className="rounded-full mx-auto mb-4 object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-4xl font-bold text-white mb-2">Join SAM AI</h1>
          <p className="text-gray-400">Start your AI-powered sales journey</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                First Name
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Name
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Smith"
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Work Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@company.com"
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Company Name
              </label>
              <div className="relative">
                <Building size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                  placeholder="Acme Corp"
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !isLoaded}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 font-medium"
            >
              {isLoading ? 'Creating Account...' : 'Create SAM AI Account'}
            </Button>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <Link href="/sign-in" className="text-purple-400 hover:text-purple-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 bg-gray-800 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3">What you'll get:</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>2,000 enriched leads per month</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>LinkedIn + Email automation</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>AI-powered reply management</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Team collaboration</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}