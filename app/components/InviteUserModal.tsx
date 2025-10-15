'use client';

import React, { useState } from 'react';
import { X, Mail, UserPlus, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  isDirectBilling?: boolean; // true for 3cubed customers with direct billing
}

export function InviteUserModal({ isOpen, onClose, workspaceId, workspaceName, isDirectBilling = false }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin' | 'viewer'>('member');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // REACT QUERY: Mutation for sending workspace invitations
  const inviteMutation = useMutation({
    mutationFn: async (inviteData: { workspace_id: string; email: string; role: string }) => {
      const response = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      return data;
    },
    onSuccess: (data) => {
      setMessage(`Invitation sent to ${email}! ${data.email_sent ? 'Email delivered successfully.' : 'Note: Email sending failed, but invitation was created.'}`);
      setEmail('');
      setRole('member');
      setError('');
    },
    onError: (error) => {
      console.error('Error sending invitation:', error);
      setError(error instanceof Error ? error.message : 'Failed to send invitation');
      setMessage('');
    }
  });

  if (!isOpen) return null;

  // If direct billing (3cubed customer), show restricted message
  if (isDirectBilling) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <UserPlus size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Team Management</h2>
                <p className="text-gray-400 text-sm">{workspaceName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-blue-300 text-sm">
                For billing inquiries please talk to your account manager.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setMessage('');
    setError('');

    inviteMutation.mutate({
      workspace_id: workspaceId,
      email: email.trim(),
      role: role,
    });
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setMessage('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Invite User</h2>
              <p className="text-gray-400 text-sm">to {workspaceName}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
                placeholder="colleague@company.com"
                required
                disabled={inviteMutation.isPending}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Role
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="viewer"
                  checked={role === 'viewer'}
                  onChange={(e) => setRole(e.target.value as 'viewer')}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"
                  disabled={inviteMutation.isPending}
                />
                <div className="ml-3">
                  <div className="text-white font-medium">Viewer</div>
                  <div className="text-gray-400 text-sm">Can view workspace content</div>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={role === 'member'}
                  onChange={(e) => setRole(e.target.value as 'member')}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"
                  disabled={inviteMutation.isPending}
                />
                <div className="ml-3">
                  <div className="text-white font-medium">Member</div>
                  <div className="text-gray-400 text-sm">Can participate and contribute</div>
                </div>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={(e) => setRole(e.target.value as 'admin')}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"
                  disabled={inviteMutation.isPending}
                />
                <div className="ml-3">
                  <div className="text-white font-medium">Admin</div>
                  <div className="text-gray-400 text-sm">Can manage workspace and invite others</div>
                </div>
              </label>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-600 rounded-lg text-green-400 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-600 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              disabled={inviteMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending || !email.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {inviteMutation.isPending ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}