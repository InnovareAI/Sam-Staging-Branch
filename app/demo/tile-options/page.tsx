'use client';

import { Settings, Edit, CheckSquare } from 'lucide-react';

export default function TileOptionsDemo() {
  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-semibold mb-8">Tile Design Options Comparison</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Option 1: Icon Button in Header */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Option 1: Icon Button in Header</h2>
            <p className="text-muted-foreground mb-4">Settings button next to badge - grayed out for coming soon</p>
            
            <div className="space-y-4">
              {/* Active Tile */}
              <div className="relative bg-gradient-to-br from-green-600/20 to-green-900/20 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                    <CheckSquare className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
                      Active
                    </span>
                    <button className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                      <Settings className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Active Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Configure this agent with the settings button above.</p>
              </div>

              {/* Coming Soon Tile */}
              <div className="relative bg-gradient-to-br from-teal-600/20 to-teal-900/20 border border-teal-500/30 rounded-xl p-4 opacity-60 cursor-not-allowed">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-700/50">
                    <Edit className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                      Coming Soon
                    </span>
                    <button disabled className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center opacity-40 cursor-not-allowed">
                      <Settings className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Coming Soon Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Settings button visible but disabled until feature is ready.</p>
              </div>
            </div>
          </div>

          {/* Option 2: Hover Overlay */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Option 2: Hover Overlay</h2>
            <p className="text-muted-foreground mb-4">Configure button appears on hover for active tiles only</p>
            
            <div className="space-y-4">
              {/* Active Tile */}
              <div className="group relative bg-gradient-to-br from-green-600/20 to-green-900/20 border border-green-500/30 rounded-xl p-4 cursor-pointer hover:scale-105 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                    <CheckSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
                    Active
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Active Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Hover to see configure button overlay.</p>
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configure
                  </button>
                </div>
              </div>

              {/* Coming Soon Tile */}
              <div className="relative bg-gradient-to-br from-teal-600/20 to-teal-900/20 border border-teal-500/30 rounded-xl p-4 opacity-60 cursor-not-allowed">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-700/50">
                    <Edit className="h-5 w-5 text-gray-500" />
                  </div>
                  <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Coming Soon Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">No hover overlay - clean and minimal.</p>
              </div>
            </div>
          </div>

          {/* Option 3: Corner Settings Icon */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Option 3: Corner Settings Icon</h2>
            <p className="text-muted-foreground mb-4">Small settings icon in absolute top-right position</p>
            
            <div className="space-y-4">
              {/* Active Tile */}
              <div className="relative bg-gradient-to-br from-green-600/20 to-green-900/20 border border-green-500/30 rounded-xl p-4">
                <button className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Settings className="h-4 w-4 text-white" />
                </button>
                
                <div className="flex items-start justify-between mb-3 pr-8">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                    <CheckSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
                    Active
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Active Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Settings icon in corner, always visible.</p>
              </div>

              {/* Coming Soon Tile */}
              <div className="relative bg-gradient-to-br from-teal-600/20 to-teal-900/20 border border-teal-500/30 rounded-xl p-4 opacity-60">
                <button disabled className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center opacity-40 cursor-not-allowed">
                  <Settings className="h-4 w-4 text-gray-500" />
                </button>
                
                <div className="flex items-start justify-between mb-3 pr-8">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-700/50">
                    <Edit className="h-5 w-5 text-gray-500" />
                  </div>
                  <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Coming Soon Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Grayed out corner icon shows it will be configurable.</p>
              </div>
            </div>
          </div>

          {/* Option 4: Different States */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Option 4: Intentionally Different</h2>
            <p className="text-muted-foreground mb-4">Active has button at bottom, coming soon stays minimal</p>
            
            <div className="space-y-4">
              {/* Active Tile - WITH BUTTON */}
              <div className="relative bg-gradient-to-br from-green-600/20 to-green-900/20 border border-green-500/30 rounded-xl p-4 cursor-pointer hover:scale-105 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                    <CheckSquare className="h-5 w-5 text-white" />
                  </div>
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
                    Active
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Active Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Has configure button at bottom.</p>
                
                <div className="mt-3 pt-3 border-t border-white/10">
                  <button className="w-full py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                    <Settings className="h-3.5 w-3.5" />
                    Configure
                  </button>
                </div>
              </div>

              {/* Coming Soon Tile - NO BUTTON */}
              <div className="relative bg-gradient-to-br from-teal-600/20 to-teal-900/20 border border-teal-500/30 rounded-xl p-4 opacity-60 cursor-not-allowed">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-700/50">
                    <Edit className="h-5 w-5 text-gray-500" />
                  </div>
                  <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Coming Soon Agent</h3>
                <p className="text-gray-400 text-xs leading-relaxed">Clean and minimal - no configure option shown. Saves space.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 p-6 bg-primary/10 border border-primary/20 rounded-lg">
          <h3 className="font-semibold mb-3">Comparison Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Option 1:</strong> Most consistent - all tiles same structure
            </div>
            <div>
              <strong>Option 2:</strong> Cleanest default - button only on hover
            </div>
            <div>
              <strong>Option 3:</strong> Subtle - corner icon doesn't affect flow
            </div>
            <div>
              <strong>Option 4:</strong> Current approach - clear visual difference
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
