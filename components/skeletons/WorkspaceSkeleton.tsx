'use client';

/**
 * Skeleton loaders for workspace-related components
 * These provide instant visual feedback while data loads
 */

// Workspace card skeleton
export function WorkspaceCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-700 rounded-full" />
          <div>
            <div className="h-4 w-32 bg-gray-700 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-gray-700 rounded-full" />
      </div>
      <div className="flex items-center space-x-4 text-sm">
        <div className="h-3 w-24 bg-gray-700 rounded" />
        <div className="h-3 w-16 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// Workspace list skeleton
export function WorkspaceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <WorkspaceCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Sidebar workspace selector skeleton
export function WorkspaceSelectorSkeleton() {
  return (
    <div className="p-3 border-b border-gray-700 animate-pulse">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gray-700 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-700 rounded mb-1" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
        </div>
        <div className="w-4 h-4 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// Campaign card skeleton
export function CampaignCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-40 bg-gray-700 rounded" />
        <div className="h-6 w-20 bg-gray-700 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center">
            <div className="h-6 w-12 bg-gray-700 rounded mx-auto mb-1" />
            <div className="h-3 w-16 bg-gray-700 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <div className="h-3 w-32 bg-gray-700 rounded" />
        <div className="flex space-x-2">
          <div className="h-8 w-20 bg-gray-700 rounded" />
          <div className="h-8 w-20 bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

// Campaign list skeleton
export function CampaignListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-700 rounded-lg" />
            <div className="flex-1">
              <div className="h-6 w-16 bg-gray-700 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-700 animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-700 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-900 animate-pulse">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-4 w-20 bg-gray-700 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Generic content skeleton
export function ContentSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-700 rounded"
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  );
}

// Full page loading skeleton
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-gray-800 rounded" />
        <div className="flex space-x-3">
          <div className="h-10 w-10 bg-gray-800 rounded-full" />
          <div className="h-10 w-32 bg-gray-800 rounded" />
        </div>
      </div>

      {/* Stats */}
      <DashboardStatsSkeleton />

      {/* Content */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="h-6 w-32 bg-gray-800 rounded mb-4" />
          <CampaignListSkeleton count={3} />
        </div>
        <div>
          <div className="h-6 w-24 bg-gray-800 rounded mb-4" />
          <ContentSkeleton lines={8} />
        </div>
      </div>
    </div>
  );
}
