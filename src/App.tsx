import { SystemCanvas } from './components/diagram/SystemCanvas';
import { BottleneckPanel } from './components/diagnostics/BottleneckPanel';
import { ChallengePanel } from './components/challenges/ChallengePanel';

function App() {
  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Bottleneck Overlay - Centered */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <BottleneckPanel />
        </div>

        {/* Challenge Panel - Bottom Left */}
        <div className="absolute bottom-16 left-4 z-10 pointer-events-auto">
          <ChallengePanel />
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 h-full">
          <SystemCanvas />
        </div>

        {/* Footer Overlay */}
        <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Interactive Steady-State Simulation Engine v1.0.0</p>
          <a
            href="https://github.com/jasoncaserta/system-design-simulator"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            className="text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 fill-current"
            >
              <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.52.1.7-.22.7-.5v-1.74c-2.86.62-3.46-1.21-3.46-1.21-.47-1.18-1.14-1.5-1.14-1.5-.93-.64.07-.63.07-.63 1.03.07 1.57 1.05 1.57 1.05.91 1.57 2.4 1.12 2.98.86.09-.67.36-1.12.65-1.38-2.28-.26-4.68-1.14-4.68-5.09 0-1.13.4-2.05 1.05-2.78-.1-.26-.46-1.33.1-2.76 0 0 .86-.28 2.82 1.06a9.7 9.7 0 0 1 5.14 0c1.95-1.34 2.81-1.06 2.81-1.06.56 1.43.2 2.5.1 2.76.66.73 1.05 1.65 1.05 2.78 0 3.96-2.4 4.82-4.7 5.08.37.32.7.93.7 1.87v2.77c0 .27.18.6.71.5A10.5 10.5 0 0 0 12 1.5Z" />
            </svg>
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
