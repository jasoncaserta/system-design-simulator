import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';

export const SimulationSidebar = () => {
  const { 
    users, 
    rpsPerUser, 
    readWriteRatio, 
    cacheHitRate, 
    updateSimParams,
    nodes,
    updateNodeInstances,
    updateNodeCapacity
  } = useSimulatorStore();

  const getBaseCapacity = (type: string) => {
    switch (type) {
      case 'lb': return 500;
      case 'app': return 100;
      case 'cache': return 1000;
      case 'db': return 50;
      default: return 100;
    }
  };

  const getInstanceSize = (node: any) => {
    const base = getBaseCapacity(node.data.type);
    const current = node.data.maxCapacityPerInstance;
    const ratio = current / base;
    if (ratio <= 0.5) return 'small';
    if (ratio <= 1.0) return 'medium';
    if (ratio <= 2.0) return 'large';
    return 'xlarge';
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
            min="100" 
            max="50000" 
            step="100"
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
        
        {nodes.filter(n => n.id !== 'client').map(node => (
          <div key={node.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-white">{node.data.label}</span>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => updateNodeInstances(node.id, node.data.instances - 1)}
                  className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white"
                >
                  -
                </button>
                <span className="text-sm font-mono w-4 text-center font-bold text-slate-900 dark:text-white">{node.data.instances}</span>
                <button 
                  onClick={() => updateNodeInstances(node.id, node.data.instances + 1)}
                  className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 text-slate-900 dark:text-white"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span className="uppercase font-semibold">Instance Size</span>
              <select 
                value={getInstanceSize(node)}
                onChange={(e) => {
                  const multiplier = e.target.value === 'small' ? 0.5 : e.target.value === 'medium' ? 1.0 : e.target.value === 'large' ? 2.0 : 4.0;
                  updateNodeCapacity(node.id, getBaseCapacity(node.data.type) * multiplier);
                }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 text-[10px] font-bold text-slate-900 dark:text-white"
              >
                <option value="small">Small (0.5x)</option>
                <option value="medium">Medium (1.0x)</option>
                <option value="large">Large (2.0x)</option>
                <option value="xlarge">X-Large (4.0x)</option>
              </select>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};
