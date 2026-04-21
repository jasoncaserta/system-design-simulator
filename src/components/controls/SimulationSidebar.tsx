import { useSimulatorStore } from '../../store/useSimulatorStore';
import { formatK } from '../../utils/format';

export const SimulationSidebar = () => {
  const {
    users,
    rpsPerUser,
    showNodeConfig,
    toggleNodeConfig,
  } = useSimulatorStore();

  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto text-slate-900 dark:text-white">
      <div className="mb-8 border-b pb-4 border-gray-100 dark:border-gray-800">
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight flex items-center">
          <span className="bg-blue-600 text-white p-1 rounded mr-2 h-6 w-6 flex items-center justify-center text-sm font-mono italic">S</span>
          System Design Simulator
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Interactive Scaling & Bottleneck Simulator</p>
      </div>

      <section className="space-y-4">
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-lg p-2.5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Total Requests / Sec</span>
            <span className="font-mono font-bold text-gray-700 dark:text-white text-sm">
              {formatK(users * rpsPerUser)}
            </span>
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-blue-500/80 dark:text-blue-400/80 mb-0.5">
            Serving Magnitude
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-blue-200">
            {(() => {
              const qps = users * rpsPerUser;
              if (qps >= 1000000) return 'Global API Front Door';
              if (qps >= 150000) return 'High-Traffic Consumer Product';
              if (qps >= 25000) return 'Internet-Scale Niche Service';
              if (qps >= 5000) return 'Healthy Public Data Product';
              if (qps >= 1000) return 'Focused Production Deployment';
              return 'Low-Traffic Specialized Service';
            })()}
          </p>
        </div>

        <button
          onClick={toggleNodeConfig}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
            showNodeConfig
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {showNodeConfig ? 'Hide' : 'Show'} Node Configuration
        </button>
      </section>
    </div>
  );
};
