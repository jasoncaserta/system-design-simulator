import { useSimulatorStore } from '../../store/useSimulatorStore';

const INFRA_LAYERS = [
  { id: 'lb', label: 'Load Balancer', type: 'lb' },
  { id: 'app', label: 'App Servers', type: 'app' },
  { id: 'cache', label: 'Redis Cache', type: 'cache' },
  { id: 'db', label: 'Postgres DB', type: 'db' },
];

export const SimulationSidebar = () => {
  const { 
    users, 
    rpsPerUser, 
    readWriteRatio, 
    cacheHitRate, 
    updateSimParams,
    nodeCounts,
    nodeCapacities,
    updateNodeInstances,
    updateNodeCapacity
  } = useSimulatorStore();

  const getBaseCapacity = (type: string) => {
    switch (type) {
      case 'lb': return 10000;
      case 'app': return 500;
      case 'cache': return 50000;
      case 'db': return 1000;
      default: return 1000;
    }
  };

  const getInstanceSize = (tierId: string) => {
    const base = getBaseCapacity(tierId);
    const current = nodeCapacities[tierId];
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
        
        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Concurrent Users</span>
            <span className="font-mono text-blue-600 dark:text-white font-bold">{users.toLocaleString()}</span>
          </label>
          <input 
            type="range" 
            min="1000" 
            max="1000000" 
            step="1000"
            value={users}
            onChange={(e) => updateSimParams({ users: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <label className="flex justify-between text-sm font-semibold mb-2 text-slate-900 dark:text-white">
            <span>Requests per User</span>
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
              {(users * rpsPerUser).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
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
      </section>

      <section className="space-y-4 border-t border-gray-100 dark:border-gray-800 pt-8">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Infrastructure</h3>
        
        {INFRA_LAYERS.map(layer => (
          <div key={layer.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-white">{layer.label}</span>
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
