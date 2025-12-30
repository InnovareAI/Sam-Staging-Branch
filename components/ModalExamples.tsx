'use client';

import React, { useState } from 'react';
import CustomModal, { ConfirmModal, InfoModal, LoadingModal } from './ui/CustomModal';
import { Save, Trash2, Settings, UserPlus, Mail, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function ModalExamples() {
  const [modals, setModals] = useState({
    basic: false,
    confirm: false,
    info: false,
    loading: false,
    form: false,
    settings: false,
    complex: false
  });

  const openModal = (type: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [type]: true }));
  };

  const closeModal = (type: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [type]: false }));
  };

  const handleDelete = () => {
    console.log('Item deleted!');
    // Your delete logic here
  };

  const handleSave = () => {
    console.log('Settings saved!');
    // Your save logic here
  };

  const simulateLoading = () => {
    openModal('loading');
    setTimeout(() => {
      closeModal('loading');
    }, 3000);
  };

  return (
    <div className="p-8 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold text-white mb-8">Custom Modal Examples</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Basic Modal */}
          <button
            onClick={() => openModal('basic')}
            className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Basic Modal
          </button>

          {/* Confirm Modal */}
          <button
            onClick={() => openModal('confirm')}
            className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Trash2 size={16} />
            <span>Delete Item</span>
          </button>

          {/* Info Modal */}
          <button
            onClick={() => openModal('info')}
            className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Show Info
          </button>

          {/* Loading Modal */}
          <button
            onClick={simulateLoading}
            className="p-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Loading Demo
          </button>

          {/* Form Modal */}
          <button
            onClick={() => openModal('form')}
            className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <UserPlus size={16} />
            <span>Add User</span>
          </button>

          {/* Settings Modal */}
          <button
            onClick={() => openModal('settings')}
            className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          {/* Complex Modal */}
          <button
            onClick={() => openModal('complex')}
            className="p-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            Complex Modal
          </button>
        </div>

        {/* Basic Modal */}
        <CustomModal
          isOpen={modals.basic}
          onClose={() => closeModal('basic')}
          title="Basic Modal"
          description="This is a simple modal example"
        >
          <div className="p-6">
            <p className="text-gray-300 mb-4">
              This is a basic modal with a title, description, and content area.
              It follows the app's design system with the dark theme and purple accents.
            </p>
            <p className="text-gray-400 text-sm">
              You can close this modal by clicking the X button, pressing Escape, or clicking outside.
            </p>
          </div>
        </CustomModal>

        {/* Confirm Modal */}
        <ConfirmModal
          isOpen={modals.confirm}
          onClose={() => closeModal('confirm')}
          onConfirm={handleDelete}
          title="Delete Item"
          message="Are you sure you want to delete this item? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
        />

        {/* Info Modal */}
        <InfoModal
          isOpen={modals.info}
          onClose={() => closeModal('info')}
          title="Success!"
          message="Your action was completed successfully. Everything is working as expected."
          buttonText="Got it"
        />

        {/* Loading Modal */}
        <LoadingModal
          isOpen={modals.loading}
          title="Processing..."
          message="Please wait while we process your request. This may take a few moments."
        />

        {/* Form Modal */}
        <CustomModal
          isOpen={modals.form}
          onClose={() => closeModal('form')}
          title="Add New User"
          description="Fill out the form below to add a new user to your workspace"
          size="md"
        >
          <form className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role
              </label>
              <Select defaultValue="member">
                <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white py-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => closeModal('form')}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                Add User
              </button>
            </div>
          </form>
        </CustomModal>

        {/* Settings Modal */}
        <CustomModal
          isOpen={modals.settings}
          onClose={() => closeModal('settings')}
          title="Workspace Settings"
          size="lg"
        >
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">General Settings</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  defaultValue="My Workspace"
                  className="w-full py-3 px-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  defaultValue="This is my primary workspace for managing sales campaigns."
                  className="w-full py-3 px-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="notifications"
                  defaultChecked
                />
                <label htmlFor="notifications" className="text-gray-300 cursor-pointer">
                  Enable email notifications
                </label>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => closeModal('settings')}
                className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSave();
                  closeModal('settings');
                }}
                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </CustomModal>

        {/* Complex Modal */}
        <CustomModal
          isOpen={modals.complex}
          onClose={() => closeModal('complex')}
          title="System Status"
          size="xl"
        >
          <div className="p-6">
            <div className="space-y-6">
              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <h4 className="font-semibold text-foreground">API Status</h4>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">All systems operational</p>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <h4 className="font-semibold text-foreground">Database</h4>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">Minor delays detected</p>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <h4 className="font-semibold text-foreground">Email Service</h4>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">Service temporarily unavailable</p>
                </div>

                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <h4 className="font-semibold text-foreground">Storage</h4>
                  </div>
                  <p className="text-gray-300 text-sm mt-2">85% capacity remaining</p>
                </div>
              </div>

              {/* Alert */}
              <div className="bg-yellow-600 bg-opacity-20 border border-yellow-500 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-yellow-500 font-semibold">Scheduled Maintenance</h4>
                    <p className="text-yellow-200 text-sm mt-1">
                      System maintenance is scheduled for tonight at 2:00 AM UTC. Expected downtime: 30 minutes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h4 className="text-white font-semibold mb-3">Recent Activity</h4>
                <div className="space-y-2">
                  {[
                    { time: '2 minutes ago', action: 'User john@example.com signed in' },
                    { time: '5 minutes ago', action: 'Campaign "Q4 Outreach" was created' },
                    { time: '12 minutes ago', action: 'Database backup completed' },
                    { time: '1 hour ago', action: 'System update deployed' }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0">
                      <span className="text-gray-300 text-sm">{item.action}</span>
                      <span className="text-gray-500 text-xs">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CustomModal>
      </div>
    </div>
  );
}