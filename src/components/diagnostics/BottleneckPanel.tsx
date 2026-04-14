import { useSimulatorStore } from '../../store/useSimulatorStore';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const BottleneckPanel = () => {
  const { nodes } = useSimulatorStore();

  const overloadedNodes = nodes.filter(n => n.data.status === 'overloaded');
  const stressedNodes = nodes.filter(n => n.data.status === 'stressed');

  if (overloadedNodes.length === 0 && stressedNodes.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center">
          <CheckCircle className="text-green-500 mr-4 shrink-0" size={24} />
          <div className="flex-1 flex justify-between items-center">
            <p className="text-sm text-green-700 dark:text-green-400 font-black uppercase tracking-wider">System Healthy</p>
            <p className="text-xs text-green-600 dark:text-green-300 font-bold uppercase tracking-tight bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded">
              All nodes operating within capacity
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getRecommendation = (nodeId: string) => {
    switch (nodeId) {
      case 'lb': return "Increase Load Balancer capacity or add more LB instances if your cloud provider allows.";
      case 'app': return "Horizontal scaling: Add more App Server instances to distribute the CPU/Memory load.";
      case 'cache': return "Increase cache size, use a larger instance type, or improve the cache hit rate to reduce the amount of data stored.";
      case 'db': return "Read scaling: Add DB replicas and improve cache hit rate. Write scaling: Sharding or moving to a more performant DB engine.";
      default: return "Review the node's capacity and consider scaling vertically or horizontally.";
    }
  };

  return (
    <div className="space-y-4">
      {overloadedNodes.map(node => (
        <div key={node.id} className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-start">
            <AlertTriangle className="text-red-500 mr-4 shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <div className="flex justify-between items-baseline mb-2">
                <p className="text-sm text-red-700 dark:text-red-400 font-black uppercase tracking-wider">CRITICAL: {node.data.label} Overloaded</p>
                <span className="text-xs font-mono font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded uppercase">
                  {node.data.currentLoad.toFixed(1)} / {(node.data.instances * node.data.maxCapacityPerInstance).toFixed(0)} Queries / Sec
                </span>
              </div>
              <div className="bg-white/40 dark:bg-black/20 p-3 rounded text-xs text-red-900 dark:text-red-200 border border-red-200/50 dark:border-red-800/50">
                <span className="font-bold uppercase text-[10px] mr-2 opacity-70">Recommended Fix:</span>
                {getRecommendation(node.id)}
              </div>
            </div>
          </div>
        </div>
      ))}

      {overloadedNodes.length === 0 && stressedNodes.map(node => (
        <div key={node.id} className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-500 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center">
            <Info className="text-yellow-500 mr-4 shrink-0" size={24} />
            <div className="flex-1 flex justify-between items-center">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 font-black uppercase tracking-wider">{node.data.label} Stressed</p>
              <div className="flex items-center space-x-4">
                <p className="text-xs text-yellow-600 dark:text-yellow-300 font-bold">
                  Load: {((node.data.currentLoad / (node.data.instances * node.data.maxCapacityPerInstance)) * 100).toFixed(0)}%
                </p>
                <div className="w-24 bg-yellow-200 dark:bg-yellow-900/50 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-yellow-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(node.data.currentLoad / (node.data.instances * node.data.maxCapacityPerInstance)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
