import { SystemCanvas } from './components/diagram/SystemCanvas';
import { BottleneckPanel } from './components/diagnostics/BottleneckPanel';

function App() {
  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Bottleneck Overlay - Centered */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <BottleneckPanel />
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
