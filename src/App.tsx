import React from 'react';
import { SimulationSidebar } from './components/controls/SimulationSidebar';
import { SystemCanvas } from './components/diagram/SystemCanvas';
import { BottleneckPanel } from './components/diagnostics/BottleneckPanel';

function App() {
  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Sidebar - Fixed Width */}
      <SimulationSidebar />

      {/* Main Content Area - Flexible Width */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Overlays Container */}
        <div className="absolute top-4 left-4 right-64 z-10 flex items-start gap-4 pointer-events-none">
          {/* Header Overlay */}
          <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 pointer-events-auto shrink-0">
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center">
              <span className="bg-blue-600 text-white p-1 rounded mr-2 h-6 w-6 flex items-center justify-center text-sm font-mono italic">S</span>
              System Design Simulator
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Interactive Scaling & Bottleneck Simulator</p>
          </header>

          {/* Bottleneck Overlay Panel */}
          <div className="flex-1 pointer-events-auto">
             <BottleneckPanel />
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 h-full">
          <SystemCanvas />
        </div>
        
        {/* Footer Overlay */}
        <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Interactive Steady-State Simulation Engine v1.0.0</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
