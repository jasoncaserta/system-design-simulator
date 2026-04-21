import { useSimulatorStore } from '../../store/useSimulatorStore';
import { formatK } from '../../utils/format';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Server, HardDrive, Database, Layers, Activity, Globe, Box } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INFRA_LAYERS = [
  { id: 'cdn', label: 'CDN (Edge)', type: 'cdn', icon: Globe },
  { id: 'lb', label: 'Load Balancer', type: 'lb', icon: Layers },
  { id: 'app', label: 'App Servers', type: 'app', icon: Server },
  { id: 'cache', label: 'Redis Cache', type: 'cache', icon: Activity },
  { id: 'db', label: 'Postgres DB', type: 'db', icon: Database },
  { id: 'blob-storage', label: 'Blob Storage', type: 'blob-storage', icon: Box },
];

export const SimulationSidebar = () => {
  const { 
    users, 
    rpsPerUser, 
    readWriteRatio, 
    cacheHitRate, 
    cdnHitRate,
    backgroundJobLoad,
    enableApiPriorityGate,
    updateSimParams,
    nodeCounts,
    nodeCapacities,
    updateNodeInstances,
    updateNodeCapacity,
  } = useSimulatorStore();

  const getBaseCapacity = (type: string) => {
    switch (type) {
      case 'cdn': return 100000;
      case 'lb': return 10000;
      case 'app': return 500;
      case 'cache': return 50000;
      case 'db': return 1000;
      case 'blob-storage': return 5000;
      default: return 1000;
    }
  };

  const getInstanceSize = (tierId: string) => {
    const cleanId = tierId.replace(/-[0-9]+$/, '');
    const base = getBaseCapacity(cleanId);
    const current = nodeCapacities[cleanId] || base;
    const ratio = current / base;
    if (ratio <= 0.51) return 'small';
    if (ratio <= 1.01) return 'medium';
    if (ratio <= 2.01) return 'large';
    return 'xlarge';
  };

  const SIZES = [
    { label: 'small', mult: 0.5 },
    { label: 'medium', mult: 1.0 },
    { label: 'large', mult: 2.0 },
    { label: 'xlarge', mult: 4.0 },
  ];

  const changeInstanceSize = (layerId: string, delta: number) => {
    const currentSize = getInstanceSize(layerId);
    const currentIndex = SIZES.findIndex(s => s.label === currentSize);
    const nextIndex = Math.max(0, Math.min(SIZES.length - 1, currentIndex + delta));
    updateNodeCapacity(layerId, getBaseCapacity(layerId) * SIZES[nextIndex].mult);
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto text-slate-900 dark:text-white">
      <h2 className="text-xl font-bold mb-8 text-slate-900 dark:text-white border-b pb-4 border-gray-100 dark:border-gray-800 uppercase tracking-tight">
        Simulation Controls
      </h2>
      
      <section className="space-y-6 mb-10">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Global Traffic</h3>
        
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-slate-900 dark:text-white">
            Concurrent Users
          </label>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => updateSimParams({ users: Math.max(1000, users / 10) })}
              className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={users <= 1000}
            >
              -
            </button>
            <span className="font-mono text-blue-600 dark:text-white font-bold text-sm w-20 text-center">
              {formatK(users)}
            </span>
            <button 
              onClick={() => updateSimParams({ users: Math.min(1000000, users * 10) })}
              className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={users >= 1000000}
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Requests per User (RPS)</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{rpsPerUser.toFixed(2)}</span>
          </label>
          <input 
            type="range" 
            min="0.01" 
            max="2.0" 
            step="0.01"
            value={rpsPerUser}
            onChange={(e) => updateSimParams({ rpsPerUser: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="pt-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Total Queries Per Second:</span>
            <span className="font-mono font-bold text-gray-700 dark:text-white text-sm">
              {formatK(users * rpsPerUser)}
            </span>
          </div>
          <div className="mt-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-lg p-2.5">
            <p className="text-[10px] uppercase font-black tracking-widest text-blue-500/80 dark:text-blue-400/80 mb-0.5">
              Traffic Magnitude
            </p>
            <p className="text-xs font-bold text-slate-700 dark:text-blue-200">
              {(() => {
                const qps = users * rpsPerUser;
                if (qps >= 1000000) return "🚀 Netflix API Scale";
                if (qps >= 150000) return "🔥 Google Search Scale";
                if (qps >= 75000) return "📚 Wikipedia Total Scale";
                if (qps >= 10000) return "🐦 X (Twitter) Writes Scale";
                if (qps >= 2500) return "💻 Stack Overflow Scale";
                if (qps >= 500) return "🏢 Large Enterprise Scale";
                return "🏠 Boutique Shop Scale";
              })()}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6 mb-10 border-t border-gray-100 dark:border-gray-800 pt-8">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">System Behavior</h3>
        
        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Read vs Write Ratio</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{(readWriteRatio * 100).toFixed(0)}% Read</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={readWriteRatio}
            onChange={(e) => updateSimParams({ readWriteRatio: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Cache Hit Rate</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{(cacheHitRate * 100).toFixed(0)}%</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={cacheHitRate}
            onChange={(e) => updateSimParams({ cacheHitRate: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>CDN Hit Rate</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{(cdnHitRate * 100).toFixed(0)}%</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={cdnHitRate}
            onChange={(e) => updateSimParams({ cdnHitRate: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Background Job Load</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{backgroundJobLoad.toFixed(0)} QPS</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="500" 
            step="10"
            value={backgroundJobLoad}
            onChange={(e) => updateSimParams({ backgroundJobLoad: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-900 dark:text-white">
            API Priority Gate
          </label>
          <button 
            onClick={() => updateSimParams({ enableApiPriorityGate: !enableApiPriorityGate })}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              enableApiPriorityGate ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                enableApiPriorityGate ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </section>

      <section className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-8">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Infrastructure</h3>
        
        {INFRA_LAYERS.map(layer => (
          <div key={layer.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2">
                <layer.icon size={14} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-700 dark:text-white">{layer.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => updateNodeInstances(layer.id, (nodeCounts[layer.id] || 1) - 1)}
                  className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white"
                >
                  -
                </button>
                <span className="text-sm font-mono w-4 text-center font-bold text-slate-900 dark:text-white">{nodeCounts[layer.id] || 1}</span>
                <button 
                  onClick={() => updateNodeInstances(layer.id, (nodeCounts[layer.id] || 1) + 1)}
                  className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span className="uppercase font-semibold tracking-wider">Instance Size</span>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => changeInstanceSize(layer.id, -1)}
                  className="w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={getInstanceSize(layer.id) === 'small'}
                >
                  -
                </button>
                <span className="text-[10px] font-bold uppercase w-12 text-center text-slate-900 dark:text-white">{getInstanceSize(layer.id)}</span>
                <button 
                  onClick={() => changeInstanceSize(layer.id, 1)}
                  className="w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={getInstanceSize(layer.id) === 'xlarge'}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
