'use client'

import React from 'react'

// This page has been deprecated. Prospect approval is now integrated into the Sam chat interface.
// See components/ThreadedChatInterface.tsx for the active implementation.

export default function DataApprovalDemo() {


  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-white mb-4">
          ⚠️ Page Deprecated
        </h1>
        <p className="text-gray-300 text-lg mb-6">
          The data approval demo page has been integrated into the main Sam chat interface.
        </p>
        <p className="text-gray-400 mb-8">
          Please use the Sam chat interface to upload CSV files, run LinkedIn searches, and approve prospects for your campaigns.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          Go to Sam Chat →
        </a>
      </div>
    </div>
  )
}
